'use client';

import { useAuth } from '@/components/auth/auth-provider';

/**
 * Comodidad de UI: oculta acciones que el usuario no puede ejecutar.
 *
 * El servidor es quien protege de verdad cada endpoint (gateway + servicio).
 * Nunca uses este componente como única defensa de seguridad.
 */
export function PermissionGate({
  anyOf,
  allOf,
  children,
  fallback = null,
}: {
  anyOf?: readonly string[];
  allOf?: readonly string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session } = useAuth();
  const permissions = session?.user.permissions ?? [];

  const hasAny = !anyOf?.length || anyOf.some((permission) => permissions.includes(permission));
  const hasAll = !allOf?.length || allOf.every((permission) => permissions.includes(permission));

  return hasAny && hasAll ? <>{children}</> : <>{fallback}</>;
}

/** Variante pura, útil para pruebas y para calcular menús. */
export function hasPermissions(
  permissions: readonly string[],
  options: { anyOf?: readonly string[]; allOf?: readonly string[] },
): boolean {
  const hasAny =
    !options.anyOf?.length ||
    options.anyOf.some((permission) => permissions.includes(permission));
  const hasAll =
    !options.allOf?.length ||
    options.allOf.every((permission) => permissions.includes(permission));
  return hasAny && hasAll;
}
