import * as jwt from 'jsonwebtoken';
import {
  JwtTokenService,
  JwtVerificationError,
} from '../src/modules/auth/jwt-token.service';
import {
  AUDIENCE,
  ISSUER,
  KID,
  TEST_PUBLIC_KEY,
  base64Url,
  baseClaims,
  gatewayConfig,
  signToken,
} from './helpers';

function service(): JwtTokenService {
  return new JwtTokenService(gatewayConfig());
}

function expectInvalid(fn: () => unknown): void {
  try {
    fn();
    throw new Error('debía fallar');
  } catch (error) {
    expect(error).toBeInstanceOf(JwtVerificationError);
    expect((error as JwtVerificationError).code).toBe('AUTH_TOKEN_INVALID');
  }
}

describe('JwtTokenService', () => {
  it('acepta un token RS256 válido con kid, iss, aud, exp y claims completos', () => {
    const payload = service().verify(signToken());

    expect(payload.sub).toBe(baseClaims.sub);
    expect(payload.empleadoId).toBe(baseClaims.empleadoId);
    expect(payload.rol).toBe('FUNCIONARIO');
    expect(payload.permisos).toEqual(baseClaims.permisos);
  });

  it('acepta empleadoId null', () => {
    expect(service().verify(signToken({ empleadoId: null })).empleadoId).toBeNull();
  });

  it('distingue un token vencido con AUTH_TOKEN_EXPIRED', () => {
    try {
      service().verify(signToken({}, { expiresIn: -120 }));
      throw new Error('debía fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(JwtVerificationError);
      expect((error as JwtVerificationError).code).toBe('AUTH_TOKEN_EXPIRED');
    }
  });

  it('rechaza issuer y audience incorrectos', () => {
    expectInvalid(() => service().verify(signToken({}, { issuer: 'otro-issuer' })));
    expectInvalid(() => service().verify(signToken({}, { audience: 'otra-audiencia' })));
  });

  it('exige cabecera kid', () => {
    expectInvalid(() => service().verify(signToken({}, { keyid: undefined })));
  });

  it('rechaza un kid desconocido', () => {
    expectInvalid(() => service().verify(signToken({}, { keyid: 'kid-desconocido' })));
  });

  it('rechaza una firma o payload alterados', () => {
    const token = signToken();
    const [header, payload, signature] = token.split('.');
    const alteredPayload = base64Url(
      JSON.stringify({ ...baseClaims, sub: 'otro-usuario', exp: 9_999_999_999 }),
    );

    expectInvalid(() => service().verify(`${header}.${alteredPayload}.${signature}`));
    expectInvalid(() => service().verify(`${header}.${payload}.${signature.slice(0, -2)}00`));
  });

  it('rechaza alg none', () => {
    const token = `${base64Url(
      JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' }),
    )}.${base64Url(
      JSON.stringify({ ...baseClaims, exp: Math.floor(Date.now() / 1000) + 60 }),
    )}.`;

    expectInvalid(() => service().verify(token));
  });

  it('rechaza HS256 firmado con la clave pública como secreto', () => {
    const { iss: _iss, aud: _aud, ...payload } = baseClaims;
    const token = jwt.sign(payload, TEST_PUBLIC_KEY, {
      algorithm: 'HS256',
      keyid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '15m',
    });

    expectInvalid(() => service().verify(token));
  });

  it('rechaza token ausente, mal formado y con familyId', () => {
    expectInvalid(() => service().verify(''));
    expectInvalid(() => service().verify('no-es-un-jwt'));
    expectInvalid(() => service().verify(signToken({ familyId: 'familia' })));
  });

  it('rechaza claims contractuales ausentes o mal tipados', () => {
    expectInvalid(() => service().verify(signToken({ sub: undefined })));
    expectInvalid(() => service().verify(signToken({ rol: undefined })));
    expectInvalid(() => service().verify(signToken({ permisos: undefined })));
    expectInvalid(() => service().verify(signToken({ permisos: 'no-array' })));
    expectInvalid(() => service().verify(signToken({ empleadoId: undefined })));
  });

  describe('arranque fail-closed', () => {
    it('no arranca sin JWT_ISSUER', () => {
      expect(
        () => new JwtTokenService(gatewayConfig({ JWT_ISSUER: undefined })),
      ).toThrow(/JWT_ISSUER/);
    });

    it('no arranca sin JWT_AUDIENCE', () => {
      expect(
        () => new JwtTokenService(gatewayConfig({ JWT_AUDIENCE: undefined })),
      ).toThrow(/JWT_AUDIENCE|JWT_ISSUER/);
    });

    it('no arranca sin claves públicas', () => {
      expect(
        () =>
          new JwtTokenService(
            gatewayConfig({ JWT_PUBLIC_KEYS: undefined, JWT_PUBLIC_KEY: undefined }),
          ),
      ).toThrow(/claves públicas/);
    });

    it('no arranca con una clave pública inválida', () => {
      expect(
        () =>
          new JwtTokenService(
            gatewayConfig({ JWT_PUBLIC_KEYS: JSON.stringify({ [KID]: 'no-es-pem' }) }),
          ),
      ).toThrow(/PEM válido/);
    });

    it('acepta JWT_PUBLIC_KEY + JWT_KID', () => {
      const configured = new JwtTokenService(
        gatewayConfig({
          JWT_PUBLIC_KEYS: undefined,
          JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
          JWT_KID: KID,
        }),
      );

      expect(configured.verify(signToken()).iss).toBe(ISSUER);
      expect(AUDIENCE).toBe('arca-salar');
    });
  });
});
