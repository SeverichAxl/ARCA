import type { EventEnvelope, PrismaTransactionLike } from '@arca/messaging';
import { consumePersonalEvent } from './personal-events.handler';

describe('consumePersonalEvent vacation balances', () => {
  it('creates one balance per completed year for an eligible employee', async () => {
    const statements: string[] = [];
    const tx: PrismaTransactionLike = {
      async $queryRaw<T>(
        strings: TemplateStringsArray,
        ..._values: unknown[]
      ): Promise<T> {
        const statement = strings.join(' ');
        statements.push(statement);
        if (statement.includes('INSERT INTO empleado_ref')) {
          return [{ empleado_id: '00000000-0000-4000-8000-000000000101' }] as T;
        }
        if (statement.includes('SELECT valor')) {
          return [{ valor: '15' }] as T;
        }
        return [] as T;
      },
    };
    const envelope: EventEnvelope = {
      eventId: '00000000-0000-4000-8000-000000000201',
      eventName: 'EMPLEADO_CREADO',
      version: 1,
      occurredOn: new Date().toISOString(),
      producer: 'ms-personal',
      payload: {
        empleadoId: '00000000-0000-4000-8000-000000000101',
        nombreCompleto: 'Funcionario de prueba',
        areaId: '00000000-0000-4000-8000-000000000102',
        jefeEmpleadoId: null,
        estado: 'RATIFICADO',
        fechaIngreso: '2020-01-01',
        fechaBaja: null,
      },
    };

    await consumePersonalEvent(tx, envelope);

    const completedYears = new Date().getUTCFullYear() - 2020;
    expect(statements.filter((statement) => statement.includes('INSERT INTO saldo_vacaciones')))
      .toHaveLength(completedYears);
    expect(statements.some((statement) => statement.includes('ON CONFLICT (empleado_id, gestion) DO NOTHING')))
      .toBe(true);
  });

  it('does not create balances for an employee still in probation', async () => {
    const statements: string[] = [];
    const tx: PrismaTransactionLike = {
      async $queryRaw<T>(
        strings: TemplateStringsArray,
        ..._values: unknown[]
      ): Promise<T> {
        const statement = strings.join(' ');
        statements.push(statement);
        return (statement.includes('INSERT INTO empleado_ref')
          ? [{ empleado_id: '00000000-0000-4000-8000-000000000101' }]
          : []) as T;
      },
    };
    const envelope: EventEnvelope = {
      eventId: '00000000-0000-4000-8000-000000000202',
      eventName: 'EMPLEADO_CREADO',
      version: 1,
      occurredOn: new Date().toISOString(),
      producer: 'ms-personal',
      payload: {
        empleadoId: '00000000-0000-4000-8000-000000000101',
        nombreCompleto: 'Funcionario en prueba',
        areaId: '00000000-0000-4000-8000-000000000102',
        jefeEmpleadoId: null,
        estado: 'EN_PRUEBA',
        fechaIngreso: '2020-01-01',
        fechaBaja: null,
      },
    };

    await consumePersonalEvent(tx, envelope);

    expect(statements.some((statement) => statement.includes('INSERT INTO saldo_vacaciones')))
      .toBe(false);
  });
});
