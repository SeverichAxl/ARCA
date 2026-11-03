import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from 'common-dtos';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { Rs256TokenService } from './rs256-token.service';

const keyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
};

describe('Rs256TokenService configuración fail-closed', () => {
  it.each(['JWT_ISSUER', 'JWT_AUDIENCE', 'JWT_KID', 'JWT_PRIVATE_KEY'])(
    'falla al arrancar si falta %s',
    (missing) => {
      const keys = keyPair();
      const values: Record<string, string> = {
        JWT_PRIVATE_KEY: keys.privateKey,
        JWT_ISSUER: 'arca-auth',
        JWT_AUDIENCE: 'arca-services',
        JWT_KID: 'arca-2026-01',
      };
      delete values[missing];

      expect(() => new Rs256TokenService(new ConfigService(values))).toThrow();
    },
  );

  it('el token emitido es aceptado con la misma validación del gateway', () => {
    const keys = keyPair();
    const issuer = 'arca-auth';
    const audience = 'arca-services';
    const kid = 'arca-2026-01';
    const service = new Rs256TokenService(
      new ConfigService({
        JWT_PRIVATE_KEY: keys.privateKey,
        JWT_ISSUER: issuer,
        JWT_AUDIENCE: audience,
        JWT_KID: kid,
      }),
    );

    const token = service.signAccessToken(
      {
        sub: '00000000-0000-4000-8000-000000000001',
        empleadoId: null,
        rol: 'ADMIN_GENERAL',
        permisos: ['usuario:read'],
      },
      15,
    );

    const decoded = jwt.decode(token, { complete: true });
    expect(decoded).not.toBeNull();
    expect(typeof decoded).not.toBe('string');
    if (!decoded || typeof decoded === 'string') return;
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.header.kid).toBe(kid);

    const payload = jwt.verify(token, keys.publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience,
      clockTolerance: 5,
    }) as JwtPayload;

    expect(payload).toMatchObject({
      sub: '00000000-0000-4000-8000-000000000001',
      empleadoId: null,
      rol: 'ADMIN_GENERAL',
      permisos: ['usuario:read'],
      iss: issuer,
      aud: audience,
    });
    expect('familyId' in payload).toBe(false);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
