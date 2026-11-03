import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'common-dtos';
import { DomainError, Errores } from '../../domain/errors/domain.error';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

/**
 * Autentica el JWT RS256 y verifica permisos declarados con @RequirePermission.
 * Deniega por defecto: un endpoint no público sin permiso declarado responde 403.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const objetivos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, objetivos)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new DomainError('AUTH_TOKEN_INVALID', 401, 'La autenticación no es válida.');
    }
    request.user = this.verifyToken(token);

    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, objetivos);
    if (!requeridos?.length) {
      throw Errores.prohibido();
    }
    const permisos = new Set(request.user.permisos ?? []);
    if (!requeridos.every((permiso) => permisos.has(permiso))) {
      throw Errores.prohibido();
    }
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private verifyToken(token: string): JwtPayload {
    const rawKey = this.configService.get<string>('JWT_PUBLIC_KEY');
    if (!rawKey) {
      throw new DomainError('AUTH_TOKEN_INVALID', 401, 'La autenticación no es válida.');
    }

    const publicKey = rawKey.includes('BEGIN PUBLIC KEY')
      ? rawKey.replace(/\\n/g, '\n')
      : Buffer.from(rawKey, 'base64').toString('utf8');

    const options: jwt.VerifyOptions = { algorithms: ['RS256'] };
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    if (issuer) options.issuer = issuer;
    if (audience) options.audience = audience;

    try {
      return jwt.verify(token, publicKey, options) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new DomainError('AUTH_TOKEN_EXPIRED', 401, 'La sesión expiró.');
      }
      throw new DomainError('AUTH_TOKEN_INVALID', 401, 'La autenticación no es válida.');
    }
  }
}
