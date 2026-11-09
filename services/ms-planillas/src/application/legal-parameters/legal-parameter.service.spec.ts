import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegalParameterService } from './legal-parameter.service';
const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: null,
  rol: 'ADMIN_GENERAL',
  permisos: ['parametros_ley:update'],
};
function prismaMock(overlap: unknown = null) {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    parametroLegal: {
      findFirst: jest.fn().mockResolvedValue(overlap),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 'p1', ...data })),
      update: jest.fn(),
    },
    outboxEvento: { create: jest.fn() },
  };
  return {
    tx,
    prisma: {
      parametroLegal: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: (fn: any) => fn(tx),
    } as any,
  };
}
describe('LegalParameterService', () => {
  it('crea el parámetro y su auditoría en una transacción', async () => {
    const { tx, prisma } = prismaMock();
    const service = new LegalParameterService(prisma);
    await service.create(
      { tipo: 'SMN' as any, clave: 'SMN_NACIONAL', valor: 3300, vigenteDesde: '2026-01-01' },
      principal,
    );
    expect(tx.parametroLegal.create).toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventName: 'AUDITORIA_REGISTRADA' }),
      }),
    );
  });
  it('toma un bloqueo transaccional antes de comprobar solapamientos', async () => {
    const { tx, prisma } = prismaMock();
    const service = new LegalParameterService(prisma);
    await service.create(
      { tipo: 'SMN' as any, clave: 'SMN_NACIONAL', valor: 3300, vigenteDesde: '2026-01-01' },
      principal,
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.parametroLegal.findFirst.mock.invocationCallOrder[0],
    );
  });
  it('rechaza vigencias superpuestas', async () => {
    const { prisma } = prismaMock({ id: 'existente' });
    const service = new LegalParameterService(prisma);
    await expect(
      service.create(
        {
          tipo: 'APORTE_LABORAL' as any,
          clave: 'AFP_LABORAL',
          valor: 12.71,
          vigenteDesde: '2026-01-01',
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rechaza porcentajes mayores a 100', async () => {
    const { prisma } = prismaMock();
    const service = new LegalParameterService(prisma);
    await expect(
      service.create(
        {
          tipo: 'APORTE_PATRONAL' as any,
          clave: 'AFP_PATRONAL',
          valor: 101,
          vigenteDesde: '2026-01-01',
        },
        principal,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
