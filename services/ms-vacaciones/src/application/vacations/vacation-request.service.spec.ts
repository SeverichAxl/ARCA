import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoSolicitud } from '../../../prisma/generated/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { VacationRequestService } from './vacation-request.service';

const employeeId = '00000000-0000-4000-8000-000000000101';
const managerId = '00000000-0000-4000-8000-000000000102';
const actorUserId = '00000000-0000-4000-8000-000000000103';

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
      if (query.includes('SELECT valor')) {
        return Promise.resolve([{ valor: '15' }]);
      }
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
      aggregate: jest.fn().mockResolvedValue({ _sum: { diasHabiles: 0 } }),
      create: jest.fn().mockResolvedValue(request),
    },
    licencia: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    saldoVacaciones: {
      findMany: jest.fn().mockResolvedValue([
        { diasAsignados: 15, diasTomados: 0 },
      ]),
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

  return {
    service: new VacationRequestService(prisma as unknown as PrismaService),
    tx,
    employee,
    request,
  };
}

describe('VacationRequestService', () => {
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
      { diasAsignados: 3, diasTomados: 0 },
    ]);

    await expect(
      service.create(employeeId, actorUserId, '2026-12-21', '2026-12-25'),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ code: 'VAC_SALDO_INSUFICIENTE' }),
    });
    expect(tx.solicitudVacacion.create).not.toHaveBeenCalled();
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
