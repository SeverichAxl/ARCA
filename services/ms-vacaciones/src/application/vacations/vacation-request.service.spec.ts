import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoSolicitud } from '../../../prisma/generated/client';
import { OutboxService } from '@arca/messaging';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { InternalPrincipal } from '@arca/internal-auth';
import { VacationRequestQueryDto } from './vacation-request-query.dto';
import { VacationRequestService } from './vacation-request.service';

const employeeId = '00000000-0000-4000-8000-000000000101';
const managerId = '00000000-0000-4000-8000-000000000102';
const actorUserId = '00000000-0000-4000-8000-000000000103';
const requestId = '00000000-0000-4000-8000-000000000105';

function createHarness() {
  const employee = {
    empleadoId: employeeId,
    nombreCompleto: 'Funcionario de prueba',
    areaId: '00000000-0000-4000-8000-000000000104',
    jefeEmpleadoId: managerId,
    estado: 'RATIFICADO' as const,
    fechaIngreso: new Date('2020-01-01T00:00:00.000Z'),
    fechaBaja: null,
    ultimoEventoEn: new Date('2026-01-01T00:00:00.000Z'),
    actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
  };
  const request = {
    id: '00000000-0000-4000-8000-000000000105',
    empleadoId: employeeId,
    fechaInicio: new Date('2026-12-21T00:00:00.000Z'),
    fechaFin: new Date('2026-12-25T00:00:00.000Z'),
    diasHabiles: 4,
    estado: EstadoSolicitud.PENDIENTE_JEFE,
    jefeEmpleadoId: managerId,
  };
  const tx = {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join(' ');
      if (query.includes('SELECT empleado_id')) {
        return Promise.resolve([{ empleado_id: employeeId }]);
      }
      if (query.includes('SELECT clave, valor')) {
        return Promise.resolve([
          { clave: 'DIAS_POR_GESTION', valor: '15' },
          { clave: 'MAX_GESTIONES_ACUMULADAS', valor: '2' },
        ]);
      }
      if (query.includes('COUNT(*)')) return Promise.resolve([{ cantidad: 0 }]);
      if (query.includes('INSERT INTO saldo_vacaciones')) return Promise.resolve([{ id: 'saldo-id' }]);
      return Promise.resolve([]);
    }),
    empleadoRef: {
      findUnique: jest.fn().mockResolvedValue(employee),
    },
    feriado: {
      findMany: jest.fn().mockResolvedValue([
        { fecha: new Date('2026-12-25T00:00:00.000Z') },
      ]),
    },
    solicitudVacacion: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(request),
      findMany: jest.fn().mockResolvedValue([request]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue({ _sum: { diasHabiles: 0 } }),
      create: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    solicitudExcepcion: {
      create: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000108',
        solicitudId: request.id,
        diasExcedentes: 1,
        estado: 'PENDIENTE',
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    licencia: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    saldoVacaciones: {
      findMany: jest.fn().mockResolvedValue([
        { diasAsignados: 15, diasExcepcion: 0, diasTomados: 0 },
      ]),
    },
    historialSolicitud: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    empleadoRef: {
      findUnique: jest.fn().mockResolvedValue({
        empleadoId: employeeId,
        areaId: employee.areaId,
      }),
    },
    solicitudVacacion: {
      findUnique: jest.fn().mockResolvedValue({
        ...request,
        empleado: { areaId: employee.areaId },
        historial: [],
        excepcion: null,
      }),
    },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const outbox = { add: jest.fn().mockResolvedValue({ eventId: 'audit-id' }) };

  return {
    service: new VacationRequestService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    ),
    tx,
    employee,
    request,
    outbox,
  };
}

function principal(
  empleado: string | null,
  permisos: string[],
  rol = 'FUNCIONARIO',
): InternalPrincipal {
  return { userId: actorUserId, empleadoId: empleado, rol, permisos };
}

