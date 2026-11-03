import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { EstadoExcepcion, EstadoSolicitud } from '../../../prisma/generated/client';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { VacationApprovalService } from './vacation-approval.service';

const employeeId = '00000000-0000-4000-8000-000000000101';
const managerId = '00000000-0000-4000-8000-000000000102';
const rrhhId = '00000000-0000-4000-8000-000000000103';
const userId = '00000000-0000-4000-8000-000000000104';
const requestId = '00000000-0000-4000-8000-000000000105';
const exceptionId = '00000000-0000-4000-8000-000000000106';
const areaId = '00000000-0000-4000-8000-000000000108';

function createHarness(requestOverrides: Record<string, unknown> = {}) {
  const request = {
    id: requestId,
    empleadoId: employeeId,
    diasHabiles: 4,
    estado: EstadoSolicitud.PENDIENTE_JEFE,
    jefeEmpleadoId: managerId,
    empleado: { empleadoId: employeeId, jefeEmpleadoId: managerId, areaId },
    excepcion: null,
    ...requestOverrides,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ empleado_id: employeeId }]),
    empleadoRef: {
      findUnique: jest.fn().mockResolvedValue({ areaId }),
    },
    solicitudVacacion: {
      findUnique: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { diasHabiles: 0 } }),
    },
    solicitudExcepcion: {
      findUnique: jest.fn().mockResolvedValue({ solicitudId: requestId }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: exceptionId,
        solicitudId: requestId,
        diasExcedentes: 2,
        estado: EstadoExcepcion.PENDIENTE,
      }),
    },
    saldoVacaciones: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: '00000000-0000-4000-8000-000000000107',
          gestion: 1,
          diasAsignados: 15,
          diasExcepcion: 0,
          diasTomados: 0,
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    descuentoSaldo: {
      create: jest.fn().mockResolvedValue({}),
    },
    historialSolicitud: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const outbox = { add: jest.fn().mockResolvedValue({ eventId: 'audit-id' }) };

  return {
    service: new VacationApprovalService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    ),
    tx,
    outbox,
    request,
  };
}

function principal(
  rol: string,
  empleado: string,
  permisos: string[],
): InternalPrincipal {
  return { userId, empleadoId: empleado, rol, permisos };
}

