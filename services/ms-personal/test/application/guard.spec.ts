import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';
import { PERMISSIONS_KEY } from '../../src/common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const permisosPorRol = {
  RRHH_OPERATIVO: [
    'personal:create',
    'personal:read',
    'personal:read_salary',
    'personal:update',
    'personal:ratify',
    'personal:baja',
  ],
  ADMIN_GENERAL: ['usuario:create', 'usuario:read', 'usuario:update', 'usuario:assign_role'],
  GERENCIA: ['personal:read', 'organigrama:read'],
};

function contexto(authToken: string, handler: () => void) {
  const request = { headers: { authorization: `Bearer ${authToken}` } };
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function crearToken(rol: keyof typeof permisosPorRol) {
  return jwt.sign(
    { sub: 'u1', empleadoId: 'e1', rol, permisos: permisosPorRol[rol] },
    privateKey,
    { algorithm: 'RS256', expiresIn: 60 },
  );
}

describe('JwtAuthGuard y permisos', () => {
  const guard = new JwtAuthGuard(
    new Reflector(),
    new ConfigService({ JWT_PUBLIC_KEY: publicKey }),
  );
  const ratificar = () => undefined;
  const sinPermiso = () => undefined;
  Reflect.defineMetadata(PERMISSIONS_KEY, ['personal:ratify'], ratificar);

  it('permite a RRHH_OPERATIVO ratificar', () => {
    expect(guard.canActivate(contexto(crearToken('RRHH_OPERATIVO'), ratificar))).toBe(true);
  });

  it.each(['ADMIN_GENERAL', 'GERENCIA'] as const)('%s recibe 403 al ratificar', (rol) => {
    expect(() => guard.canActivate(contexto(crearToken(rol), ratificar))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('deniega por defecto endpoints sin permiso declarado', () => {
    expect(() => guard.canActivate(contexto(crearToken('RRHH_OPERATIVO'), sinPermiso))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('rechaza tokens inválidos con 401', () => {
    expect(() => guard.canActivate(contexto('xxx', ratificar))).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });
});
