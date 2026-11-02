import type { EventEnvelope, PrismaTransactionLike } from '@arca/messaging';
import { consumePersonalEvent } from './personal-events.handler';

describe('consumePersonalEvent', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates one configured balance for each completed year of an eligible employee', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
    const queries: string[] = [];
    const tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const query = strings.join(' ');
        queries.push(query);
        if (query.includes('SELECT estado, fecha_ingreso')) {
          return Promise.resolve([
            { estado: 'RATIFICADO', fecha_ingreso: new Date('2025-10-30T00:00:00.000Z') },
          ]);
        }
        if (query.includes('SELECT valor')) {
          return Promise.resolve([{ valor: '15' }]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as PrismaTransactionLike;
    const event: EventEnvelope = {
      eventId: '00000000-0000-4000-8000-000000000101',
      eventName: 'EMPLEADO_CREADO',
      version: 1,
      occurredOn: '2025-10-30T12:00:00.000Z',
      producer: 'ms-personal',
      payload: {
        empleadoId: '00000000-0000-4000-8000-000000000102',
        nombreCompleto: 'Ana Rojas',
        areaId: '00000000-0000-4000-8000-000000000103',
        jefeEmpleadoId: null,
        estado: 'RATIFICADO',
        fechaIngreso: '2025-10-30',
        fechaBaja: null,
      },
    };

    await consumePersonalEvent(tx, event);

    expect(queries.filter((query) => query.includes('INSERT INTO saldo_vacaciones'))).toHaveLength(
      1,
    );
    expect(queries.some((query) => query.includes('DIAS_POR_GESTION'))).toBe(true);
  });

  it('does not create balances for an employee still in the probation period', async () => {
    const queries: string[] = [];
    const tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const query = strings.join(' ');
        queries.push(query);
        if (query.includes('SELECT estado, fecha_ingreso')) {
          return Promise.resolve([
            { estado: 'EN_PRUEBA', fecha_ingreso: new Date('2025-01-15T00:00:00.000Z') },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as PrismaTransactionLike;
    const event: EventEnvelope = {
      eventId: '00000000-0000-4000-8000-000000000201',
      eventName: 'EMPLEADO_CREADO',
      version: 1,
      occurredOn: '2025-01-15T12:00:00.000Z',
      producer: 'ms-personal',
      payload: {
        empleadoId: '00000000-0000-4000-8000-000000000202',
        nombreCompleto: 'Ana Rojas',
        areaId: '00000000-0000-4000-8000-000000000203',
        jefeEmpleadoId: null,
        estado: 'EN_PRUEBA',
        fechaIngreso: '2025-01-15',
        fechaBaja: null,
      },
    };

    await consumePersonalEvent(tx, event);

    expect(queries.some((query) => query.includes('INSERT INTO saldo_vacaciones'))).toBe(false);
    expect(queries.some((query) => query.includes('SELECT valor'))).toBe(false);
  });
});
