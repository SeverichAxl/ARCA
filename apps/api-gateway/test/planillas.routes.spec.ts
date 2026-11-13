import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchGatewayRoute, permissionsSatisfy } from '../src/rbac/route-table';

interface Fixture {
  roles: Array<{ codigo: string; permisos: string[] }>;
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'rbac-matrix.json'), 'utf8'),
) as Fixture;
const roles = new Map(fixture.roles.map((role) => [role.codigo, role.permisos]));

const ID = '7b1f3658-60e1-4f4f-b30e-4404aa5bbfd8';
const EMP = '22222222-2222-4222-8222-222222222222';

function puede(rol: string, method: string, path: string): boolean {
  const route = matchGatewayRoute(method, path);
  if (!route) throw new Error(`ruta no declarada: ${method} ${path}`);
  return permissionsSatisfy(route.access, roles.get(rol) ?? []);
}

describe('rutas RBAC de planillas (Sprint 2)', () => {
  it('las rutas estáticas no son capturadas por /:id', () => {
    expect(matchGatewayRoute('GET', '/api/planillas/mis-pagos')?.path).toBe(
      '/api/planillas/mis-pagos',
    );
    expect(matchGatewayRoute('GET', '/api/planillas/resumen')?.path).toBe('/api/planillas/resumen');
    expect(matchGatewayRoute('GET', '/api/planillas/periodos/2026-10')?.path).toBe(
      '/api/planillas/periodos/:periodo',
    );
    expect(matchGatewayRoute('GET', `/api/planillas/${ID}`)?.path).toBe('/api/planillas/:id');
  });

  it.each([
    // [rol, método, ruta, permitido]
    ['ENCARGADO_NOMINA', 'POST', '/api/planillas/periodos/2026-10/calcular', true],
    ['RRHH_OPERATIVO', 'POST', '/api/planillas/periodos/2026-10/calcular', false],
    ['ADMIN_GENERAL', 'POST', '/api/planillas/periodos/2026-10/calcular', false],
    ['ENCARGADO_NOMINA', 'POST', `/api/planillas/${ID}/cerrar`, true],
    ['GERENCIA', 'POST', `/api/planillas/${ID}/cerrar`, false],
    ['AUDITOR', 'POST', `/api/planillas/${ID}/cerrar`, false],
    ['ENCARGADO_NOMINA', 'PUT', `/api/planillas/periodos/2026-10/novedades/${EMP}`, true],
    ['FUNCIONARIO', 'PUT', `/api/planillas/periodos/2026-10/novedades/${EMP}`, false],
    ['ENCARGADO_NOMINA', 'DELETE', `/api/planillas/${ID}`, true],
    ['AUDITOR', 'DELETE', `/api/planillas/${ID}`, false],
    ['GERENCIA', 'GET', '/api/planillas', true],
    ['AUDITOR', 'GET', `/api/planillas/${ID}/detalle`, true],
    ['FUNCIONARIO', 'GET', '/api/planillas', false],
    ['JEFE_AREA', 'GET', `/api/planillas/${ID}`, false],
    ['AUDITOR', 'GET', `/api/planillas/${ID}/empleados/${EMP}`, true],
    ['RRHH_OPERATIVO', 'GET', `/api/planillas/${ID}/empleados/${EMP}`, false],
    ['FUNCIONARIO', 'GET', '/api/planillas/mis-pagos', true],
    ['JEFE_AREA', 'GET', '/api/planillas/mis-pagos/2026-10', true],
    ['GERENCIA', 'GET', '/api/planillas/resumen', true],
    ['RRHH_OPERATIVO', 'GET', '/api/planillas/resumen', true],
    ['ADMIN_GENERAL', 'GET', '/api/planillas/resumen', false],
    ['FUNCIONARIO', 'GET', '/api/planillas/resumen', false],
    ['ADMIN_GENERAL', 'GET', '/api/planillas/parametros/vigentes', true],
    ['FUNCIONARIO', 'GET', '/api/planillas/parametros/vigentes', false],
  ])('%s %s %s -> %s', (rol, method, path, esperado) => {
    expect(puede(rol, method, path)).toBe(esperado);
  });

  it('métodos no declarados quedan denegados (PATCH sobre una planilla)', () => {
    expect(matchGatewayRoute('PATCH', `/api/planillas/${ID}`)).toBeUndefined();
    expect(matchGatewayRoute('PUT', `/api/planillas/${ID}`)).toBeUndefined();
  });
});
