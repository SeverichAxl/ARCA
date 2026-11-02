import type { GatewayRoute, GatewayService, HttpMethod, RouteAccess } from './route.types';
import { AUTH_ROUTES } from './routes/auth.routes';
import { CONTRATOS_ROUTES } from './routes/contratos.routes';
import { PERSONAL_ROUTES } from './routes/personal.routes';
import { PLANILLAS_ROUTES } from './routes/planillas.routes';
import { VACACIONES_ROUTES } from './routes/vacaciones.routes';

export const GATEWAY_ROUTES: readonly GatewayRoute[] = [
  ...AUTH_ROUTES,
  ...PERSONAL_ROUTES,
  ...VACACIONES_ROUTES,
  ...CONTRATOS_ROUTES,
  ...PLANILLAS_ROUTES,
];

const SERVICE_NAMES: readonly GatewayService[] = [
  'auth',
  'personal',
  'vacaciones',
  'contratos',
  'planillas',
];

const SERVICE_NAME_SET = new Set<string>(SERVICE_NAMES);

interface CompiledRoute {
  route: GatewayRoute;
  segments: readonly string[];
  staticSegments: number;
}

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

function compile(route: GatewayRoute): CompiledRoute {
  const segments = splitPath(route.path);
  return {
    route,
    segments,
    staticSegments: segments.filter((segment) => !segment.startsWith(':')).length,
  };
}

const COMPILED_ROUTES: readonly CompiledRoute[] = GATEWAY_ROUTES.map(compile).sort(
  (left, right) => right.staticSegments - left.staticSegments,
);

function segmentsMatch(pattern: readonly string[], candidate: readonly string[]): boolean {
  if (pattern.length !== candidate.length) {
    return false;
  }

  return pattern.every((segment, index) =>
    segment.startsWith(':') ? candidate[index].length > 0 : segment === candidate[index],
  );
}

export function matchGatewayRoute(
  method: string,
  path: string,
): GatewayRoute | undefined {
  const normalizedMethod = method.toUpperCase() as HttpMethod;
  const candidate = splitPath(path);

  return COMPILED_ROUTES.find(
    ({ route, segments }) =>
      route.method === normalizedMethod && segmentsMatch(segments, candidate),
  )?.route;
}

/** Servicio al que pertenece una ruta pública, o undefined si no es /api/<servicio>. */
export function serviceFromPath(path: string): GatewayService | undefined {
  const [first, second] = splitPath(path);

  if (first !== 'api' || second === undefined || !SERVICE_NAME_SET.has(second)) {
    return undefined;
  }

  return second as GatewayService;
}

/** Indica si el conjunto de permisos satisface el acceso de la ruta ya autenticada. */
export function permissionsSatisfy(
  access: RouteAccess,
  permisos: readonly string[],
): boolean {
  if (access === 'public' || access === 'authenticated') {
    return true;
  }

  if ('allOf' in access) {
    return access.allOf.every((permiso) => permisos.includes(permiso));
  }

  return access.anyOf.some((permiso) => permisos.includes(permiso));
}
