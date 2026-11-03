import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PERMISOS, ROLES } from '../services/ms-auth/prisma/seed';

export interface RbacMatrixFixture {
  version: 1;
  source: string;
  permisos: Array<{ codigo: string; modulo: string; descripcion: string }>;
  roles: Array<{ codigo: string; nombre: string; permisos: string[] }>;
}

export function buildRbacMatrix(): RbacMatrixFixture {
  return {
    version: 1,
    source: 'services/ms-auth/prisma/seed.ts',
    permisos: Object.entries(PERMISOS)
      .map(([codigo, [modulo, descripcion]]) => ({ codigo, modulo, descripcion }))
      .sort((left, right) => left.codigo.localeCompare(right.codigo)),
    roles: Object.entries(ROLES)
      .map(([codigo, { nombre, permisos }]) => ({
        codigo,
        nombre,
        permisos: [...new Set(permisos)].sort(),
      }))
      .sort((left, right) => left.codigo.localeCompare(right.codigo)),
  };
}

const outputPath = join(
  __dirname,
  '..',
  'apps',
  'api-gateway',
  'test',
  'fixtures',
  'rbac-matrix.json',
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(buildRbacMatrix(), null, 2)}\n`, 'utf8');

console.log(`RBAC matrix exportada en ${outputPath}`);
