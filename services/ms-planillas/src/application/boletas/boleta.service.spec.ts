import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BoletaService } from './boleta.service';

const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: '22222222-2222-4222-8222-222222222222',
  rol: 'FUNCIONARIO',
  permisos: ['boleta:read_own'],
};

const detail = {
  id: '33333333-3333-4333-8333-333333333333',
  empleadoId: principal.empleadoId,
  nombreCompleto: 'Ana Rojas',
  ciEnmascarado: '***1234',
  diasTrabajados: 30,
  haberGanado: { toFixed: () => '5000.00' },
  bonoAntiguedad: { toFixed: () => '200.00' },
  otrosIngresos: { toFixed: () => '0.00' },
  totalGanado: { toFixed: () => '5200.00' },
  aporteLaboral: { toFixed: () => '660.92' },
  ans: { toFixed: () => '0.00' },
  rcIva: { toFixed: () => '0.00' },
  otrosDescuentos: { toFixed: () => '0.00' },
  totalDescuentos: { toFixed: () => '660.92' },
  liquidoPagable: { toFixed: () => '4539.08' },
  subsidios: { prenatal: '100.00' },
  planilla: { periodo: '2026-10', estado: 'CERRADA' },
  boleta: null,
};

function harness(value: any = detail) {
  const prisma = {
    planillaDetalleNomina: {
      findUnique: jest.fn().mockResolvedValue(value),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    boletaNomina: { upsert: jest.fn().mockResolvedValue({}), findFirst: jest.fn() },
  };
  return { service: new BoletaService(prisma as any), prisma };
}

describe('BoletaService', () => {
  it('lista solo las boletas cerradas del funcionario con paginación', async () => {
    const auditor = { ...principal, permisos: ['boleta:read_all'] };
    const { service, prisma } = harness();
    prisma.planillaDetalleNomina.findMany.mockResolvedValue([
      {
        planillaId: '44444444-4444-4444-8444-444444444444',
        planilla: { periodo: '2026-10', cerradoEn: new Date('2026-10-31T12:00:00.000Z') },
        boleta: { estado: 'EMITIDA', emitidaEn: new Date('2026-10-31T12:01:00.000Z') },
      },
    ]);
    prisma.planillaDetalleNomina.count.mockResolvedValue(1);

    await expect(
      service.listarPorEmpleado(principal.empleadoId!, 1, 20, auditor),
    ).resolves.toEqual({
      data: [
        {
          planillaId: '44444444-4444-4444-8444-444444444444',
          periodo: '2026-10',
          estado: 'EMITIDA',
          emitidaEn: '2026-10-31T12:01:00.000Z',
          cerradaEn: '2026-10-31T12:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(prisma.planillaDetalleNomina.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empleadoId: principal.empleadoId, planilla: { estado: 'CERRADA' } },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('no permite a quien solo lee su boleta listar el historial de terceros', async () => {
    const { service } = harness();
    await expect(
      service.listarPorEmpleado(
        principal.empleadoId!,
        1,
        20,
        { ...principal, permisos: ['boleta:read_own'] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('genera PDF final, calcula SHA-256 y persiste exactamente esos bytes', async () => {
    const { service, prisma } = harness();
    const result = await service.descargar(
      '44444444-4444-4444-8444-444444444444',
      principal.empleadoId!,
      principal,
    );
    expect(result.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.hashSha256).toBe(createHash('sha256').update(result.bytes).digest('hex'));
    const stored = prisma.boletaNomina.upsert.mock.calls[0][0].create.documento as Uint8Array;
    expect(Buffer.from(stored)).toEqual(result.bytes);
  });

  it('rechaza boletas definitivas de planillas no cerradas', async () => {
    const { service } = harness({
      ...detail,
      planilla: { periodo: '2026-10', estado: 'BORRADOR' },
    });
    await expect(
      service.descargar('44444444-4444-4444-8444-444444444444', principal.empleadoId!, principal),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('oculta boletas ajenas cuando no existe permiso global', async () => {
    const { service } = harness();
    await expect(
      service.descargar(
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
        principal,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detecta un PDF alterado porque su hash no está registrado', async () => {
    const { service, prisma } = harness();
    prisma.boletaNomina.findFirst.mockResolvedValue(null);
    await expect(service.verificar(Buffer.from('%PDF-alterado'))).resolves.toMatchObject({
      integra: false,
    });
  });
});
