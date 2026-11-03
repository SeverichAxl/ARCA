import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { TokenService } from '../../domain/auth/auth.ports';

function decodeKey(rawKey: string): string {
  return rawKey.includes('BEGIN')
    ? rawKey.replace(/\\n/g, '\n')
    : Buffer.from(rawKey, 'base64').toString('utf8');
}
@Injectable()
export class Rs256TokenService implements TokenService {
  private readonly privateKey: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    const privateKey = config.get<string>('JWT_PRIVATE_KEY');
    const issuer = config.get<string>('JWT_ISSUER');
    const audience = config.get<string>('JWT_AUDIENCE');
    const keyId = config.get<string>('JWT_KID');

    if (!privateKey) throw new Error('JWT_PRIVATE_KEY no configurada: ms-auth no arranca sin ella.');
    if (!issuer) throw new Error('JWT_ISSUER no configurado: ms-auth no arranca sin él.');
    if (!audience) throw new Error('JWT_AUDIENCE no configurada: ms-auth no arranca sin ella.');
    if (!keyId) throw new Error('JWT_KID no configurado: ms-auth no arranca sin él.');

    this.privateKey = decodeKey(privateKey);
    this.issuer = issuer;
    this.audience = audience;
    this.keyId = keyId;
  }

  signAccessToken(
    payload: { sub: string; empleadoId: string | null; rol: string; permisos: string[] },
    ttlMinutes: number,
  ): string {
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: ttlMinutes * 60,
      issuer: this.issuer,
      audience: this.audience,
      keyid: this.keyId,
    });
  }

  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
