import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Matrix {
  version: 1;
  source: string;
  permisos: Array<{ codigo: string; modulo: string; descripcion: string }>;
  roles: Array<{ codigo: string; nombre: string; permisos: string[] }>;
}

let seed: typeof import('../prisma/seed');

beforeAll(async () => {
  // El seed crea el cliente Prisma al importarse; no se conecta, pero la
  // variable debe existir para que el runtime de Prisma no falle.
  process.env.DATABASE_URL ??=
    'postgresql://fixture:fixture@localhost:5432/fixture?schema=public';
  seed = await import('../prisma/seed');
});

function expectedMatrix(): Matrix {
  return {
    version: 1,
    source: 'services/ms-auth/prisma/seed.ts',
    permisos: Object.entries(seed.PERMISOS)
      .map(([codigo, [modulo, descripcion]]) => ({ codigo, modulo, descripcion }))
      .sort((left, right) => left.codigo.localeCompare(right.codigo)),
    roles: Object.entries(seed.ROLES)
      .map(([codigo, { nombre, permisos }]) => ({
        codigo,
        nombre,
        permisos: [...new Set(permisos)].sort(),
      }))
      .sort((left, right) => left.codigo.localeCompare(right.codigo)),
  };
}

describe('fixture RBAC del gateway', () => {
  it('coincide exactamente con las exportaciones del seed', () => {
    const fixturePath = join(
      __dirname,
      '..',
      '..',
      '..',
      'apps',
      'api-gateway',
      'test',
      'fixtures',
      'rbac-matrix.json',
    );
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Matrix;
    const expected = expectedMatrix();

    expect(fixture).toEqual(expected);
    expect(fixture.permisos).toHaveLength(38);
    expect(fixture.roles).toHaveLength(7);
    expect(fixture.roles.reduce((total, role) => total + role.permisos.length, 0)).toBe(81);
  });

  it('no referencia permisos inexistentes', () => {
    const codes = new Set(Object.keys(seed.PERMISOS));

    for (const [role, definition] of Object.entries(seed.ROLES)) {
      const unknown = definition.permisos.filter((permiso) => !codes.has(permiso));
      expect({ role, unknown }).toEqual({ role, unknown: [] });
    }
  });
});
