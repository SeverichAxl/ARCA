import type { OutboxService } from '@arca/messaging';
import type { AreaRecord } from '../../../domain/catalogs/catalog.models';
import { PrismaCatalogRepository } from './prisma-catalog.repository';

const area = (overrides: Partial<AreaRecord> = {}): AreaRecord => ({
  id: 'area-1',
  nombre: 'Operaciones',
  padreId: null,
  jefeId: 'emp-1',
  activa: true,
  creadoEn: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

function fakePrisma(createResult: Promise<AreaRecord> | AreaRecord) {
  const tx = {
    area: {
      create: jest.fn().mockResolvedValue(createResult),
      update: jest.fn().mockResolvedValue(createResult),
    },
    outboxEvento: { create: jest.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  };
}

describe('PrismaCatalogRepository AREA_ACTUALIZADA', () => {
  it('crea el área y el evento en la misma transacción cuando lleva jefe', async () => {
    const { prisma, tx } = fakePrisma(area());
    const outbox = { add: jest.fn().mockResolvedValue({}) } as unknown as OutboxService;
    const repository = new PrismaCatalogRepository(prisma as never, outbox);

    const created = await repository.createArea(
      { nombre: 'Operaciones', padreId: null, jefeId: 'emp-1', activa: true },
      true,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.area.create).toHaveBeenCalledTimes(1);
    expect(outbox.add).toHaveBeenCalledWith(tx, 'AREA_ACTUALIZADA', {
      areaId: 'area-1',
      nombre: 'Operaciones',
      padreId: null,
      jefeEmpleadoId: 'emp-1',
    });
    expect(created.jefeId).toBe('emp-1');
  });

  it('no emite evento al crear un área sin jefe', async () => {
    const { prisma, tx } = fakePrisma(area({ jefeId: null }));
    const outbox = { add: jest.fn() } as unknown as OutboxService;
    const repository = new PrismaCatalogRepository(prisma as never, outbox);

    await repository.createArea(
      { nombre: 'Operaciones', padreId: null, jefeId: null, activa: true },
      false,
    );

    expect(tx.area.create).toHaveBeenCalledTimes(1);
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('actualiza el área y publica el evento juntos', async () => {
    const { prisma, tx } = fakePrisma(area({ jefeId: 'emp-2' }));
    const outbox = { add: jest.fn().mockResolvedValue({}) } as unknown as OutboxService;
    const repository = new PrismaCatalogRepository(prisma as never, outbox);

    await repository.updateArea('area-1', { jefeId: 'emp-2' }, true);

    expect(tx.area.update).toHaveBeenCalledWith({
      where: { id: 'area-1' },
      data: { jefeId: 'emp-2' },
    });
    expect(outbox.add).toHaveBeenCalledWith(
      tx,
      'AREA_ACTUALIZADA',
      expect.objectContaining({ areaId: 'area-1', jefeEmpleadoId: 'emp-2' }),
    );
  });

  it('si el cambio falla no se inserta el evento', async () => {
    const { prisma, tx } = fakePrisma(Promise.reject(new Error('falló el update')));
    const outbox = { add: jest.fn() } as unknown as OutboxService;
    const repository = new PrismaCatalogRepository(prisma as never, outbox);

    await expect(
      repository.updateArea('area-1', { nombre: 'Otro' }, true),
    ).rejects.toThrow('falló el update');
    expect(tx.outboxEvento.create).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });
});
