import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

interface RbacRoleFixture {
  codigo: string;
  nombre: string;
  permisos: string[];
}

interface RbacMatrixFixture {
  roles: RbacRoleFixture[];
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizePrivateKey(value: string): string {
  const unescaped = value.trim().replace(/\\n/g, '\n');

  if (unescaped.includes('BEGIN')) {
    return unescaped;
  }

  const decoded = Buffer.from(unescaped, 'base64').toString('utf8').trim();
  if (!decoded.includes('BEGIN')) {
    throw new Error('DEV_JWT_PRIVATE_KEY no es una clave PEM válida (ni base64 de una PEM).');
  }

  return decoded;
}

function fail(message: string): never {
  console.error(`dev-token: ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  fail('se niega a emitir tokens con NODE_ENV=production.');
}

if (process.env.DEV_JWT_ENABLED !== 'true') {
  fail('defina DEV_JWT_ENABLED=true para habilitar la herramienta de desarrollo.');
}

const rolCodigo = argValue('--rol');
if (!rolCodigo) {
  fail('uso: pnpm dev:token -- --rol JEFE_AREA [--empleado <uuid>] [--sub <uuid>]');
}

const empleadoId = argValue('--empleado');
if (empleadoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(empleadoId)) {
  fail('--empleado debe ser un UUID.');
}

const sub = argValue('--sub') ?? randomUUID();
const privateKeyRaw = process.env.DEV_JWT_PRIVATE_KEY;
const kid = process.env.JWT_KID;
const issuer = process.env.JWT_ISSUER;
const audience = process.env.JWT_AUDIENCE;

if (!privateKeyRaw || !kid || !issuer || !audience) {
  fail(
    'faltan DEV_JWT_PRIVATE_KEY, JWT_KID, JWT_ISSUER o JWT_AUDIENCE en el entorno.',
  );
}

if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PRIVATE_KEY === privateKeyRaw) {
  fail('DEV_JWT_PRIVATE_KEY no puede ser la misma clave que JWT_PRIVATE_KEY de ms-auth.');
}

const fixturePath = join(
  __dirname,
  '..',
  'apps',
  'api-gateway',
  'test',
  'fixtures',
  'rbac-matrix.json',
);

let fixture: RbacMatrixFixture;
try {
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as RbacMatrixFixture;
} catch {
  fail('no se encontró el fixture RBAC. Ejecute primero: pnpm rbac:export');
}

const role = fixture.roles.find((candidate) => candidate.codigo === rolCodigo);
if (!role) {
  fail(
    `rol desconocido: ${rolCodigo}. Roles disponibles: ${fixture.roles
      .map((candidate) => candidate.codigo)
      .join(', ')}`,
  );
}

const token = jwt.sign(
  {
    sub,
    empleadoId: empleadoId ?? null,
    rol: role.codigo,
    permisos: role.permisos,
  },
  normalizePrivateKey(privateKeyRaw),
  {
    algorithm: 'RS256',
    keyid: kid,
    issuer,
    audience,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  },
);

process.stdout.write(`${token}\n`);
