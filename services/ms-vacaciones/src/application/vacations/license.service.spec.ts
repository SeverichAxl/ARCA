import { ForbiddenException } from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LicenseQueryDto } from './license-query.dto';
import { VacationLicenseService } from './license.service';

const employeeId = '00000000-0000-4000-8000-000000000101';
const auditor: InternalPrincipal = {
  userId: '00000000-0000-4000-8000-000000000102',
  empleadoId: '00000000-0000-4000-8000-000000000103',
  rol: 'AUDITOR',
  permisos: ['licencias:read'],
};

function harness() {
  const rows = [
    {
      id: '00000000-0000-4000-8000-000000000104',
      tipo: 'PATERNIDAD',
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-03T00:00:00.000Z'),
      estado: 'AUTORIZADA',
      creadoEn: new Date('2026-09-20T00:00:00.000Z'),
    },
  ];
  const prisma = {
    licencia: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest
      .fn()
      .mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return {
    prisma,
    service: new VacationLicenseService(prisma as unknown as PrismaService),
  };
}

describe('VacationLicenseService', () => {
  it('lista los datos mínimos de las licencias de un empleado de forma paginada', async () => {
    const { prisma, service } = harness();
    const query = Object.assign(new LicenseQueryDto(), { page: 2, pageSize: 10 });

    await expect(service.listForEmployee(employeeId, auditor, query)).resolves.toMatchObject({
      data: [{ id: '00000000-0000-4000-8000-000000000104', estado: 'AUTORIZADA' }],
      meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(prisma.licencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empleadoId: employeeId },
        skip: 10,
        take: 10,
        select: expect.not.objectContaining({ respaldoPublicId: true, autorizadoPor: true }),
      }),
    );
  });

  it('permite lectura a Gestión Humana y rechaza a quien no tiene permiso de licencias', async () => {
    const { service, prisma } = harness();
    const query = new LicenseQueryDto();
    const hr: InternalPrincipal = {
      ...auditor,
      rol: 'RRHH_OPERATIVO',
      permisos: ['licencias:manage'],
    };

    await expect(service.listForEmployee(employeeId, hr, query)).resolves.toMatchObject({
      meta: { total: 1 },
    });
    await expect(
      service.listForEmployee(employeeId, { ...auditor, permisos: ['personal:read'] }, query),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.licencia.findMany).toHaveBeenCalledTimes(1);
  });
});
