import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  countBusinessDays,
  parseDateOnly,
  VacationRequestService,
} from './vacation-request.service';

const employeeId = '00000000-0000-4000-8000-000000000101';
const actorUsuarioId = '00000000-0000-4000-8000-000000000102';
const jefeEmpleadoId = '00000000-0000-4000-8000-000000000103';

describe('vacation request date rules', () => {
  it('counts weekdays inclusively and excludes official holidays', () => {
    expect(
      countBusinessDays(parseDateOnly('2026-11-02'), parseDateOnly('2026-11-06'), [
        parseDateOnly('2026-11-02'),
      ]),
    ).toBe(4);
  });

  it('rejects invalid calendar dates', () => {
    expect(() => parseDateOnly('2026-02-30')).toThrow(BadRequestException);
  });
});

describe('VacationRequestService', () => {
  const eligibleEmployee = {
    empleado_id: employeeId,
    area_id: '00000000-0000-4000-8000-000000000104',
    jefe_empleado_id: jefeEmpleadoId,
    estado: 'RATIFICADO',
    fecha_ingreso: new Date('2025-10-30T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(options?: {
    employee?: typeof eligibleEmployee | null;
    overlapRequest?: { id: string };
    overlapLeave?: { id: string };
    balances?: Array<{ dias_asignados: number; dias_tomados: number }>;
    reservedDays?: number;
  }) {
    const queries: string[] = [];
    const outboxCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const query = strings.join(' ');
        queries.push(query);

        if (query.includes('FROM empleado_ref')) {
          return Promise.resolve(
            options?.employee === null ? [] : [options?.employee ?? eligibleEmployee],
          );
        }
        if (query.includes('FROM configuracion_vacaciones')) {
          return Promise.resolve([{ valor: '15' }]);
        }
        if (query.includes('FROM feriado')) {
          return Promise.resolve([{ fecha: new Date('2026-11-02T00:00:00.000Z') }]);
        }
        if (query.includes('FROM solicitud_vacacion') && query.includes('LIMIT 1')) {
          return Promise.resolve(options?.overlapRequest ? [options.overlapRequest] : []);
        }
        if (query.includes('FROM licencia')) {
          return Promise.resolve(options?.overlapLeave ? [options.overlapLeave] : []);
        }
        if (query.includes('SUM(dias_habiles)')) {
          return Promise.resolve([{ dias: options?.reservedDays ?? 0 }]);
        }
        if (query.includes('FROM saldo_vacaciones')) {
          return Promise.resolve(options?.balances ?? [{ dias_asignados: 15, dias_tomados: 0 }]);
        }
        return Promise.resolve([]);
      }),
      outboxEvento: { create: outboxCreate },
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService;
    const outbox = new OutboxService();
    const service = new VacationRequestService(prisma, outbox);
    return { service, queries, outboxCreate };
  }

  it('creates a request with the boss snapshot, history, and audit event', async () => {
    const { service, queries, outboxCreate } = createService();

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-02', '2026-11-06', false),
    ).resolves.toMatchObject({
      empleadoId: employeeId,
      fechaInicio: '2026-11-02',
      fechaFin: '2026-11-06',
      diasHabiles: 4,
      estado: 'PENDIENTE_JEFE',
      jefeEmpleadoId,
    });

    expect(queries.some((query) => query.includes('INSERT INTO historial_solicitud'))).toBe(true);
    expect(outboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: 'AUDITORIA_REGISTRADA',
          payload: expect.objectContaining({
            accion: 'VACACION_SOLICITAR',
            usuarioId: actorUsuarioId,
          }),
        }),
      }),
    );
  });

  it('rejects requests from employees who are not eligible', async () => {
    const { service } = createService({
      employee: { ...eligibleEmployee, estado: 'EN_PRUEBA' },
    });

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-02', '2026-11-03', false),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects an overlapping vacation request', async () => {
    const { service } = createService({ overlapRequest: { id: 'existing-request' } });

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-02', '2026-11-03', false),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an overlapping leave', async () => {
    const { service } = createService({ overlapLeave: { id: 'existing-leave' } });

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-02', '2026-11-03', false),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a request exceeding available balance unless an exception is requested', async () => {
    const { service, outboxCreate } = createService({
      balances: [{ dias_asignados: 2, dias_tomados: 0 }],
    });

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-03', '2026-11-05', false),
    ).rejects.toThrow(ConflictException);
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it('creates a pending exception for days beyond the remaining balance', async () => {
    const { service, queries } = createService({
      balances: [{ dias_asignados: 2, dias_tomados: 0 }],
    });

    await expect(
      service.create(
        employeeId,
        actorUsuarioId,
        '2026-11-03',
        '2026-11-05',
        true,
        'Motivo justificado',
      ),
    ).resolves.toMatchObject({
      diasHabiles: 3,
      excepcion: { diasExcedentes: 1, estado: 'PENDIENTE' },
    });
    expect(queries.some((query) => query.includes('INSERT INTO solicitud_excepcion'))).toBe(true);
  });

  it('requires a justification when an exception is needed', async () => {
    const { service } = createService({
      balances: [{ dias_asignados: 2, dias_tomados: 0 }],
    });

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-03', '2026-11-05', true, '  '),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a range containing no business days', async () => {
    const { service } = createService();

    await expect(
      service.create(employeeId, actorUsuarioId, '2026-11-07', '2026-11-08', false),
    ).rejects.toThrow(BadRequestException);
  });
});
