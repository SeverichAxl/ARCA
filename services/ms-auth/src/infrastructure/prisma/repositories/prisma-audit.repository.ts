import { Injectable } from '@nestjs/common';
import type { AuditListQuery, AuditView } from '../../../domain/audit/audit.models';
import type { AuditRepository } from '../../../domain/audit/audit.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditListQuery): Promise<{ data: AuditView[]; total: number }> {
    const where = {
      ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
      ...(query.modulo ? { modulo: query.modulo } : {}),
      ...(query.desde || query.hasta
        ? {
            ocurridoEn: {
              ...(query.desde ? { gte: query.desde } : {}),
              ...(query.hasta ? { lte: query.hasta } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditoriaLog.findMany({
        where,
        orderBy: { ocurridoEn: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditoriaLog.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        ...row,
        id: row.id.toString(),
        resultado: row.resultado,
      })),
      total,
    };
  }
}
