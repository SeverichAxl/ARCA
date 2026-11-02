import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from 'common-dtos';
import * as jwt from 'jsonwebtoken';
import { createPublicKey } from 'node:crypto';
import { isPlaceholder, normalizePem } from './pem';

export type AuthTokenErrorCode = 'AUTH_TOKEN_EXPIRED' | 'AUTH_TOKEN_INVALID';

export class JwtVerificationError extends Error {
  constructor(readonly code: AuthTokenErrorCode) {
    super(code);
    this.name = 'JwtVerificationError';
  }
}

@Injectable()
export class JwtTokenService {
  private readonly publicKeys = new Map<string, string>();
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly configService: ConfigService) {
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');

    if (!issuer || !audience) {
      throw new Error(
        'JWT_ISSUER y JWT_AUDIENCE son obligatorios: el gateway no arranca sin ellos.',
      );
    }

    this.issuer = issuer;
    this.audience = audience;
    this.loadPublicKeys();
  }

  verify(token: string): JwtPayload {
    if (!token) {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    let decoded: jwt.Jwt | null;
    try {
      decoded = jwt.decode(token, { complete: true });
    } catch {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    if (!decoded || typeof decoded === 'string') {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    const header = decoded.header as jwt.JwtHeader & { kid?: unknown };
    const kid = header.kid;

    // Solo RS256. Esto rechaza alg=none, HS256 y la confusión de algoritmo
    // usando la clave pública como secreto.
    if (header.alg !== 'RS256' || typeof kid !== 'string' || kid.length === 0) {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    const publicKey = this.publicKeys.get(kid);
    if (!publicKey) {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    let payload: JwtPayload | string;
    try {
      payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: 5,
      }) as JwtPayload | string;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new JwtVerificationError('AUTH_TOKEN_EXPIRED');
      }
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    this.assertContract(payload);
    return payload;
  }

  private loadPublicKeys(): void {
    const rawMap = this.configService.get<string>('JWT_PUBLIC_KEYS');

    if (rawMap && rawMap.trim().length > 0) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMap);
      } catch {
        throw new Error('JWT_PUBLIC_KEYS debe ser un JSON válido { kid: PEM }.');
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JWT_PUBLIC_KEYS debe ser un objeto JSON { kid: PEM }.');
      }

      for (const [kid, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error(`JWT_PUBLIC_KEYS tiene un valor inválido para kid ${kid}.`);
        }
        this.publicKeys.set(kid, this.validatePublicKey(value, kid));
      }
    } else {
      const publicKey = this.configService.get<string>('JWT_PUBLIC_KEY');
      const kid = this.configService.get<string>('JWT_KID');

      if (isPlaceholder(publicKey) || !kid) {
        throw new Error(
          'Configure JWT_PUBLIC_KEYS o JWT_PUBLIC_KEY + JWT_KID: el gateway no arranca sin claves públicas.',
        );
      }

      this.publicKeys.set(kid, this.validatePublicKey(publicKey as string, kid));
    }

    if (this.publicKeys.size === 0) {
      throw new Error('No hay claves públicas JWT configuradas.');
    }
  }

  private validatePublicKey(value: string, kid: string): string {
    const pem = normalizePem(value);

    try {
      createPublicKey(pem);
    } catch {
      throw new Error(`La clave pública JWT del kid ${kid} no es un PEM válido.`);
    }

    return pem;
  }

  private assertContract(payload: JwtPayload | string): asserts payload is JwtPayload {
    if (!payload || typeof payload === 'string') {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    const candidate = payload as unknown as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(candidate, 'familyId')) {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }

    const permisos = candidate.permisos;
    const empleadoId = candidate.empleadoId;

    if (
      typeof candidate.sub !== 'string' ||
      candidate.sub.length === 0 ||
      typeof candidate.rol !== 'string' ||
      candidate.rol.length === 0 ||
      !Array.isArray(permisos) ||
      permisos.some((permiso) => typeof permiso !== 'string') ||
      !(empleadoId === null || typeof empleadoId === 'string') ||
      typeof candidate.exp !== 'number' ||
      !Number.isFinite(candidate.exp) ||
      candidate.iss !== this.issuer ||
      candidate.aud !== this.audience
    ) {
      throw new JwtVerificationError('AUTH_TOKEN_INVALID');
    }
  }
}
