export const INTERNAL_VERSION = 'v1';
export const INTERNAL_PERMISSIONS_SEPARATOR = ',';
export const NULL_EMPLEADO_ID = '-';

export const INTERNAL_HEADER_NAMES = {
  userId: 'X-User-Id',
  empleadoId: 'X-Empleado-Id',
  rol: 'X-Rol',
  permisos: 'X-Permisos',
  timestamp: 'X-Timestamp',
  signature: 'X-Internal-Signature',
} as const;

export type InternalHeaderName =
  (typeof INTERNAL_HEADER_NAMES)[keyof typeof INTERNAL_HEADER_NAMES];

export const INTERNAL_HEADER_NAME_LIST: readonly InternalHeaderName[] = Object.values(
  INTERNAL_HEADER_NAMES,
);

export interface InternalPrincipal {
  userId: string;
  empleadoId: string | null;
  rol: string;
  permisos: string[];
}

export interface CanonicalInput {
  method: string;
  path: string;
  userId: string;
  empleadoId?: string | null;
  rol: string;
  permisos: string | string[];
  timestamp: number | string;
}

/**
 * Ruta que ve el servicio destino: sin query y sin el prefijo público `/api`.
 * Es la única función que deben usar gateway y servicios para calcular la ruta
 * firmada. El contrato de cada servicio decide si conserva el segmento del
 * servicio:
 *
 * - auth:       `/api/auth/login`             -> `/auth/login`
 * - vacaciones: `/api/vacaciones/saldo`       -> `/vacaciones/saldo`
 * - personal:   `/api/personal/employees/1`   -> `/employees/1`
 * - Servicio:   `/employees/1`                -> `/employees/1`
 */
export function internalRoutePath(rawPath: string): string {
  const [pathname] = rawPath.split('?');
  const segments = (pathname ?? '/').split('/').filter((segment) => segment.length > 0);

  if (segments[0] === 'api' && segments.length >= 2) {
    // ms-personal expone sus rutas internas sin el segmento "personal".
    if (segments[1] === 'personal') {
      segments.splice(0, 2);
    } else {
      segments.splice(0, 1);
    }
  }

  return `/${segments.join('/')}`;
}

export function normalizePermissions(permisos: readonly string[]): string[] {
  return [...new Set(permisos)].sort();
}

export function serializePermissions(permisos: readonly string[]): string {
  return normalizePermissions(permisos).join(INTERNAL_PERMISSIONS_SEPARATOR);
}

export function buildCanonicalString(input: CanonicalInput): string {
  const permisos = Array.isArray(input.permisos)
    ? serializePermissions(input.permisos)
    : input.permisos;

  return [
    INTERNAL_VERSION,
    input.method.toUpperCase(),
    internalRoutePath(input.path),
    input.userId,
    input.empleadoId ?? NULL_EMPLEADO_ID,
    input.rol,
    permisos,
    String(input.timestamp),
  ].join('\n');
}
