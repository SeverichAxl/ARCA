import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InternalAuthGuard,
  RequirePermission,
  Public,
  buildCanonicalString,
  internalRoutePath,
  signInternalHeaders,
  verifyInternalHeaders,
} from '../src';

const SECRET = 'test-internal-hmac-secret';
const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: '22222222-2222-4222-8222-222222222222',
  rol: 'JEFE_AREA',
  permisos: ['vacaciones:read_own', 'vacaciones:approve_jefe'],
};

describe('internal-auth canonical y firma', () => {
  it('calcula la misma ruta destino desde gateway y servicio', () => {
    expect(internalRoutePath('/api/personal/employees/1?x=1')).toBe('/employees/1');
    expect(internalRoutePath('/employees/1')).toBe('/employees/1');
    expect(internalRoutePath('/api/vacaciones/saldo?empleadoId=1')).toBe('/vacaciones/saldo');
    expect(internalRoutePath('/api/auth/roles')).toBe('/auth/roles');
    expect(internalRoutePath('/diag')).toBe('/diag');
  });

  it('construye el canonical v1 con permisos ordenados', () => {
    const canonical = buildCanonicalString({
      method: 'get',
      path: '/api/auth/roles',
      userId: 'u',
      empleadoId: null,
      rol: 'ADMIN_GENERAL',
      permisos: ['z:perm', 'a:perm'],
      timestamp: 123,
    });

    expect(canonical).toBe(
      ['v1', 'GET', '/auth/roles', 'u', '-', 'ADMIN_GENERAL', 'a:perm,z:perm', '123'].join(
        '\n',
      ),
    );
  });

  it('firma en el gateway y verifica en el servicio aunque cambie el prefijo', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees/1?x=1',
      principal: {
        ...principal,
        permisos: ['vacaciones:read_own', 'vacaciones:approve_jefe', 'vacaciones:read_own'],
      },
      timestamp: 1_800_000_000_000,
    });

    expect(headers['X-Empleado-Id']).toBe(principal.empleadoId);
    expect(headers['X-Permisos']).toBe('vacaciones:approve_jefe,vacaciones:read_own');

    const verified = verifyInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/employees/1',
      headers,
      now: 1_800_000_000_000,
    });

    expect(verified).toEqual({
      ...principal,
      permisos: ['vacaciones:approve_jefe', 'vacaciones:read_own'],
    });
  });

  it('usa "-" cuando empleadoId es null', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'POST',
      path: '/api/auth/login',
      principal: { ...principal, empleadoId: null },
      timestamp: 1_800_000_000_000,
    });

    expect(headers['X-Empleado-Id']).toBe('-');

    expect(
      verifyInternalHeaders({
        secret: SECRET,
        method: 'POST',
        path: '/auth/login',
        headers,
        now: 1_800_000_000_000,
      }).empleadoId,
    ).toBeNull();
  });

  it('rechaza una cabecera alterada', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees',
      principal,
      timestamp: 1_800_000_000_000,
    });

    expect(() =>
      verifyInternalHeaders({
        secret: SECRET,
        method: 'GET',
        path: '/employees',
        headers: { ...headers, 'X-Rol': 'ADMIN_GENERAL' },
        now: 1_800_000_000_000,
      }),
    ).toThrow();
  });

  it('rechaza timestamp vencido y ausente', () => {
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees',
      principal,
      timestamp: 1_800_000_000_000,
    });

    expect(() =>
      verifyInternalHeaders({
        secret: SECRET,
        method: 'GET',
        path: '/employees',
        headers,
        now: 1_800_000_061_000,
      }),
    ).toThrow();

    const withoutTimestamp: Record<string, string> = { ...headers };
    delete withoutTimestamp['X-Timestamp'];
    expect(() =>
      verifyInternalHeaders({
        secret: SECRET,
        method: 'GET',
        path: '/employees',
        headers: withoutTimestamp,
        now: 1_800_000_000_000,
      }),
    ).toThrow();
  });
});

class GuardedController {
  @Public()
  publicHandler(): void {}

  @RequirePermission('personal:read')
  protectedHandler(): void {}

  plainHandler(): void {}
}

function config(): ConfigService {
  return { get: (key: string) => (key === 'INTERNAL_HMAC_KEY' ? SECRET : undefined) } as ConfigService;
}

function contextFor(
  handler: () => void,
  path: string,
  headers: Record<string, string> = {},
): {
  context: Parameters<InternalAuthGuard['canActivate']>[0];
  request: { method: string; path: string; headers: Record<string, string>; internalPrincipal?: unknown };
} {
  const request = { method: 'GET', path, headers, internalPrincipal: undefined };
  const context = {
    getHandler: () => handler,
    getClass: () => GuardedController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as Parameters<InternalAuthGuard['canActivate']>[0];

  return { context, request };
}

function statusOf(error: unknown): number | undefined {
  return error instanceof HttpException ? error.getStatus() : undefined;
}

function codeOf(error: unknown): string | undefined {
  return error instanceof HttpException
    ? (error.getResponse() as { code?: string }).code
    : undefined;
}

describe('InternalAuthGuard', () => {
  it('permite @Public sin firma', () => {
    const guard = new InternalAuthGuard(new Reflector(), config());
    const { context } = contextFor(GuardedController.prototype.publicHandler, '/health');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('una llamada directa sin firma devuelve 401', () => {
    const guard = new InternalAuthGuard(new Reflector(), config());
    const { context } = contextFor(
      GuardedController.prototype.protectedHandler,
      '/employees',
    );

    try {
      guard.canActivate(context);
      throw new Error('debía lanzar 401');
    } catch (error) {
      expect(statusOf(error)).toBe(401);
      expect(codeOf(error)).toBe('AUTH_INTERNAL_SIGNATURE_INVALID');
    }
  });

  it('con firma válida y @RequirePermission permite y adjunta el principal', () => {
    const guard = new InternalAuthGuard(new Reflector(), config());
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees',
      principal: { ...principal, permisos: ['personal:read'] },
    });
    const { context, request } = contextFor(
      GuardedController.prototype.protectedHandler,
      '/employees',
      headers,
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(request.internalPrincipal).toMatchObject({ userId: principal.userId });
  });

  it('con firma válida pero sin permiso devuelve 403', () => {
    const guard = new InternalAuthGuard(new Reflector(), config());
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees',
      principal: { ...principal, permisos: ['vacaciones:read_own'] },
    });
    const { context } = contextFor(
      GuardedController.prototype.protectedHandler,
      '/employees',
      headers,
    );

    try {
      guard.canActivate(context);
      throw new Error('debía lanzar 403');
    } catch (error) {
      expect(statusOf(error)).toBe(403);
      expect(codeOf(error)).toBe('FORBIDDEN');
    }
  });

  it('deniega por defecto un handler sin @Public ni @RequirePermission', () => {
    const guard = new InternalAuthGuard(new Reflector(), config());
    const headers = signInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/api/personal/employees',
      principal,
    });
    const { context } = contextFor(
      GuardedController.prototype.plainHandler,
      '/employees',
      headers,
    );

    try {
      guard.canActivate(context);
      throw new Error('debía lanzar 403');
    } catch (error) {
      expect(statusOf(error)).toBe(403);
      expect(codeOf(error)).toBe('FORBIDDEN');
    }
  });
});
