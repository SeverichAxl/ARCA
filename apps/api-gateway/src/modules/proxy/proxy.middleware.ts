import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from 'common-dtos';
import type { NextFunction, Request, Response } from 'express';
import * as http from 'node:http';
import * as https from 'node:https';
import { JwtTokenService } from '../auth/jwt-token.service';

interface ProxyRoute {
  prefix: string;
  envKey: string;
}

const PROXY_ROUTES: ProxyRoute[] = [
  { prefix: '/api/auth', envKey: 'AUTH_SERVICE_URL' },
  { prefix: '/api/personal', envKey: 'PERSONAL_SERVICE_URL' },
  { prefix: '/api/vacaciones', envKey: 'VACACIONES_SERVICE_URL' },
  { prefix: '/api/contratos', envKey: 'CONTRATOS_SERVICE_URL' },
  { prefix: '/api/planillas', envKey: 'PLANILLAS_SERVICE_URL' },
];

// Equivalente a @Public() para las rutas que atraviesan el middleware de proxy.
const PUBLIC_PROXY_PATHS = new Set(['/api/auth/login', '/api/auth/refresh']);

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const route = PROXY_ROUTES.find((candidate) =>
      request.originalUrl.startsWith(candidate.prefix),
    );

    if (!route) {
      next();
      return;
    }

    if (!PUBLIC_PROXY_PATHS.has(request.path)) {
      const token = this.extractBearerToken(request);

      if (!token) {
        this.unauthorized(response, 'Token no proporcionado');
        return;
      }

      try {
        (request as Request & { user?: JwtPayload }).user = this.jwtTokenService.verify(token);
      } catch {
        this.unauthorized(response, 'Token inválido o expirado');
        return;
      }

      // TODO(RBAC): validar permisos del payload antes de reenviar al microservicio.
    }

    const targetBaseUrl = this.configService.get<string>(route.envKey);

    if (!targetBaseUrl) {
      response.status(502).json({
        statusCode: 502,
        message: `Servicio no configurado: ${route.envKey}`,
      });
      return;
    }

    const pathWithoutApiPrefix = request.originalUrl.replace(/^\/api/, '') || '/';
    const targetUrl = new URL(pathWithoutApiPrefix, targetBaseUrl);
    const transport = targetUrl.protocol === 'https:' ? https : http;

    const proxyRequest = transport.request(
      targetUrl,
      {
        method: request.method,
        headers: { ...request.headers } as http.OutgoingHttpHeaders,
      },
      (proxyResponse) => {
        response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        proxyResponse.pipe(response);
      },
    );

    proxyRequest.on('error', (error: Error) => {
      this.logger.error(`Error proxying ${request.method} ${request.originalUrl}: ${error.message}`);

      if (!response.headersSent) {
        response.status(502).json({
          statusCode: 502,
          message: 'Servicio no disponible',
        });
      }
    });

    if (!this.writeParsedBody(request, proxyRequest)) {
      request.pipe(proxyRequest);
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private unauthorized(response: Response, message: string): void {
    response.status(401).json({
      statusCode: 401,
      message,
    });
  }

  private writeParsedBody(request: Request, proxyRequest: http.ClientRequest): boolean {
    const body = request.body as unknown;

    if (body === undefined || request.method === 'GET' || request.method === 'HEAD') {
      return false;
    }

    const serialized =
      request.is('application/x-www-form-urlencoded') && typeof body === 'object' && body !== null
        ? new URLSearchParams(body as Record<string, string>).toString()
        : JSON.stringify(body);

    proxyRequest.setHeader('content-length', Buffer.byteLength(serialized));
    proxyRequest.write(serialized);
    proxyRequest.end();

    return true;
  }
}
