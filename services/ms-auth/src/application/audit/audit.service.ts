import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, type AuditRepository } from '../../domain/audit/audit.repository';
import type { ListAuditQueryDto } from './audit.dto';

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly repository: AuditRepository) {}

  async list(query: ListAuditQueryDto) {
    const desde = query.desde ? new Date(query.desde) : undefined;
    const hasta = query.hasta ? new Date(query.hasta) : undefined;
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El rango de fechas no es válido.',
      });
    }
    const result = await this.repository.list({
      usuarioId: query.usuarioId,
      modulo: query.modulo,
      desde,
      hasta,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}
