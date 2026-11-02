import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { InternalPrincipal } from './canonical';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { InternalAuthError, INTERNAL_AUTH_ERROR_CODE } from './errors';
import { verifyInternalHeaders, type HeaderBag } from './verify';

interface InternalRequestLike {
  method?: string;
  path?: string;
  url?: string;
  originalUrl?: string;
  headers: HeaderBag;
  internalPrincipal?: InternalPrincipal;
}

function traceIdOf(request: InternalRequestLike): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    ? value
    : randomUUID();
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<InternalRequestLike>();
    const traceId = traceIdOf(request);
    const secret = this.configService.get<string>('INTERNAL_HMAC_KEY');

    if (!secret) {
      throw this.unauthorized(traceId);
    }

    let principal: InternalPrincipal;
    try {
      principal = verifyInternalHeaders({
        secret,
        method: request.method ?? 'GET',
        path: request.path ?? request.originalUrl ?? request.url ?? '/',
        headers: request.headers,
      });
    } catch (error) {
      if (error instanceof InternalAuthError) {
        throw this.unauthorized(traceId);
      }
      throw this.unauthorized(traceId);
    }

    request.internalPrincipal = principal;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'FORBIDDEN',
          message: 'No tiene permiso para realizar esta operación.',
          traceId,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!required.every((permiso) => principal.permisos.includes(permiso))) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'FORBIDDEN',
          message: 'No tiene permiso para realizar esta operación.',
          traceId,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }

  private unauthorized(traceId: string): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        code: INTERNAL_AUTH_ERROR_CODE,
        message: 'La solicitud interna no pudo autenticarse.',
        traceId,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
