import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRATOS_PLANTILLAS_PERMISSIONS,
  getRoutePermissions,
  hasAnyPermission,
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
  type RoleCode,
} from '../src/lib/auth';
import { hasPermissions } from '../src/components/shared/permission-gate';

const ROLES: RoleCode[] = [
  'ADMIN_GENERAL',
  'RRHH_OPERATIVO',
  'ENCARGADO_NOMINA',
  'JEFE_AREA',
  'FUNCIONARIO',
  'GERENCIA',
  'AUDITOR',
];

interface ExpectedAccess {
  visible: boolean;
  canManage: boolean;
}

const EXPECTED: Record<RoleCode, ExpectedAccess> = {
  ADMIN_GENERAL: { visible: false, canManage: false },
  RRHH_OPERATIVO: { visible: true, canManage: true },
  ENCARGADO_NOMINA: { visible: false, canManage: false },
  JEFE_AREA: { visible: false, canManage: false },
  FUNCIONARIO: { visible: false, canManage: false },
  GERENCIA: { visible: false, canManage: false },
  AUDITOR: { visible: false, canManage: false },
};

test('los 7 roles del seed tienen visibilidad y edición esperadas', () => {
  for (const role of ROLES) {
    const permissions: readonly string[] = ROLE_PERMISSIONS[role];
    const visible = hasAnyPermission(permissions, CONTRATOS_PLANTILLAS_PERMISSIONS);
    const canManage = permissions.includes('contrato:template_manage');

    assert.deepEqual(
      { visible, canManage },
      EXPECTED[role],
      `Rol ${role} con acceso inesperado`,
    );
  }
});

test('menú: la entrada de plantillas solo es visible para RRHH_OPERATIVO', () => {
  for (const role of ROLES) {
    const permissions: readonly string[] = ROLE_PERMISSIONS[role];
    const visible = hasAnyPermission(permissions, ROUTE_PERMISSIONS['/contratos/plantillas']);

    assert.equal(
      visible,
      EXPECTED[role].visible,
      `Rol ${role} con visibilidad de menú inesperada`,
    );
  }
});

test('solo RRHH_OPERATIVO puede crear y editar plantillas', () => {
  const managers = ROLES.filter((role) => {
    const permissions: readonly string[] = ROLE_PERMISSIONS[role];
    return permissions.includes('contrato:template_manage');
  });
  assert.deepEqual(managers, ['RRHH_OPERATIVO']);
});

test('contrato:read por sí solo no habilita las plantillas', () => {
  for (const role of ['GERENCIA', 'AUDITOR'] as const) {
    const permissions: readonly string[] = ROLE_PERMISSIONS[role];
    assert.ok(permissions.includes('contrato:read'));
    assert.equal(permissions.includes('contrato:template_manage'), false);
    assert.equal(hasAnyPermission(permissions, CONTRATOS_PLANTILLAS_PERMISSIONS), false);
  }
  assert.equal(
    (CONTRATOS_PLANTILLAS_PERMISSIONS as readonly string[]).includes('contrato:read'),
    false,
  );
});

test('contrato:generate permite listar y abrir plantillas en modo lectura', () => {
  const permissions = ['contrato:generate'];

  assert.equal(hasAnyPermission(permissions, CONTRATOS_PLANTILLAS_PERMISSIONS), true);
  assert.equal(permissions.includes('contrato:template_manage'), false);
});

test('PermissionGate anyOf/allOf resuelve permisos correctamente', () => {
  const permissions = ['contrato:generate'];

  assert.equal(
    hasPermissions(permissions, {
      anyOf: ['contrato:generate', 'contrato:template_manage'],
    }),
    true,
  );
  assert.equal(
    hasPermissions(permissions, { anyOf: ['contrato:template_manage'] }),
    false,
  );
  assert.equal(
    hasPermissions(permissions, {
      allOf: ['contrato:generate', 'contrato:template_manage'],
    }),
    false,
  );
  assert.equal(
    hasPermissions(['contrato:generate', 'contrato:template_manage'], {
      allOf: ['contrato:generate', 'contrato:template_manage'],
    }),
    true,
  );
});

test('getRoutePermissions cubre lista, creación y editor de plantillas', () => {
  const expected = [...CONTRATOS_PLANTILLAS_PERMISSIONS];

  assert.deepEqual(getRoutePermissions('/contratos/plantillas'), expected);
  assert.deepEqual(getRoutePermissions('/contratos/plantillas/nueva'), expected);
  assert.deepEqual(
    getRoutePermissions('/contratos/plantillas/11111111-1111-4111-8111-111111111101'),
    expected,
  );
});

test('los permisos usados por las plantillas existen en el seed', () => {
  const allSeedPermissions = new Set<string>(
    Object.values(ROLE_PERMISSIONS).flatMap((permissions) => [...permissions]),
  );

  for (const permission of CONTRATOS_PLANTILLAS_PERMISSIONS) {
    assert.ok(allSeedPermissions.has(permission), `Permiso inexistente: ${permission}`);
  }
});

test('Mis boletas usa solo boleta:read_own y no boleta:read_all', () => {
  assert.deepEqual(getRoutePermissions('/boletas/mis-boletas'), ['boleta:read_own']);
  assert.equal(
    (ROUTE_PERMISSIONS['/boletas/mis-boletas'] as readonly string[]).includes(
      'boleta:read_all',
    ),
    false,
  );
});

test('los 7 roles del seed ven la entrada de Mis boletas', () => {
  for (const role of ROLES) {
    const permissions: readonly string[] = ROLE_PERMISSIONS[role];
    assert.ok(
      permissions.includes('boleta:read_own'),
      `Rol ${role} sin boleta:read_own en el seed`,
    );
    assert.equal(
      hasAnyPermission(permissions, ROUTE_PERMISSIONS['/boletas/mis-boletas']),
      true,
      `Rol ${role} sin visibilidad en el menú de Mis boletas`,
    );
  }
});

test('la pantalla de todas las boletas sigue separada de Mis boletas', () => {
  assert.notDeepEqual(
    [...ROUTE_PERMISSIONS['/boletas']],
    [...ROUTE_PERMISSIONS['/boletas/mis-boletas']],
  );
});
