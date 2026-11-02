import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { VacationBalanceService } from './vacation-balance.service';

describe('VacationBalanceService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the authenticated employee balance with pending days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
    const employeeId = '00000000-0000-4000-8000-000000000101';
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            empleado_id: employeeId,
            estado: 'RATIFICADO',
            fecha_ingreso: new Date('2025-10-30T00:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([{ valor: '15' }])
        .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000102' }])
        .mockResolvedValueOnce([{ gestion: 1, dias_asignados: 15, dias_tomados: 4 }])
        .mockResolvedValueOnce([{ valor: '2' }]),
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService;
    const service = new VacationBalanceService(prisma);

    await expect(service.getForEmployee(employeeId)).resolves.toEqual({
      empleadoId: employeeId,
      elegible: true,
      advertencias: [],
      gestiones: [
        {
          gestion: 1,
          diasAsignados: 15,
          diasTomados: 4,
          diasPendientes: 11,
        },
      ],
    });
  });

  it('returns an empty balance for employees who are not ratified', async () => {
    const employeeId = '00000000-0000-4000-8000-000000000201';
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            empleado_id: employeeId,
            estado: 'EN_PRUEBA',
            fecha_ingreso: new Date('2025-10-30T00:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService;
    const service = new VacationBalanceService(prisma);

    await expect(service.getForEmployee(employeeId)).resolves.toEqual({
      empleadoId: employeeId,
      elegible: false,
      advertencias: [],
      gestiones: [],
    });
  });

  it('warns when the configured number of vacation managements is pending', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
    const employeeId = '00000000-0000-4000-8000-000000000301';
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            empleado_id: employeeId,
            estado: 'RATIFICADO',
            fecha_ingreso: new Date('2024-10-30T00:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([{ valor: '15' }])
        .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000302' }])
        .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000303' }])
        .mockResolvedValueOnce([
          { gestion: 1, dias_asignados: 15, dias_tomados: 0 },
          { gestion: 2, dias_asignados: 15, dias_tomados: 0 },
        ])
        .mockResolvedValueOnce([{ valor: '2' }]),
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService;
    const service = new VacationBalanceService(prisma);

    await expect(service.getForEmployee(employeeId)).resolves.toMatchObject({
      empleadoId: employeeId,
      elegible: true,
      advertencias: ['VAC_GESTION_BLOQUEADA'],
    });
  });
});
