import { normalizeAndValidatePath } from '../src/rbac/path';
import {
  GATEWAY_ROUTES,
  matchGatewayRoute,
  permissionsSatisfy,
  serviceFromPath,
} from '../src/rbac/route-table';

describe('normalización y validación de rutas', () => {
  it('normaliza una ruta pública válida y elimina query y barra final', () => {
    expect(normalizeAndValidatePath('/api/auth/login')).toEqual({
      ok: true,
      path: '/api/auth/login',
    });
    expect(normalizeAndValidatePath('/api/auth/login/')).toEqual({
      ok: true,
      path: '/api/auth/login',
    });
    expect(normalizeAndValidatePath('/api/personal/employees?page=1')).toEqual({
      ok: true,
      path: '/api/personal/employees',
    });
  });

  it.each([
    ['/api/auth/../personal/employees', 'traversal'],
    ['/api/auth//login', 'doble_barra'],
    ['/api\\auth\\login', 'barra_invertida'],
    ['/api/auth/%2e%2e/personal', 'ruta_codificada'],
    ['/api/auth/%2Flogin', 'ruta_codificada'],
    ['/api/auth/%5clogin', 'ruta_codificada'],
    ['/api/auth/%00login', 'ruta_codificada'],
    ['/api/auth/login\0', 'byte_nulo_o_control'],
    [`/api/${'a'.repeat(3000)}`, 'longitud_invalida'],
    ['api/auth/login', 'ruta_relativa'],
  ])('rechaza %s', (path, reason) => {
    expect(normalizeAndValidatePath(path)).toEqual({ ok: false, reason });
  });
});

describe('tabla de rutas', () => {
  it('identifica el servicio dueño de la ruta', () => {
    expect(serviceFromPath('/api/auth/login')).toBe('auth');
    expect(serviceFromPath('/api/personal/employees')).toBe('personal');
    expect(serviceFromPath('/api/vacaciones/saldo')).toBe('vacaciones');
    expect(serviceFromPath('/api/contratos/x')).toBe('contratos');
    expect(serviceFromPath('/api/planillas/x')).toBe('planillas');
    expect(serviceFromPath('/api/otro/x')).toBeUndefined();
    expect(serviceFromPath('/api')).toBeUndefined();
    expect(serviceFromPath('/health')).toBeUndefined();
  });

  it('hace match exacto por método y segmentos :param', () => {
    expect(matchGatewayRoute('POST', '/api/auth/login')?.access).toBe('public');
    expect(matchGatewayRoute('GET', '/api/personal/employees/123')?.access).toEqual({
      anyOf: ['personal:read'],
    });
    expect(matchGatewayRoute('PATCH', '/api/personal/areas/123')?.access).toEqual({
      anyOf: ['catalogo:manage'],
    });
    expect(matchGatewayRoute('DELETE', '/api/auth/login')).toBeUndefined();
    expect(matchGatewayRoute('POST', '/api/personal/employees/123')).toBeUndefined();
  });

  it('no hace match con distinta capitalización', () => {
    expect(matchGatewayRoute('POST', '/api/AUTH/login')).toBeUndefined();
    expect(matchGatewayRoute('POST', '/api/auth/Login')).toBeUndefined();
  });

  it('mantiene una única declaración por método y ruta', () => {
    const keys = GATEWAY_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('evalúa anyOf y allOf', () => {
    expect(permissionsSatisfy({ anyOf: ['a', 'b'] }, ['b'])).toBe(true);
    expect(permissionsSatisfy({ anyOf: ['a', 'b'] }, ['c'])).toBe(false);
    expect(permissionsSatisfy({ allOf: ['a', 'b'] }, ['a', 'b'])).toBe(true);
    expect(permissionsSatisfy({ allOf: ['a', 'b'] }, ['a'])).toBe(false);
    expect(permissionsSatisfy('authenticated', [])).toBe(true);
  });
});
