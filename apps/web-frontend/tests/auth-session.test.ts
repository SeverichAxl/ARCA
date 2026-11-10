import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';

function fakeAccessToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

test('la sesión mock expone empleadoId sin cambiar el resto de la sesión', async () => {
  const { authenticate, MOCK_EMPLOYEE_ID, ROLE_PERMISSIONS } = await import('../src/lib/auth');
  const session = await authenticate('funcionario', 'demo', 'FUNCIONARIO');

  assert.equal(session.user.empleadoId, MOCK_EMPLOYEE_ID);
  assert.equal(session.user.role, 'FUNCIONARIO');
  assert.equal(session.user.username, 'funcionario');
  assert.deepEqual(session.user.permissions, [...ROLE_PERMISSIONS.FUNCIONARIO]);
  assert.equal(session.mode, 'mock');
  assert.equal(session.tokenType, 'Bearer');
  assert.equal(typeof session.accessToken, 'string');
  assert.equal(typeof session.refreshToken, 'string');
  assert.ok(session.expiresAt > Date.now());
});

test('ADMIN_GENERAL simula un usuario sin funcionario vinculado', async () => {
  const { authenticate } = await import('../src/lib/auth');
  const session = await authenticate('admin', 'demo', 'ADMIN_GENERAL');

  assert.equal(session.user.empleadoId, null);
  assert.equal(session.user.role, 'ADMIN_GENERAL');
});

test('decodeAccessToken lee empleadoId del JWT y tolera su ausencia', async () => {
  const { decodeAccessToken } = await import('../src/lib/auth');

  const withEmployee = decodeAccessToken(
    fakeAccessToken({
      sub: 'user-1',
      rol: 'FUNCIONARIO',
      permisos: ['boleta:read_own'],
      empleadoId: '00000000-0000-4000-8000-000000000901',
      exp: 1,
    }),
  );
  assert.equal(withEmployee.empleadoId, '00000000-0000-4000-8000-000000000901');

  const withoutEmployee = decodeAccessToken(
    fakeAccessToken({
      sub: 'admin-1',
      rol: 'ADMIN_GENERAL',
      permisos: ['boleta:read_own'],
      exp: 1,
    }),
  );
  assert.equal(withoutEmployee.empleadoId, undefined);
});
