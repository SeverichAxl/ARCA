import { PrismaContratoRepository } from './prisma-contrato.repository';
import type { PrismaService } from '../prisma.service';

describe('PrismaContratoRepository.findByEmpleadoId', () => {
  it('filtra por empleado y mapea las versiones y metadatos PDF sin revelar publicId', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        empleadoId: '22222222-2222-4222-8222-222222222222',
        plantillaId: '11111111-1111-4111-8111-111111111111',
        plantilla: { nombre: 'Contrato indefinido' },
        plantillaVersion: { version: 2 },
        estado: 'EMITIDO',
        creadoEn: new Date('2026-11-01T10:00:00.000Z'),
        versiones: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            version: 2,
            estado: 'EMITIDO',
            hashSha256: 'a'.repeat(64),
            firmadoTrabajador: true,
            firmadoRepresentante: true,
            generadoEn: new Date('2026-11-08T12:00:00.000Z'),
            documentoPublicId: 'private-cloudinary-id',
            documentoMime: 'application/pdf',
            documentoBytes: 125000,
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            version: 1,
            estado: 'GENERADO',
            hashSha256: 'b'.repeat(64),
            firmadoTrabajador: false,
            firmadoRepresentante: false,
            generadoEn: new Date('2026-11-01T10:00:00.000Z'),
            documentoPublicId: null,
            documentoMime: null,
            documentoBytes: null,
          },
        ],
      },
    ]);
    const repository = new PrismaContratoRepository({
      contrato: { findMany },
    } as unknown as PrismaService);

    await expect(
      repository.findByEmpleadoId('22222222-2222-4222-8222-222222222222'),
    ).resolves.toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        empleadoId: '22222222-2222-4222-8222-222222222222',
        plantillaId: '11111111-1111-4111-8111-111111111111',
        plantillaNombre: 'Contrato indefinido',
        plantillaVersion: 2,
        estado: 'EMITIDO',
        versionVigente: 2,
        versiones: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            version: 2,
            estado: 'EMITIDO',
            hashSha256: 'a'.repeat(64),
            firmadoTrabajador: true,
            firmadoRepresentante: true,
            creadoEn: new Date('2026-11-08T12:00:00.000Z'),
            documento: {
              publicIdRef: '33333333-3333-4333-8333-333333333333/v2',
              versionId: '44444444-4444-4444-8444-444444444444',
              mime: 'application/pdf',
              bytes: 125000,
            },
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            version: 1,
            estado: 'GENERADO',
            hashSha256: 'b'.repeat(64),
            firmadoTrabajador: false,
            firmadoRepresentante: false,
            creadoEn: new Date('2026-11-01T10:00:00.000Z'),
            documento: null,
          },
        ],
        creadoEn: new Date('2026-11-01T10:00:00.000Z'),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { empleadoId: '22222222-2222-4222-8222-222222222222' },
      include: {
        plantilla: { select: { nombre: true } },
        plantillaVersion: { select: { version: true } },
        versiones: { orderBy: { version: 'desc' } },
      },
      orderBy: { creadoEn: 'desc' },
    });
  });

  it('devuelve una lista vacía si no hay contratos asociados', async () => {
    const repository = new PrismaContratoRepository({
      contrato: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);

    await expect(
      repository.findByEmpleadoId('99999999-9999-4999-8999-999999999999'),
    ).resolves.toEqual([]);
  });
});
