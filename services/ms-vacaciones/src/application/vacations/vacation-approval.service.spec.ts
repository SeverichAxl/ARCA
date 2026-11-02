import { ForbiddenException } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { VacationApprovalService } from './vacation-approval.service';

const requestId = '00000000-0000-4000-8000-000000000101';
const employeeId = '00000000-0000-4000-8000-000000000102';
const managerId = '00000000-0000-4000-8000-000000000103';
const hrEmployeeId = '00000000-0000-4000-8000-000000000104';
const userId = '00000000-0000-4000-8000-000000000105';

describe('VacationApprovalService', () => {
  function createService(
    onQuery: (query: string) => unknown,
    actor = {
      usuarioId: userId,
      empleadoId: managerId,
      rol: 'JEFE_AREA',
      permisos: ['vacaciones:approve_jefe'],
    },
  ) {
    const queries: string[] = [];
    const outboxCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const query = strings.join(' ');
        queries.push(query);
        return Promise.resolve(onQuery(query));
      }),
      outboxEvento: { create: outboxCreate },
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService;
    const service = new VacationApprovalService(prisma, new OutboxService());
    return { service, queries, outboxCreate, actor };
  }

  it('approves at the manager level only for the employee current manager', async () => {
    const { service, queries, outboxCreate } = createService((query) => {
      if (query.includes('SELECT id, empleado_id')) {
        return [
          {
            id: requestId,
            empleado_id: employeeId,
            jefe_empleado_id: managerId,
            dias_habiles: 3,
            estado: 'PENDIENTE_JEFE',
          },
        ];
      }
      if (query.includes('SELECT jefe_empleado_id')) {
        return [{ jefe_empleado_id: managerId }];
      }
      if (query.includes('UPDATE solicitud_vacacion')) {
        return [{ id: requestId }];
      }
      return [];
    });

    await expect(
      service.approveByManager(requestId, {
        usuarioId: userId,
        empleadoId: managerId,
        rol: 'JEFE_AREA',
        permisos: ['vacaciones:approve_jefe'],
      }),
    ).resolves.toMatchObject({
      id: requestId,
      estado: 'APROBADO_JEFE',
      aprobadoJefePor: managerId,
    });
    expect(queries.some((query) => query.includes('INSERT INTO historial_solicitud'))).toBe(true);
    expect(outboxCreate).toHaveBeenCalled();
  });

  it('rejects approval of the actor own request', async () => {
    const { service } = createService((query) => {
      if (query.includes('SELECT id, empleado_id')) {
        return [
          {
            id: requestId,
            empleado_id: managerId,
            jefe_empleado_id: managerId,
            dias_habiles: 3,
            estado: 'PENDIENTE_JEFE',
          },
        ];
      }
      return [];
    });

    await expect(
      service.approveByManager(requestId, {
        usuarioId: userId,
        empleadoId: managerId,
        rol: 'JEFE_AREA',
        permisos: ['vacaciones:approve_jefe'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a manager whose assignment changed after the request was submitted', async () => {
    const { service, queries } = createService((query) => {
      if (query.includes('SELECT id, empleado_id')) {
        return [
          {
            id: requestId,
            empleado_id: employeeId,
            jefe_empleado_id: managerId,
            dias_habiles: 3,
            estado: 'PENDIENTE_JEFE',
          },
        ];
      }
      if (query.includes('SELECT jefe_empleado_id')) {
        return [{ jefe_empleado_id: hrEmployeeId }];
      }
      return [];
    });

    await expect(
      service.approveByManager(requestId, {
        usuarioId: userId,
        empleadoId: managerId,
        rol: 'JEFE_AREA',
        permisos: ['vacaciones:approve_jefe'],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(queries.some((query) => query.includes('UPDATE solicitud_vacacion'))).toBe(false);
  });

  it('allows the current manager to reject a pending request', async () => {
    const { service, queries } = createService((query) => {
      if (query.includes('SELECT id, empleado_id')) {
        return [
          {
            id: requestId,
            empleado_id: employeeId,
            jefe_empleado_id: managerId,
            dias_habiles: 3,
            estado: 'PENDIENTE_JEFE',
          },
        ];
      }
      if (query.includes('SELECT jefe_empleado_id')) {
        return [{ jefe_empleado_id: managerId }];
      }
      if (query.includes('UPDATE solicitud_vacacion')) {
        return [{ id: requestId }];
      }
      return [];
    });

    await expect(
      service.reject(
        requestId,
        {
          usuarioId: userId,
          empleadoId: managerId,
          rol: 'JEFE_AREA',
          permisos: ['vacaciones:approve_jefe'],
        },
        'No corresponde.',
      ),
    ).resolves.toEqual({ id: requestId, estado: 'RECHAZADA' });
    expect(queries.some((query) => query.includes('INSERT INTO historial_solicitud'))).toBe(true);
  });

  it('allows RRHH to reject a request after manager approval', async () => {
    const { service } = createService(
      (query) => {
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: requestId,
              empleado_id: employeeId,
              jefe_empleado_id: managerId,
              dias_habiles: 3,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('UPDATE solicitud_vacacion')) {
          return [{ id: requestId }];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      },
    );

    await expect(
      service.reject(
        requestId,
        {
          usuarioId: userId,
          empleadoId: hrEmployeeId,
          rol: 'RRHH_OPERATIVO',
          permisos: ['vacaciones:approve_rrhh'],
        },
        'No corresponde.',
      ),
    ).resolves.toEqual({ id: requestId, estado: 'RECHAZADA' });
  });

  it('charges balances and records discounts only on final HR approval', async () => {
    const { service, queries } = createService(
      (query) => {
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: requestId,
              empleado_id: employeeId,
              jefe_empleado_id: managerId,
              dias_habiles: 4,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('SELECT estado, dias_excedentes')) {
          return [{ estado: 'APROBADA', dias_excedentes: 0 }];
        }
        if (query.includes('SELECT id, gestion')) {
          return [
            {
              id: '00000000-0000-4000-8000-000000000106',
              gestion: 1,
              dias_asignados: 8,
              dias_tomados: 1,
            },
          ];
        }
        if (query.includes('UPDATE saldo_vacaciones')) {
          return [{ id: '00000000-0000-4000-8000-000000000106' }];
        }
        if (query.includes('UPDATE solicitud_vacacion')) {
          return [{ id: requestId }];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      },
    );

    await expect(
      service.approveByHr(requestId, {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      }),
    ).resolves.toMatchObject({
      id: requestId,
      estado: 'APROBADO_FINAL',
      descuentos: [{ gestion: 1, dias: 4 }],
    });
    expect(queries.some((query) => query.includes('UPDATE saldo_vacaciones'))).toBe(true);
    expect(queries.some((query) => query.includes('INSERT INTO descuento_saldo'))).toBe(true);
  });

  it('requires an approved exception before final approval when the request exceeds balance', async () => {
    const { service } = createService(
      (query) => {
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: requestId,
              empleado_id: employeeId,
              jefe_empleado_id: managerId,
              dias_habiles: 4,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('SELECT estado, dias_excedentes')) {
          return [{ estado: 'PENDIENTE', dias_excedentes: 2 }];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      },
    );

    await expect(
      service.approveByHr(requestId, {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      }),
    ).rejects.toMatchObject({
      response: { code: 'VAC_EXCEPCION_PENDIENTE' },
    });
  });

  it('rejects final approval when the approved exception does not cover the balance shortfall', async () => {
    const { service, queries } = createService(
      (query) => {
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: requestId,
              empleado_id: employeeId,
              jefe_empleado_id: managerId,
              dias_habiles: 4,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('SELECT estado, dias_excedentes')) {
          return [{ estado: 'APROBADA', dias_excedentes: 1 }];
        }
        if (query.includes('SELECT id, gestion')) {
          return [
            {
              id: '00000000-0000-4000-8000-000000000106',
              gestion: 1,
              dias_asignados: 3,
              dias_tomados: 1,
            },
          ];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      },
    );

    await expect(
      service.approveByHr(requestId, {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:approve_rrhh'],
      }),
    ).rejects.toThrow();
    expect(queries.some((query) => query.includes('UPDATE saldo_vacaciones'))).toBe(false);
  });

  it('restricts exception resolution to GERENCIA and RRHH_OPERATIVO', async () => {
    const { service } = createService(() => [], {
      usuarioId: userId,
      empleadoId: managerId,
      rol: 'JEFE_AREA',
      permisos: ['vacaciones:excepcion_resolve'],
    });

    await expect(
      service.resolveException(
        '00000000-0000-4000-8000-000000000107',
        {
          usuarioId: userId,
          empleadoId: managerId,
          rol: 'JEFE_AREA',
          permisos: ['vacaciones:excepcion_resolve'],
        },
        'APROBADA',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an exception resolver approving their own request', async () => {
    const { service } = createService(
      (query) => {
        if (query.includes('SELECT solicitud_id')) {
          return [{ solicitud_id: requestId }];
        }
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: '00000000-0000-4000-8000-000000000107',
              empleado_id: managerId,
              jefe_empleado_id: managerId,
              dias_habiles: 3,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('FROM solicitud_excepcion')) {
          return [
            {
              id: '00000000-0000-4000-8000-000000000107',
              solicitud_id: requestId,
              dias_excedentes: 2,
              estado: 'PENDIENTE',
            },
          ];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: managerId,
        rol: 'GERENCIA',
        permisos: ['vacaciones:excepcion_resolve'],
      },
    );

    await expect(
      service.resolveException(
        '00000000-0000-4000-8000-000000000107',
        {
          usuarioId: userId,
          empleadoId: managerId,
          rol: 'GERENCIA',
          permisos: ['vacaciones:excepcion_resolve'],
        },
        'APROBADA',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('resolves an exception without discounting the balance before final approval', async () => {
    const { service, queries, outboxCreate } = createService(
      (query) => {
        if (query.includes('SELECT solicitud_id')) {
          return [{ solicitud_id: requestId }];
        }
        if (query.includes('SELECT id, empleado_id')) {
          return [
            {
              id: requestId,
              empleado_id: employeeId,
              jefe_empleado_id: managerId,
              dias_habiles: 5,
              estado: 'APROBADO_JEFE',
            },
          ];
        }
        if (query.includes('FROM solicitud_excepcion')) {
          return [
            {
              id: '00000000-0000-4000-8000-000000000107',
              solicitud_id: requestId,
              dias_excedentes: 2,
              estado: 'PENDIENTE',
            },
          ];
        }
        if (query.includes('UPDATE solicitud_excepcion')) {
          return [{ id: '00000000-0000-4000-8000-000000000107' }];
        }
        return [];
      },
      {
        usuarioId: userId,
        empleadoId: hrEmployeeId,
        rol: 'RRHH_OPERATIVO',
        permisos: ['vacaciones:excepcion_resolve'],
      },
    );

    await expect(
      service.resolveException(
        '00000000-0000-4000-8000-000000000107',
        {
          usuarioId: userId,
          empleadoId: hrEmployeeId,
          rol: 'RRHH_OPERATIVO',
          permisos: ['vacaciones:excepcion_resolve'],
        },
        'APROBADA',
      ),
    ).resolves.toMatchObject({
      estado: 'APROBADA',
      resueltoPor: hrEmployeeId,
    });
    expect(queries.some((query) => query.includes('UPDATE saldo_vacaciones'))).toBe(false);
    expect(outboxCreate).toHaveBeenCalled();
  });
});
