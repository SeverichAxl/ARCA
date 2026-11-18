import { ForbiddenException, Injectable } from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { LicenseQueryDto } from './license-query.dto';

@Injectable()
export class VacationLicenseService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEmployee(
    empleadoId: string,
    principal: InternalPrincipal,
    query: LicenseQueryDto,
  ) {
    const canRead = principal.permisos.includes('licencias:read');
    const canManage = principal.permisos.includes('licencias:manage');
    if (!canRead && !canManage) {
      throw new ForbiddenException('No tienes permiso para consultar licencias.');
    }

    const where = { empleadoId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.licencia.findMany({
        where,
        orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          tipo: true,
          fechaInicio: true,
          fechaFin: true,
          estado: true,
          creadoEn: true,
        },
      }),
      this.prisma.licencia.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
}
