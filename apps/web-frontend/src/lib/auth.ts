export const AUTH_SESSION_KEY = 'arca.auth.session';
export const AUTH_NOTICE_KEY = 'arca.auth.notice';

export const ROLE_PERMISSIONS = {
  ADMIN_GENERAL: [
    'usuario:create',
    'usuario:read',
    'usuario:update',
    'usuario:assign_role',
    'sistema:config',
    'parametros_ley:update',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  RRHH_OPERATIVO: [
    'personal:create',
    'personal:read',
    'personal:read_salary',
    'personal:update',
    'personal:ratify',
    'personal:baja',
    'personal:inamovilidad',
    'catalogo:manage',
    'organigrama:read',
    'vacaciones:read_all',
    'vacaciones:approve_rrhh',
    'vacaciones:excepcion_resolve',
    'licencias:manage',
    'vacaciones:config',
    'contrato:template_manage',
    'contrato:generate',
    'contrato:read',
    'dashboard:read',
    'export:data',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  ENCARGADO_NOMINA: [
    'personal:read',
    'personal:read_salary',
    'planilla:calculate',
    'planilla:close',
    'boleta:issue',
    'boleta:read_all',
    'planilla:read',
    'dashboard:read',
    'export:data',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  JEFE_AREA: [
    'organigrama:read',
    'vacaciones:read_area',
    'vacaciones:approve_jefe',
    'dashboard:read_area',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  FUNCIONARIO: [
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  GERENCIA: [
    'personal:read',
    'organigrama:read',
    'vacaciones:read_all',
    'vacaciones:excepcion_resolve',
    'contrato:read',
    'planilla:read',
    'dashboard:read',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
  AUDITOR: [
    'auditoria:read',
    'personal:read',
    'organigrama:read',
    'vacaciones:read_all',
    'contrato:read',
    'boleta:read_all',
    'planilla:read',
    'dashboard:read',
    'vacaciones:request',
    'vacaciones:read_own',
    'contrato:download_own',
    'boleta:read_own',
  ],
} as const;

export type RoleCode = keyof typeof ROLE_PERMISSIONS;

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN_GENERAL: 'Administrador General',
  RRHH_OPERATIVO: 'Gestión Humana',
  ENCARGADO_NOMINA: 'Encargado de Nómina',
  JEFE_AREA: 'Jefe de Área',
  FUNCIONARIO: 'Funcionario',
  GERENCIA: 'Gerencia / Directorio',
  AUDITOR: 'Auditor',
};

export const ROUTE_ROLES: Record<string, readonly RoleCode[]> = {
  '/usuarios': ['ADMIN_GENERAL'],
  '/auditoria': ['AUDITOR'],
};

export const ROUTE_PERMISSIONS: Record<string, readonly string[]> = {
  '/dashboard': ['dashboard:read', 'dashboard:read_area'],
  '/personal': ['personal:read', 'personal:read_salary'],
  '/organigrama': ['organigrama:read'],
  '/areas-cargos': ['catalogo:manage'],
  '/vacaciones': [
    'vacaciones:request',
    'vacaciones:read_own',
    'vacaciones:read_area',
    'vacaciones:read_all',
    'vacaciones:approve_jefe',
    'vacaciones:approve_rrhh',
    'vacaciones:excepcion_resolve',
    'vacaciones:config',
    'licencias:manage',
  ],
  '/contratos': [
    'contrato:read',
    'contrato:generate',
    'contrato:template_manage',
    'contrato:download_own',
  ],
  '/boletas': ['boleta:read_all', 'boleta:read_own', 'boleta:issue'],
  '/usuarios': ['usuario:read', 'usuario:create', 'usuario:update', 'usuario:assign_role'],
  '/auditoria': ['auditoria:read'],
  '/personal/nuevo': ['personal:create'],
  '/personal/:id': ['personal:read'],
  '/personal/:id/modificar': ['personal:update'],
  '/personal/:id/baja': ['personal:baja'],
};

export function getRoutePermissions(pathname: string): readonly string[] | undefined {
  const directPermissions = ROUTE_PERMISSIONS[pathname];
  if (directPermissions) return directPermissions;

  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'personal' || segments.length < 2) return undefined;
  if (segments[1] === 'nuevo' && segments.length === 2) {
    return ROUTE_PERMISSIONS['/personal/nuevo'];
  }
  if (segments.length === 2) return ROUTE_PERMISSIONS['/personal/:id'];
  if (segments.length === 3 && segments[2] === 'modificar') {
    return ROUTE_PERMISSIONS['/personal/:id/modificar'];
  }
  if (segments.length === 3 && segments[2] === 'baja') {
    return ROUTE_PERMISSIONS['/personal/:id/baja'];
  }
  return undefined;
}

const configuredAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase();
export const AUTH_MODE =
  configuredAuthMode === 'mock'
    ? 'mock'
    : configuredAuthMode === 'api' || configuredAuthMode === 'default'
      ? 'api'
      : process.env.NODE_ENV === 'development'
        ? 'mock'
        : 'api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresAt: number;
  user: {
    id: string;
    username: string;
    role: RoleCode;
    permissions: string[];
  };
  mode: 'mock' | 'api';
}

interface TokenClaims {
  sub?: string;
  rol?: string;
  permisos?: unknown;
  exp?: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

function decodeAccessToken(token: string): TokenClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('El servidor devolvió un access token inválido.');

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return JSON.parse(decoded) as TokenClaims;
  } catch {
    throw new Error('No se pudieron leer el rol y los permisos del access token.');
  }
}

function createSession(
  tokens: TokenResponse,
  username: string,
  mode: AuthSession['mode'],
): AuthSession {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('La respuesta de autenticación no contiene ambos tokens.');
  }

  const claims = decodeAccessToken(tokens.accessToken);
  if (!claims.rol || !Object.hasOwn(ROLE_PERMISSIONS, claims.rol)) {
    throw new Error('El usuario tiene un rol no reconocido por esta versión del frontend.');
  }
  if (!Array.isArray(claims.permisos) || !claims.permisos.every((item) => typeof item === 'string')) {
    throw new Error('El access token no contiene una lista de permisos válida.');
  }

  const role = claims.rol as RoleCode;
  const expiresAt =
    typeof claims.exp === 'number'
      ? claims.exp * 1000
      : Date.now() + Math.max(tokens.expiresIn ?? 0, 1) * 1000;

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: 'Bearer',
    expiresAt,
    user: {
      id: claims.sub ?? username,
      username,
      role,
      permissions: claims.permisos,
    },
    mode,
  };
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createMockTokens(username: string, role: RoleCode): TokenResponse {
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: `mock-${role.toLowerCase()}`,
      rol: role,
      permisos: ROLE_PERMISSIONS[role],
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  return {
    accessToken: `eyJhbGciOiJub25lIn0.${payload}.mock`,
    refreshToken: `mock-refresh-${role}-${username}-${crypto.randomUUID()}`,
    tokenType: 'Bearer',
    expiresIn: 60,
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; code?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message) && body.message.every((item) => typeof item === 'string')) {
      return body.message.join(' ');
    }
    if (typeof body.code === 'string') return `Error de autenticación: ${body.code}.`;
  } catch {
    return `El servidor rechazó la solicitud (${response.status}).`;
  }
  return `El servidor rechazó la solicitud (${response.status}).`;
}

