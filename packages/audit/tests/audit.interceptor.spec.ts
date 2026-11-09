import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditContext } from '../src/audit.context';
import { AuditInterceptor } from '../src/audit.interceptor';
import type { AuditEntry } from '../src/audit.types';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function reflector(): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(undefined),
  } as unknown as Reflector;
}

function request(method = 'POST'): Record<string, unknown> {
  return {
    method,
    path: '/areas/00000000-0000-4000-8000-000000000001',
    route: { path: '/areas/:id' },
    headers: {},
    ip: '10.0.0.10',
    internalPrincipal: { userId: 'user-1', empleadoId: 'emp-1' },
  };
}

describe('AuditInterceptor', () => {
  it('audita una escritura exitosa y enmascara el body de respaldo', async () => {
    const recorder = { record: jest.fn().mockResolvedValue(undefined) };
    const auditContext = new AuditContext();
    const interceptor = new AuditInterceptor(reflector(), auditContext, recorder);
    const body = { id: 'area-1', nombre: 'Operaciones', ci: '12345678', password: 'x' };

    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor(request()), {
          handle: () => of(body),
        }),
      ),
    ).resolves.toBe(body);

    expect(recorder.record).toHaveBeenCalledTimes(1);
    const entry = recorder.record.mock.calls[0][0] as AuditEntry;
    expect(entry).toMatchObject({
      usuarioId: 'user-1',
      empleadoId: 'emp-1',
      ipOrigen: '10.0.0.10',
      metodo: 'POST',
      resultado: 'EXITO',
    });
    expect(entry.payload).toMatchObject({
      antes: null,
      despues: { id: 'area-1', nombre: 'Operaciones', ci: '***5678', password: '***' },
    });
  });

  it('no audita GET', async () => {
    const recorder = { record: jest.fn() };
    const interceptor = new AuditInterceptor(reflector(), new AuditContext(), recorder);

    await lastValueFrom(
      interceptor.intercept(contextFor(request('GET')), { handle: () => of([]) }),
    );

    expect(recorder.record).not.toHaveBeenCalled();
  });

  it('audita GET explícitamente marcado y usa el resultado resumido del caso de uso', async () => {
    const recorder = { record: jest.fn().mockResolvedValue(undefined) };
    const auditContext = new AuditContext();
    const reflectorMock = reflector();
    jest.mocked(reflectorMock.getAllAndOverride).mockImplementation((key) =>
      key === 'arca:audit'
        ? { modulo: 'contratos', accion: 'CONTRATO_DESCARGAR' }
        : undefined,
    );
    const interceptor = new AuditInterceptor(reflectorMock, auditContext, recorder);
    const response = {
      url: 'https://cloudinary.example/temporary-secret-url',
      expiresInSeconds: 300,
      versionId: 'version-1',
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor(request('GET')), {
          handle: () => {
            auditContext.captureAfter({
              versionId: response.versionId,
              expiresInSeconds: response.expiresInSeconds,
            });
            return of(response);
          },
        }),
      ),
    ).resolves.toBe(response);

    const entry = recorder.record.mock.calls[0][0] as AuditEntry;
    expect(entry).toMatchObject({
      metodo: 'GET',
      accion: 'CONTRATO_DESCARGAR',
      resultado: 'EXITO',
      payload: {
        despues: { versionId: 'version-1', expiresInSeconds: 300 },
      },
    });
    expect(JSON.stringify(entry)).not.toContain('temporary-secret-url');
  });

  it('audita FALLIDO con statusCode y code sin stack', async () => {
    const recorder = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditInterceptor(reflector(), new AuditContext(), recorder);
    const error = new HttpException({ code: 'PERS_CICLO_JERARQUIA', message: 'ciclo' }, 409);

    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor(request()), {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);

    const entry = recorder.record.mock.calls[0][0] as AuditEntry;
    expect(entry.resultado).toBe('FALLIDO');
    expect(entry.payload.despues).toBeNull();
    expect(entry.payload.error).toEqual({
      statusCode: 409,
      code: 'PERS_CICLO_JERARQUIA',
    });
    expect(JSON.stringify(entry)).not.toContain('stack');
  });

  it('usa antes/despues capturados por el caso de uso', async () => {
    const recorder = { record: jest.fn().mockResolvedValue(undefined) };
    const auditContext = new AuditContext();
    const interceptor = new AuditInterceptor(reflector(), auditContext, recorder);

    await lastValueFrom(
      interceptor.intercept(contextFor(request()), {
        handle: () => {
          auditContext.captureBefore({ nombre: 'Antes', ci: '12345678' });
          auditContext.captureAfter({ nombre: 'Después', ci: '87654321' });
          return of({ id: 'area-1' });
        },
      }),
    );

    const entry = recorder.record.mock.calls[0][0] as AuditEntry;
    expect(entry.payload).toMatchObject({
      antes: { nombre: 'Antes', ci: '***5678' },
      despues: { nombre: 'Después', ci: '***4321' },
    });
  });

  it('si el recorder falla no altera la respuesta', async () => {
    const recorder = { record: jest.fn().mockRejectedValue(new Error('db caída')) };
    const interceptor = new AuditInterceptor(reflector(), new AuditContext(), recorder);
    const body = { ok: true };

    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor(request()), { handle: () => of(body) }),
      ),
    ).resolves.toBe(body);
  });
});