describe('VacationRequestService', () => {
  it('lists only the authenticated employee requests with pagination metadata', async () => {
    const { service, tx } = createHarness();
    const query = {
      vista: 'propias',
      pagina: 2,
      limite: 10,
    } as VacationRequestQueryDto;

    await expect(
      service.list(principal(employeeId, ['vacaciones:read_own']), query),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: requestId })],
      meta: { pagina: 2, limite: 10, total: 1, paginas: 1 },
    });
    expect(tx.solicitudVacacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empleadoId: employeeId },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('returns a request with its history only to an authorized viewer', async () => {
    const { service } = createHarness();

    await expect(
      service.getById(
        requestId,
        principal(employeeId, ['vacaciones:read_own']),
      ),
    ).resolves.toMatchObject({ id: requestId, historial: [] });
    await expect(
      service.getById(
        requestId,
        principal(managerId, ['vacaciones:read_own']),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancels a request by changing state and writing history and audit', async () => {
    const { service, tx, outbox, request } = createHarness();
    tx.solicitudVacacion.findUnique
      .mockResolvedValueOnce({ empleadoId: employeeId })
      .mockResolvedValueOnce({
        ...request,
        estado: EstadoSolicitud.PENDIENTE_JEFE,
        excepcion: null,
      });

    await expect(
      service.cancel(
        requestId,
        principal(employeeId, ['vacaciones:request']),
        'Cambio de planes',
      ),
    ).resolves.toEqual({ id: requestId, estado: EstadoSolicitud.CANCELADA });
    expect(tx.solicitudVacacion.updateMany).toHaveBeenCalledWith({
      where: { id: requestId, estado: EstadoSolicitud.PENDIENTE_JEFE },
      data: { estado: EstadoSolicitud.CANCELADA },
    });
    expect(tx.historialSolicitud.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hacia: EstadoSolicitud.CANCELADA,
          comentario: 'Cambio de planes',
        }),
      }),
    );
    expect(outbox.add).toHaveBeenCalledWith(
      tx,
      'AUDITORIA_REGISTRADA',
      expect.objectContaining({ accion: 'VACACION_CANCELAR' }),
    );
  });

  it('does not cancel a request after final approval', async () => {
    const { service, tx, request } = createHarness();
    tx.solicitudVacacion.findUnique
      .mockResolvedValueOnce({ empleadoId: employeeId })
      .mockResolvedValueOnce({
        ...request,
        estado: EstadoSolicitud.APROBADO_FINAL,
        excepcion: null,
      });

    await expect(
      service.cancel(
        requestId,
        principal(employeeId, ['vacaciones:request']),
      ),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_ESTADO_INVALIDO' }),
    });
    expect(tx.solicitudVacacion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending exception when its vacation request is canceled', async () => {
    const { service, tx, request, outbox } = createHarness();
    tx.solicitudVacacion.findUnique
      .mockResolvedValueOnce({ empleadoId: employeeId })
      .mockResolvedValueOnce({
        ...request,
        estado: EstadoSolicitud.PENDIENTE_JEFE,
        excepcion: {
          id: '00000000-0000-4000-8000-000000000108',
          estado: 'PENDIENTE',
        },
      });

    await service.cancel(
      requestId,
      principal(employeeId, ['vacaciones:request']),
    );

    expect(tx.solicitudExcepcion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '00000000-0000-4000-8000-000000000108',
          estado: 'PENDIENTE',
        },
        data: expect.objectContaining({
          estado: 'RECHAZADA',
        }),
      }),
    );
    expect(outbox.add).toHaveBeenCalledWith(
      tx,
      'AUDITORIA_REGISTRADA',
      expect.objectContaining({
        accion: 'VACACION_EXCEPCION_CANCELAR_POR_CANCELACION',
      }),
    );
  });

  it('creates a request with business days excluding weekends and holidays', async () => {
    const { service, tx, request } = createHarness();

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).resolves.toEqual(request);

    expect(tx.solicitudVacacion.create).toHaveBeenCalledWith({
      data: {
        empleadoId: employeeId,
        fechaInicio: new Date('2026-12-21T00:00:00.000Z'),
        fechaFin: new Date('2026-12-25T00:00:00.000Z'),
        diasHabiles: 4,
        jefeEmpleadoId: managerId,
        estado: EstadoSolicitud.PENDIENTE_JEFE,
      },
    });
    expect(tx.historialSolicitud.create).toHaveBeenCalledWith({
      data: {
        solicitudId: request.id,
        desde: null,
        hacia: EstadoSolicitud.PENDIENTE_JEFE,
        actorUsuarioId: actorUserId,
        comentario: 'Solicitud creada.',
      },
    });
  });

  it('rejects a range overlapping another active vacation request', async () => {
    const { service, tx } = createHarness();
    tx.solicitudVacacion.findFirst.mockResolvedValueOnce({ id: 'existing-request' });

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_TRASLAPE' }),
    });
    expect(tx.solicitudVacacion.create).not.toHaveBeenCalled();
  });

  it('rejects a range overlapping an active leave', async () => {
    const { service, tx } = createHarness();
    tx.licencia.findFirst.mockResolvedValueOnce({ id: 'existing-leave' });

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_TRASLAPE' }),
    });
    expect(tx.solicitudVacacion.create).not.toHaveBeenCalled();
  });

  it('rejects a request exceeding the available balance', async () => {
    const { service, tx } = createHarness();
    tx.saldoVacaciones.findMany.mockResolvedValueOnce([
      { diasAsignados: 3, diasExcepcion: 0, diasTomados: 0 },
    ]);

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_SALDO_INSUFICIENTE' }),
    });
    expect(tx.solicitudVacacion.create).not.toHaveBeenCalled();
  });

  it('creates a linked exception when explicitly requested for an excess', async () => {
    const { service, tx, request } = createHarness();
    tx.saldoVacaciones.findMany.mockResolvedValueOnce([
      { diasAsignados: 3, diasExcepcion: 0, diasTomados: 0 },
    ]);

    await expect(
      service.create(
        employeeId,
        actorUserId,
        '2026-12-21',
        '2026-12-25',
        true,
        'Necesidad operativa',
      ),
    ).resolves.toMatchObject({
      ...request,
      excepcion: {
        solicitudId: request.id,
        diasExcedentes: 1,
        estado: 'PENDIENTE',
      },
    });
    expect(tx.solicitudExcepcion.create).toHaveBeenCalledWith({
      data: {
        solicitudId: request.id,
        diasExcedentes: 1,
        justificacion: 'Necesidad operativa',
        estado: 'PENDIENTE',
      },
    });
  });

  it('rejects an employee who has not completed one year after ratification', async () => {
    const { service, tx, employee } = createHarness();
    employee.fechaIngreso = new Date();

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).rejects.toMatchObject({
      constructor: UnprocessableEntityException,
      response: expect.objectContaining({ code: 'VAC_NO_ELEGIBLE' }),
    });
    expect(tx.solicitudVacacion.create).not.toHaveBeenCalled();
  });
});
