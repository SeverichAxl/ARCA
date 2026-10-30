import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declara los permisos requeridos para acceder a un endpoint.
 * TODO(RBAC): la verificación real de permisos se implementará en una historia posterior.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
