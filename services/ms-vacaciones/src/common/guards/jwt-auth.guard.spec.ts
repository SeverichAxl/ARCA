import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

describe('JwtAuthGuard permissions', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  function createContext(token: string): Parameters<JwtAuthGuard['canActivate']>[0] {
    const request = {
      headers: { authorization: `Bearer ${token}` },
    } as Request & { user?: { permisos: string[] } };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as Parameters<JwtAuthGuard['canActivate']>[0];
  }

  function createGuard() {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PERMISSIONS_KEY ? ['vacaciones:request'] : undefined,
    } as unknown as Reflector;
    const config = {
      get: (key: string) =>
        key === 'JWT_PUBLIC_KEY'
          ? publicKey.export({ type: 'spki', format: 'pem' }).toString()
          : undefined,
    } as unknown as ConfigService;
    return new JwtAuthGuard(reflector, config);
  }

  function tokenWithPermissions(permisos: string[]): string {
    return jwt.sign(
      {
        sub: '00000000-0000-4000-8000-000000000101',
        empleadoId: '00000000-0000-4000-8000-000000000102',
        permisos,
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '5m' },
    );
  }

  it('allows a valid token with the required permission', () => {
    expect(
      createGuard().canActivate(createContext(tokenWithPermissions(['vacaciones:request']))),
    ).toBe(true);
  });

  it('denies a valid token without the required permission', () => {
    expect(() =>
      createGuard().canActivate(createContext(tokenWithPermissions(['vacaciones:read_own']))),
    ).toThrow(ForbiddenException);
  });
});
