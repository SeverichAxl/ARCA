import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export const KID = 'test-kid-2026';
export const ISSUER = 'arca-auth';
export const AUDIENCE = 'arca-salar';
export const INTERNAL_SECRET = 'test-internal-hmac-secret';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const TEST_PRIVATE_KEY = privateKey;
export const TEST_PUBLIC_KEY = publicKey;

export const baseClaims = {
  sub: '11111111-1111-4111-8111-111111111111',
  empleadoId: '22222222-2222-4222-8222-222222222222',
  rol: 'FUNCIONARIO',
  permisos: ['vacaciones:request', 'vacaciones:read_own'],
  iss: ISSUER,
  aud: AUDIENCE,
};

export function signToken(
  claims: Record<string, unknown> = {},
  options: jwt.SignOptions = {},
): string {
  const { iss, aud, ...payload } = { ...baseClaims, ...claims };
  const signOptions: jwt.SignOptions = {
    algorithm: 'RS256',
    keyid: KID,
    issuer: (options.issuer ?? iss) as string,
    audience: (options.audience ?? aud) as string,
    expiresIn: '15m',
    ...options,
  };

  // Permite firmar sin `kid` pasando `{ keyid: undefined }`, pero no pasar
  // `keyid: undefined` a jsonwebtoken (lo rechaza).
  if (Object.prototype.hasOwnProperty.call(options, 'keyid') && options.keyid === undefined) {
    delete signOptions.keyid;
  }

  return jwt.sign(payload, TEST_PRIVATE_KEY, signOptions);
}

export function gatewayConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  return new ConfigService({
    JWT_ISSUER: ISSUER,
    JWT_AUDIENCE: AUDIENCE,
    JWT_PUBLIC_KEYS: JSON.stringify({ [KID]: TEST_PUBLIC_KEY }),
    INTERNAL_HMAC_KEY: INTERNAL_SECRET,
    AUTH_SERVICE_URL: 'http://127.0.0.1:1',
    PERSONAL_SERVICE_URL: 'http://127.0.0.1:1',
    VACACIONES_SERVICE_URL: 'http://127.0.0.1:1',
    CONTRATOS_SERVICE_URL: 'http://127.0.0.1:1',
    PLANILLAS_SERVICE_URL: 'http://127.0.0.1:1',
    ...overrides,
  });
}

export function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}
