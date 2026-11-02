import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { internalRoutePath, type InternalPrincipal } from '@arca/internal-auth';
import type { JwtPayload } from 'common-dtos';
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { JwtTokenService, JwtVerificationError } from '../auth/jwt-token.service';
import { InternalHeadersService } from '../auth/internal-headers.service';
import { AUDIT_SINK, type AuditSink } from '../../rbac/audit-sink';
import { sendError } from '../../rbac/http-error';
import { normalizeAndValidatePath } from '../../rbac/path';
import {
  matchGatewayRoute,
  permissionsSatisfy,
  serviceFromPath,
} from '../../rbac/route-table';
import type { GatewayRoute, GatewayService } from '../../rbac/route.types';
import { ProxyService } from './proxy.service';

const SERVICE_ENV_KEYS: Record<GatewayService, string> = {
  auth: 'AUTH_SERVICE_URL',
  personal: 'PERSONAL_SERVICE_URL',
  vacaciones: 'VACACIONES_SERVICE_URL',
  contratos: 'CONTRATOS_SERVICE_URL',
  planillas: 'PLANILLAS_SERVICE_URL',
};

const MANAGED_HEADERS = new Set([
  'x-user-id',
  'x-empleado-id',
  'x-rol',
  'x-permisos',
  'x-timestamp',
  'x-internal-signature',
]);

const METHOD_OVERRIDE_HEADERS = new Set([
  'x-http-method-override',
  'x-method-override',
  'x-http-method',
]);

/**
 * Único punto de entrada de la API: valida y normaliza la ruta, verifica el JWT
 * localmente, aplica la tabla RBAC, firma las cabeceras internas y recién
 * entonces delega en el proxy. Ninguna ruta llega al proxy sin pasar por aquí.
 */
