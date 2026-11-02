import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RouteAccess } from '../src/rbac/route.types';
import {
  GATEWAY_ROUTES,
  matchGatewayRoute,
  permissionsSatisfy,
} from '../src/rbac/route-table';

interface RbacMatrixFixture {
  permisos: Array<{ codigo: string }>;
  roles: Array<{ codigo: string; permisos: string[] }>;
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'rbac-matrix.json'), 'utf8'),
) as RbacMatrixFixture;

const roles = new Map(fixture.roles.map((role) => [role.codigo, role.permisos]));
const permissionCodes = new Set(fixture.permisos.map((permiso) => permiso.codigo));

function expectedDecision(access: RouteAccess, permisos: readonly string[]): boolean {
  if (access === 'public' || access === 'authenticated') {
    return true;
  }

  if ('allOf' in access) {
    return access.allOf.every((permiso) => permisos.includes(permiso));
  }

  return access.anyOf.some((permiso) => permisos.includes(permiso));
}

function allowed(role: string, method: string, path: string): boolean {
  const route = matchGatewayRoute(method, path);
  if (!route) {
    throw new Error(`ruta no declarada: ${method} ${path}`);
  }

  return permissionsSatisfy(route.access, roles.get(role) ?? []);
}

describe('matriz RBAC como fixture', () => {
  it('contiene los 7 roles y 38 permisos del seed', () => {
    expect(fixture.roles).toHaveLength(7);
    expect(fixture.permisos).toHaveLength(38);
    expect(fixture.roles.reduce((total, role) => total + role.permisos.length, 0)).toBe(81);
  });

  it('todo permiso usado en la tabla existe en el seed', () => {
    const used = new Set<string>();

    for (const route of GATEWAY_ROUTES) {
      if (route.access === 'public' || route.access === 'authenticated') {
        continue;
      }
      const permisos = 'allOf' in route.access ? route.access.allOf : route.access.anyOf;
      permisos.forEach((permiso) => used.add(permiso));
    }

    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((permiso) => !permissionCodes.has(permiso))).toEqual([]);
  });

  it('barrido exhaustivo: 7 roles x cada ruta de la tabla', () => {
    expect(fixture.roles.length).toBe(7);
    expect(GATEWAY_ROUTES.length).toBeGreaterThan(40);

    for (const role of fixture.roles) {
      for (const route of GATEWAY_ROUTES) {
        const actual = permissionsSatisfy(route.access, role.permisos);
        const expected = expectedDecision(route.access, role.permisos);

        expect({
          role: role.codigo,
          route: `${route.method} ${route.path}`,
          actual,
        }).toEqual({
          role: role.codigo,
          route: `${route.method} ${route.path}`,
          actual: expected,
        });
      }
    }
  });

  describe('tabla de verdad escrita a mano (casos críticos de docs/api)', () => {
    it('ADMIN_GENERAL no crea empleados ni consulta expedientes/sueldos', () => {
      expect(allowed('ADMIN_GENERAL', 'POST', '/api/personal/employees')).toBe(false);
      expect(allowed('ADMIN_GENERAL', 'GET', '/api/personal/employees')).toBe(false);
      expect(allowed('ADMIN_GENERAL', 'GET', '/api/personal/employees/x')).toBe(false);
      expect(allowed('ADMIN_GENERAL', 'GET', '/api/personal/employees/x/historial')).toBe(
        false,
      );
    });

    it('FUNCIONARIO no lee la auditoría y solo AUDITOR puede hacerlo', () => {
      expect(allowed('FUNCIONARIO', 'GET', '/api/auth/auditoria')).toBe(false);

      for (const role of fixture.roles) {
        expect({
          role: role.codigo,
          allowed: allowed(role.codigo, 'GET', '/api/auth/auditoria'),
        }).toEqual({ role: role.codigo, allowed: role.codigo === 'AUDITOR' });
      }
    });

    it('solo RRHH_OPERATIVO ratifica funcionarios', () => {
      for (const role of fixture.roles) {
        expect({
          role: role.codigo,
          allowed: allowed(role.codigo, 'POST', '/api/personal/employees/x/ratificar'),
        }).toEqual({ role: role.codigo, allowed: role.codigo === 'RRHH_OPERATIVO' });
      }
    });

    it('ENCARGADO_NOMINA no aprueba vacaciones en ningún nivel', () => {
      expect(
        allowed('ENCARGADO_NOMINA', 'POST', '/api/vacaciones/solicitudes/x/aprobar-jefe'),
      ).toBe(false);
      expect(
        allowed('ENCARGADO_NOMINA', 'POST', '/api/vacaciones/solicitudes/x/aprobar-rrhh'),
      ).toBe(false);
      // Puede listar sus propias solicitudes (`vacaciones:read_own`); el
      // servicio restringe la vista, no el gateway.
      expect(allowed('ENCARGADO_NOMINA', 'GET', '/api/vacaciones/solicitudes')).toBe(true);
    });

    it('JEFE_AREA aprueba nivel jefe pero no nivel RRHH', () => {
      expect(
        allowed('JEFE_AREA', 'POST', '/api/vacaciones/solicitudes/x/aprobar-jefe'),
      ).toBe(true);
      expect(
        allowed('JEFE_AREA', 'POST', '/api/vacaciones/solicitudes/x/aprobar-rrhh'),
      ).toBe(false);
    });

    it('GERENCIA y RRHH_OPERATIVO resuelven excepciones', () => {
      expect(
        allowed('GERENCIA', 'POST', '/api/vacaciones/excepciones/x/resolver'),
      ).toBe(true);
      expect(
        allowed('RRHH_OPERATIVO', 'POST', '/api/vacaciones/excepciones/x/resolver'),
      ).toBe(true);
      expect(
        allowed('JEFE_AREA', 'POST', '/api/vacaciones/excepciones/x/resolver'),
      ).toBe(false);
      expect(
        allowed('ADMIN_GENERAL', 'POST', '/api/vacaciones/excepciones/x/resolver'),
      ).toBe(false);
    });

    it('crear usuarios exige usuario:create y usuario:assign_role', () => {
      expect(allowed('ADMIN_GENERAL', 'POST', '/api/auth/usuarios')).toBe(true);
      expect(allowed('RRHH_OPERATIVO', 'POST', '/api/auth/usuarios')).toBe(false);
      expect(allowed('AUDITOR', 'POST', '/api/auth/usuarios')).toBe(false);
    });

    it('el funcionario conserva acceso a sus propios recursos', () => {
      expect(allowed('FUNCIONARIO', 'POST', '/api/vacaciones/solicitudes')).toBe(true);
      expect(allowed('FUNCIONARIO', 'GET', '/api/vacaciones/saldo')).toBe(true);
      expect(allowed('FUNCIONARIO', 'GET', '/api/vacaciones/solicitudes')).toBe(true);
    });
  });
});
