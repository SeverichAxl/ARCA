import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InternalAuthGuard, PERMISSIONS_KEY } from '@arca/internal-auth';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated-only.decorator';

interface RequestWithPrincipal {
  internalPrincipal?: unknown;
}

/**
 * Extiende el guard deny-by-default compartido con un modo "solo autenticado"
 * para endpoints de sesión propia que no exigen un permiso del seed (logout).
 * La firma HMAC se verifica igual que siempre: solo se omite el chequeo de
 * permisos cuando el handler declara @AuthenticatedOnly() y no declara
 * @RequirePermission(...).
 */
@Injectable()
export class JwtAuthGuard extends InternalAuthGuard {
  constructor(
    private readonly msAuthReflector: Reflector,
    configService: ConfigService,
  ) {
    super(msAuthReflector, configService);
  }

  canActivate(context: ExecutionContext): boolean {
    const authenticatedOnly = this.msAuthReflector.getAllAndOverride<boolean>(
      AUTHENTICATED_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const required = this.msAuthReflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!authenticatedOnly || (required && required.length > 0)) {
      return super.canActivate(context);
    }

    try {
      return super.canActivate(context);
    } catch (error) {
      const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
      if (request.internalPrincipal) return true;
      throw error;
    }
  }
}
