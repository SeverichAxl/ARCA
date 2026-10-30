import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'common-dtos';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    request.user = this.verifyToken(token);

    // TODO(RBAC): leer los metadatos de @RequirePermission(PERMISSIONS_KEY) y validar
    // que el payload JWT contenga los permisos requeridos. Por ahora el guard solo
    // autentica y deniega todo lo que no esté marcado con @Public().
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private verifyToken(token: string): JwtPayload {
    const rawKey = this.configService.get<string>('JWT_PUBLIC_KEY');

    if (!rawKey) {
      throw new UnauthorizedException('JWT_PUBLIC_KEY no configurada');
    }

    const publicKey = rawKey.includes('BEGIN PUBLIC KEY')
      ? rawKey.replace(/\\n/g, '\n')
      : Buffer.from(rawKey, 'base64').toString('utf8');

    const options: jwt.VerifyOptions = { algorithms: ['RS256'] };
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');

    if (issuer) {
      options.issuer = issuer;
    }
    if (audience) {
      options.audience = audience;
    }

    try {
      return jwt.verify(token, publicKey, options) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
