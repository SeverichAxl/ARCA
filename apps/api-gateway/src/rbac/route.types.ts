export type GatewayService =
  | 'auth'
  | 'personal'
  | 'vacaciones'
  | 'contratos'
  | 'planillas';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteAccess =
  | 'public'
  | 'authenticated'
  | { anyOf: string[] }
  | { allOf: string[] };

export interface RouteSpec {
  method: HttpMethod;
  path: string;
  access: RouteAccess;
}

export interface GatewayRoute extends RouteSpec {
  service: GatewayService;
}

export function defineServiceRoutes(
  service: GatewayService,
  routes: RouteSpec[],
): GatewayRoute[] {
  return routes.map((route) => ({ ...route, service }));
}
