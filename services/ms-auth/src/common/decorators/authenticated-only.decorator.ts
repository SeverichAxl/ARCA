import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'arca:auth:authenticated-only';

/**
 * Exige una cabecera interna firmada válida pero no un permiso RBAC concreto.
 * Solo se usa en operaciones de sesión propia, como el logout.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
