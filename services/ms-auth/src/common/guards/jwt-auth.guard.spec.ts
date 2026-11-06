import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  signInternalHeaders,
  type InternalPrincipal,
} from '@arca/internal-auth';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated-only.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'secreto-interno-de-prueba';

const principal: InternalPrincipal = {
  userId: '00000000-0000-4000-8000-000000000001',
  empleadoId: null,
  rol: 'ADMIN_GENERAL',
  permisos: [],
};

function reflectorFor(metadata: {
  authenticatedOnly?: boolean;
  required?: string[];
}): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === AUTHENTICATED_ONLY_KEY) return metadata.authenticatedOnly;
      if (key === PERMISSIONS_KEY) return metadata.required;
      return undefined;
    }),
  } as unknown as Reflector;
}

function contextFor(headers: Record<string, string>): ExecutionContext {
  const request = {
    method: 'POST',
    path: '/auth/logout',
    headers,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guard(metadata: { authenticatedOnly?: boolean; required?: string[] }) {
  return new JwtAuthGuard(
    reflectorFor(metadata),
    new ConfigService({ INTERNAL_HMAC_KEY: SECRET }),
  );
}

describe('JwtAuthGuard', () => {
  it('permite logout con firma válida aunque el permiso sea vacío', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'POST',
      path: '/auth/logout',
      principal,
    });

    expect(guard({ authenticatedOnly: true }).canActivate(contextFor(headers))).toBe(true);
  });

  it('rechaza logout sin firma aunque sea AuthenticatedOnly', () => {
    let caught: unknown;
    try {
      guard({ authenticatedOnly: true }).canActivate(contextFor({}));
    } catch (error) {
      caught = error;
    }
    expect((caught as { getStatus: () => number } | undefined)?.getStatus()).toBe(401);
  });

  it('sigue exigiendo permiso cuando el handler lo declara', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'POST',
      path: '/auth/logout',
      principal,
    });

    let caught: unknown;
    try {
      guard({ authenticatedOnly: true, required: ['auditoria:read'] }).canActivate(
        contextFor(headers),
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as { getStatus: () => number } | undefined)?.getStatus()).toBe(403);
  });
});