async function authRequest(path: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}/api/auth/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `No se pudo conectar con el módulo de autenticación en ${API_BASE_URL}. Verifica que esté activo y que CORS permita el frontend.`,
      );
    }
    throw error;
  }
}

export async function authenticatedApiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  try {
    const headers = new Headers(options.headers);
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      headers.delete('Content-Type');
    } else if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Authorization', `Bearer ${accessToken}`);

    return await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `No se pudo conectar con el API Gateway en ${API_BASE_URL}. Verifica que esté activo y que CORS permita el frontend.`,
      );
    }
    throw error;
  }
}

export async function authenticate(
  username: string,
  password: string,
  mockRole?: RoleCode,
): Promise<AuthSession> {
  if (AUTH_MODE === 'mock') {
    if (!mockRole) throw new Error('Selecciona el rol que quieres probar en modo mock.');
    return createSession(createMockTokens(username, mockRole), username, 'mock');
  }

  const response = await authRequest('login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return createSession((await response.json()) as TokenResponse, username, 'api');
}

export async function refreshAuthentication(session: AuthSession): Promise<AuthSession> {
  if (session.mode === 'mock') {
    return createSession(
      createMockTokens(session.user.username, session.user.role),
      session.user.username,
      'mock',
    );
  }

  const response = await authRequest('refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return createSession(
    (await response.json()) as TokenResponse,
    session.user.username,
    'api',
  );
}

export async function revokeAuthentication(session: AuthSession): Promise<void> {
  if (session.mode === 'mock') return;

  const response = await authRequest('logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
}

export function readStoredSession(): AuthSession | null {
  const rawSession = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!rawSession) return null;

  const stored = JSON.parse(rawSession) as AuthSession;
  const restored = createSession(
    {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
    },
    stored.user.username,
    stored.mode,
  );
  return restored.mode === AUTH_MODE ? restored : null;
}

export function hasAnyPermission(
  permissions: readonly string[],
  allowedPermissions: readonly string[],
): boolean {
  return allowedPermissions.some((permission) => permissions.includes(permission));
}