describe('VacationApprovalService', () => {
  it('approves at manager level without deducting balance', async () => {
    const { service, tx, outbox } = createHarness();

    await expect(
      service.approveByManager(
        requestId,
        principal('JEFE_AREA', managerId, ['vacaciones:approve_jefe']),
      ),
    ).resolves.toMatchObject({ estado: EstadoSolicitud.APROBADO_JEFE });

    expect(tx.solicitudVacacion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId, estado: EstadoSolicitud.PENDIENTE_JEFE },
        data: expect.objectContaining({
          estado: EstadoSolicitud.APROBADO_JEFE,
          aprobadoJefePor: managerId,
        }),
      }),
    );
    expect(tx.saldoVacaciones.updateMany).not.toHaveBeenCalled();
    expect(outbox.add).toHaveBeenCalled();
  });

  it('rejects approval by an employee who is not the immediate manager', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.approveByManager(
        requestId,
        principal('JEFE_AREA', rrhhId, ['vacaciones:approve_jefe']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.solicitudVacacion.updateMany).not.toHaveBeenCalled();
  });

  it('hides requests belonging to a different area from the manager', async () => {
    const { service, tx } = createHarness();
    tx.empleadoRef.findUnique.mockResolvedValueOnce({
      areaId: '00000000-0000-4000-8000-000000000109',
    });

    await expect(
      service.approveByManager(
        requestId,
        principal('JEFE_AREA', managerId, ['vacaciones:approve_jefe']),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.solicitudVacacion.updateMany).not.toHaveBeenCalled();
  });

  it('prevents a manager from approving their own request', async () => {
    const { service, tx } = createHarness({
      empleadoId: managerId,
      empleado: { empleadoId: managerId, jefeEmpleadoId: managerId },
    });

    await expect(
      service.approveByManager(
        requestId,
        principal('JEFE_AREA', managerId, ['vacaciones:approve_jefe']),
      ),
    ).rejects.toMatchObject({
      constructor: ForbiddenException,
      response: expect.objectContaining({ code: 'VAC_AUTOAPROBACION' }),
    });
    expect(tx.solicitudVacacion.updateMany).not.toHaveBeenCalled();
  });

  it('deducts the balance only at final HR approval', async () => {
    const { service, tx } = createHarness({
      estado: EstadoSolicitud.APROBADO_JEFE,
    });

    await expect(
      service.approveByHr(
        requestId,
        principal('RRHH_OPERATIVO', rrhhId, ['vacaciones:approve_rrhh']),
      ),
    ).resolves.toMatchObject({ estado: EstadoSolicitud.APROBADO_FINAL });

    expect(tx.saldoVacaciones.updateMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000107',
        diasTomados: 0,
      },
      data: { diasTomados: { increment: 4 } },
    });
    expect(tx.descuentoSaldo.create).toHaveBeenCalledWith({
      data: {
        solicitudId: requestId,
        saldoId: '00000000-0000-4000-8000-000000000107',
        dias: 4,
      },
    });
    expect(tx.solicitudVacacion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId, estado: EstadoSolicitud.APROBADO_JEFE },
        data: expect.objectContaining({
          estado: EstadoSolicitud.APROBADO_FINAL,
          aprobadoRrhhPor: rrhhId,
        }),
      }),
    );
  });

  it('blocks HR approval until an associated exception is approved', async () => {
    const { service, tx } = createHarness({
      estado: EstadoSolicitud.APROBADO_JEFE,
      excepcion: { id: exceptionId, estado: EstadoExcepcion.PENDIENTE },
    });

    await expect(
      service.approveByHr(
        requestId,
        principal('RRHH_OPERATIVO', rrhhId, ['vacaciones:approve_rrhh']),
      ),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_EXCEPCION_PENDIENTE' }),
    });
    expect(tx.saldoVacaciones.updateMany).not.toHaveBeenCalled();
  });

  it('only lets Gerencia or HR resolve exceptions and records approved excess days', async () => {
    const { service, tx } = createHarness({
      excepcion: {
        id: exceptionId,
        estado: EstadoExcepcion.PENDIENTE,
        diasExcedentes: 2,
      },
    });
    tx.saldoVacaciones.findMany.mockResolvedValueOnce([
      {
        id: '00000000-0000-4000-8000-000000000107',
        gestion: 1,
        diasAsignados: 3,
        diasExcepcion: 0,
        diasTomados: 0,
      },
    ]);

    await expect(
      service.resolveException(
        exceptionId,
        principal('GERENCIA', rrhhId, ['vacaciones:excepcion_resolve']),
        'APROBADA',
      ),
    ).resolves.toMatchObject({ estado: EstadoExcepcion.APROBADA });
    expect(tx.saldoVacaciones.update).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000107' },
      data: { diasExcepcion: { increment: 1 } },
    });
    expect(tx.solicitudVacacion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects the request when its exception is denied', async () => {
    const { service, tx } = createHarness({
      excepcion: {
        id: exceptionId,
        estado: EstadoExcepcion.PENDIENTE,
        diasExcedentes: 2,
      },
    });

    await service.resolveException(
      exceptionId,
      principal('RRHH_OPERATIVO', rrhhId, ['vacaciones:excepcion_resolve']),
      'RECHAZADA',
      'No aprobado',
    );

    expect(tx.solicitudVacacion.updateMany).toHaveBeenCalledWith({
      where: {
        id: requestId,
        estado: {
          in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE],
        },
      },
      data: {
        estado: EstadoSolicitud.RECHAZADA,
        motivoRechazo: 'No aprobado',
      },
    });
    expect(tx.saldoVacaciones.update).not.toHaveBeenCalled();
  });
});
