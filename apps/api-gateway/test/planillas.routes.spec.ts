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

describe('rutas RBAC de planillas (contrato TSK-ARQ-201)', () => {
  it('las rutas estáticas no son capturadas por /:id', () => {
    const ruta = (method: string, path: string) => matchGatewayRoute(method, path)?.path;
    expect(ruta('GET', '/api/planillas/historial')).toBe('/api/planillas/historial');
    expect(ruta('GET', '/api/planillas/kpis')).toBe('/api/planillas/kpis');
    expect(ruta('GET', '/api/planillas/mis-pagos')).toBe('/api/planillas/mis-pagos');
    expect(ruta('GET', '/api/planillas/parametros')).toBe('/api/planillas/parametros');
    expect(ruta('GET', '/api/planillas/parametros/vigentes')).toBe(
      '/api/planillas/parametros/vigentes',
    );
    expect(ruta('GET', `/api/planillas/${ID}`)).toBe('/api/planillas/:id');
    expect(ruta('GET', `/api/planillas/${ID}/detalles`)).toBe('/api/planillas/:id/detalles');
  });

  it.each([
    // [rol, método, ruta, permitido]
    ['ENCARGADO_NOMINA', 'POST', '/api/planillas', true],
    ['RRHH_OPERATIVO', 'POST', '/api/planillas', false],
    ['ADMIN_GENERAL', 'POST', '/api/planillas', false],
    ['ENCARGADO_NOMINA', 'POST', `/api/planillas/${ID}/recalcular`, true],
    ['GERENCIA', 'POST', `/api/planillas/${ID}/recalcular`, false],
    ['ENCARGADO_NOMINA', 'POST', `/api/planillas/${ID}/cerrar`, true],
    ['GERENCIA', 'POST', `/api/planillas/${ID}/cerrar`, false],
    ['AUDITOR', 'POST', `/api/planillas/${ID}/cerrar`, false],
    ['ENCARGADO_NOMINA', 'PUT', `/api/planillas/periodos/2026-10/novedades/${EMP}`, true],
    ['FUNCIONARIO', 'PUT', `/api/planillas/periodos/2026-10/novedades/${EMP}`, false],
    ['ENCARGADO_NOMINA', 'DELETE', `/api/planillas/${ID}`, true],
    ['AUDITOR', 'DELETE', `/api/planillas/${ID}`, false],
    ['GERENCIA', 'GET', '/api/planillas', true],
    ['AUDITOR', 'GET', `/api/planillas/${ID}/detalles`, true],
    ['AUDITOR', 'GET', '/api/planillas/historial', true],
    ['FUNCIONARIO', 'GET', '/api/planillas', false],
    ['FUNCIONARIO', 'GET', '/api/planillas/historial', false],
    ['JEFE_AREA', 'GET', `/api/planillas/${ID}`, false],
    ['AUDITOR', 'GET', `/api/planillas/${ID}/detalles/${EMP}`, true],
    ['RRHH_OPERATIVO', 'GET', `/api/planillas/${ID}/detalles/${EMP}`, false],
    ['FUNCIONARIO', 'GET', '/api/planillas/mis-pagos', true],
    ['JEFE_AREA', 'GET', '/api/planillas/mis-pagos/2026-10', true],
    ['GERENCIA', 'GET', '/api/planillas/kpis', true],
    ['RRHH_OPERATIVO', 'GET', '/api/planillas/kpis', true],
    ['JEFE_AREA', 'GET', '/api/planillas/kpis', true],
    ['ADMIN_GENERAL', 'GET', '/api/planillas/kpis', false],
    ['FUNCIONARIO', 'GET', '/api/planillas/kpis', false],
    ['ADMIN_GENERAL', 'GET', '/api/planillas/parametros', true],
    ['ENCARGADO_NOMINA', 'GET', '/api/planillas/parametros', true],
    ['ADMIN_GENERAL', 'POST', '/api/planillas/parametros', true],
    ['ADMIN_GENERAL', 'PATCH', `/api/planillas/parametros/${ID}`, true],
    ['ENCARGADO_NOMINA', 'POST', '/api/planillas/parametros', false],
    ['FUNCIONARIO', 'GET', '/api/planillas/parametros', false],
    ['ADMIN_GENERAL', 'GET', '/api/planillas/parametros/vigentes', true],
    ['FUNCIONARIO', 'GET', '/api/planillas/parametros/vigentes', false],
  ])('%s %s %s -> %s', (rol, method, path, esperado) => {
    expect(puede(rol, method, path)).toBe(esperado);
  });

  it('métodos no declarados quedan denegados (PUT/PATCH sobre una planilla)', () => {
    expect(matchGatewayRoute('PATCH', `/api/planillas/${ID}`)).toBeUndefined();
    expect(matchGatewayRoute('PUT', `/api/planillas/${ID}`)).toBeUndefined();
  });
});
