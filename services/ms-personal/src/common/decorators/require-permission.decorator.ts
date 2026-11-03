import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Declara los permisos requeridos; JwtAuthGuard los verifica contra el JWT. */
export const RequirePermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export { RequirePermission, PERMISSIONS_KEY } from '@arca/internal-auth';