@Injectable()
export class GatewayAuthorizationMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly internalHeadersService: InternalHeadersService,
    @Inject(AUDIT_SINK) private readonly auditSink: AuditSink,
    private readonly proxyService: ProxyService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const originalUrl = request.originalUrl ?? request.url;
    const [rawPath] = originalUrl.split('?');
    const traceId = this.traceId(request.headers);

    if (request.method === 'GET' && (rawPath === '/health' || rawPath === '/health/')) {
      next();
      return;
    }

    const validation = normalizeAndValidatePath(originalUrl);

    if (!validation.ok) {
      sendError(
        response,
        400,
        'VALIDATION_ERROR',
        'Uno o más campos no son válidos.',
        traceId,
        { path: validation.reason },
      );
      return;
    }

    const normalizedPath = validation.path;
    const service = serviceFromPath(normalizedPath);

    if (!service) {
      sendError(
        response,
        404,
        'NOT_FOUND',
        'El recurso solicitado no existe.',
        traceId,
      );
      return;
    }

    const route = matchGatewayRoute(request.method, normalizedPath);
    const token = this.extractBearerToken(request.headers);

    if (!route) {
      this.decideUndeclaredRoute(request, response, normalizedPath, token, traceId);
      return;
    }

    if (route.access === 'public') {
      this.proxy(request, response, route, normalizedPath, traceId, this.sanitizeHeaders(request.headers));
      return;
    }

    if (!token) {
      this.deny(
        request,
        response,
        401,
        'AUTH_TOKEN_INVALID',
        'La autenticación no es válida.',
        traceId,
        null,
        'token_ausente',
        normalizedPath,
      );
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtTokenService.verify(token);
    } catch (error) {
      const code =
        error instanceof JwtVerificationError && error.code === 'AUTH_TOKEN_EXPIRED'
          ? 'AUTH_TOKEN_EXPIRED'
          : 'AUTH_TOKEN_INVALID';
      const message =
        code === 'AUTH_TOKEN_EXPIRED'
          ? 'La sesión expiró.'
          : 'La autenticación no es válida.';
      this.deny(
        request,
        response,
        401,
        code,
        message,
        traceId,
        null,
        code,
        normalizedPath,
      );
      return;
    }

    if (!permissionsSatisfy(route.access, payload.permisos)) {
      this.deny(
        request,
        response,
        403,
        'FORBIDDEN',
        'No tiene permiso para realizar esta operación.',
        traceId,
        payload.sub,
        'permiso_ausente',
        normalizedPath,
      );
      return;
    }

    const principal: InternalPrincipal = {
      userId: payload.sub,
      empleadoId: payload.empleadoId ?? null,
      rol: payload.rol,
      permisos: payload.permisos,
    };

    const signedHeaders = this.internalHeadersService.sign(
      request.method,
      normalizedPath,
      principal,
    );
    const headers = this.sanitizeHeaders(request.headers);
    Object.assign(headers, signedHeaders);

    this.proxy(request, response, route, normalizedPath, traceId, headers);
  }

  private decideUndeclaredRoute(
    request: Request,
    response: Response,
    normalizedPath: string,
    token: string | undefined,
    traceId: string,
  ): void {
    if (!token) {
      this.deny(
        request,
        response,
        401,
        'AUTH_TOKEN_INVALID',
        'La autenticación no es válida.',
        traceId,
        null,
        'token_ausente',
        normalizedPath,
      );
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtTokenService.verify(token);
    } catch (error) {
      const code =
        error instanceof JwtVerificationError && error.code === 'AUTH_TOKEN_EXPIRED'
          ? 'AUTH_TOKEN_EXPIRED'
          : 'AUTH_TOKEN_INVALID';
      const message =
        code === 'AUTH_TOKEN_EXPIRED'
          ? 'La sesión expiró.'
          : 'La autenticación no es válida.';
      this.deny(
        request,
        response,
        401,
        code,
        message,
        traceId,
        null,
        code,
        normalizedPath,
      );
      return;
    }

    this.deny(
      request,
      response,
      403,
      'FORBIDDEN',
      'No tiene permiso para realizar esta operación.',
      traceId,
      payload.sub,
      'ruta_no_declarada',
      normalizedPath,
    );
  }

  private proxy(
    request: Request,
    response: Response,
    route: GatewayRoute,
    normalizedPath: string,
    traceId: string,
    headers: OutgoingHttpHeaders,
  ): void {
    const envKey = SERVICE_ENV_KEYS[route.service];
    const targetBaseUrl = this.configService.get<string>(envKey);

    if (!targetBaseUrl) {
      sendError(
        response,
        502,
        'INTERNAL_ERROR',
        'Servicio no disponible.',
        traceId,
      );
      return;
    }

    const queryIndex = (request.originalUrl ?? request.url).indexOf('?');
    const search = queryIndex >= 0 ? (request.originalUrl ?? request.url).slice(queryIndex) : '';

    this.proxyService.forward(request, response, {
      targetBaseUrl,
      destinationPath: internalRoutePath(normalizedPath),
      search,
      method: request.method,
      headers,
      traceId,
    });
  }

  private deny(
    request: Request,
    response: Response,
    statusCode: number,
    code: string,
    message: string,
    traceId: string,
    userId: string | null,
    motivo: string,
    normalizedPath: string,
  ): void {
    this.auditSink.record({
      userId,
      ip: request.ip ?? request.socket?.remoteAddress ?? 'desconocida',
      method: request.method ?? 'DESCONOCIDO',
      ruta: normalizedPath,
      motivo,
      statusCode,
      traceId,
      occurredOn: new Date().toISOString(),
    });

    sendError(response, statusCode, code, message, traceId);
  }

  private sanitizeHeaders(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
    const sanitized: OutgoingHttpHeaders = {};

    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase();

      if (
        value === undefined ||
        lower === 'authorization' ||
        lower.startsWith('x-internal-') ||
        MANAGED_HEADERS.has(lower) ||
        METHOD_OVERRIDE_HEADERS.has(lower)
      ) {
        continue;
      }

      sanitized[lower] = value;
    }

    return sanitized;
  }

  private extractBearerToken(headers: IncomingHttpHeaders): string | undefined {
    const raw = headers.authorization;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const match = /^Bearer\s+(.+)$/i.exec(value ?? '');
    return match?.[1];
  }

  private traceId(headers: IncomingHttpHeaders): string {
    const raw = headers['x-request-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;

    return typeof value === 'string' && value.length > 0 && value.length <= 128
      ? value
      : randomUUID();
  }
}
