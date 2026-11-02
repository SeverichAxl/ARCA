import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { InternalPrincipal } from './canonical';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Declara los permisos que exige un endpoint. El guard compartido exige TODOS
 * los códigos indicados y deniega por defecto si el handler no tiene ni
 * @Public() ni @RequirePermission().
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Obtiene el principal ya verificado desde la firma interna. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): InternalPrincipal | undefined =>
    context.switchToHttp().getRequest<{ internalPrincipal?: InternalPrincipal }>()
      .internalPrincipal,
);
