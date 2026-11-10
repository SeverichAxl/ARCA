import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  CreateLegalParameterDto,
  LegalParameterQueryDto,
  UpdateLegalParameterDto,
} from './legal-parameter.dto';

type DateRange = { vigenteDesde: Date; vigenteHasta: Date | null };

@Injectable()
export class LegalParameterService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: LegalParameterQueryDto) {
    const instant = query.vigenteEn ? this.date(query.vigenteEn) : undefined;
    return this.prisma.parametroLegal.findMany({
      where: {
        ...(query.tipo ? { tipo: query.tipo } : {}),
        ...(instant
          ? {
              vigenteDesde: { lte: instant },
              OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: instant } }],
            }
          : {}),
      },
      orderBy: [{ tipo: 'asc' }, { clave: 'asc' }, { vigenteDesde: 'desc' }],
    });
  }

  async create(dto: CreateLegalParameterDto, principal: InternalPrincipal) {
    this.assertValue(dto.tipo, dto.valor);
    const range = this.range(dto.vigenteDesde, dto.vigenteHasta);
    return this.prisma.$transaction(async (tx) => {
      await this.lockValidityRange(tx, dto.tipo, dto.clave);
      const overlap = await tx.parametroLegal.findFirst({
        where: this.overlapWhere(range, { tipo: dto.tipo, clave: dto.clave }),
      });
      if (overlap)
        throw new ConflictException('La vigencia se superpone con el mismo tipo y clave.');
      const created = await tx.parametroLegal.create({
        data: {
          tipo: dto.tipo,
          clave: dto.clave,
          valor: dto.valor,
          unidad: dto.unidad,
          metadata: dto.metadata as never,
          ...range,
          activo: dto.activo ?? true,
          creadoPor: principal.userId,
        },
      });
      await this.audit(tx, principal.userId, 'PLANILLA_PARAMETRO_CREAR', created.id, {
        despues: created,
      });
      return created;
    });
  }

  async update(id: string, dto: UpdateLegalParameterDto, principal: InternalPrincipal) {
    const current = await this.prisma.parametroLegal.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Parámetro legal no encontrado.');
    this.assertValue(current.tipo, dto.valor ?? Number(current.valor));
    const vigenteHasta = dto.vigenteHasta ? this.date(dto.vigenteHasta) : current.vigenteHasta;
    if (vigenteHasta && vigenteHasta < current.vigenteDesde)
      throw new BadRequestException('vigenteHasta no puede ser anterior a vigenteDesde.');
    const range = { vigenteDesde: current.vigenteDesde, vigenteHasta };
    return this.prisma.$transaction(async (tx) => {
      await this.lockValidityRange(tx, current.tipo, current.clave);
      const overlap = await tx.parametroLegal.findFirst({
        where: {
          ...this.overlapWhere(range, { tipo: current.tipo, clave: current.clave }),
          id: { not: id },
        },
      });
      if (overlap)
        throw new ConflictException('La vigencia se superpone con el mismo tipo y clave.');
      const updated = await tx.parametroLegal.update({
        where: { id },
        data: {
          ...(dto.valor === undefined ? {} : { valor: dto.valor }),
          ...(dto.unidad === undefined ? {} : { unidad: dto.unidad }),
          ...(dto.metadata === undefined ? {} : { metadata: dto.metadata as never }),
          ...(dto.vigenteHasta === undefined ? {} : { vigenteHasta }),
          ...(dto.activo === undefined ? {} : { activo: dto.activo }),
        },
      });
      await this.audit(tx, principal.userId, 'PLANILLA_PARAMETRO_ACTUALIZAR', id, {
        antes: current,
        despues: updated,
      });
      return updated;
    });
  }

  private assertValue(tipo: string, valor: number): void {
    if (['APORTE_LABORAL', 'APORTE_PATRONAL'].includes(tipo) && valor > 100)
      throw new BadRequestException('Un aporte porcentual no puede superar 100.');
    if (tipo === 'SMN' && valor <= 0)
      throw new BadRequestException('El salario mínimo debe ser mayor que cero.');
  }

  private date(value: string): Date {
    const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Fecha inválida.');
    return date;
  }

  private range(from: string, to?: string): DateRange {
    const range = { vigenteDesde: this.date(from), vigenteHasta: to ? this.date(to) : null };
    if (range.vigenteHasta && range.vigenteHasta < range.vigenteDesde)
      throw new BadRequestException('vigenteHasta no puede ser anterior a vigenteDesde.');
    return range;
  }

  private overlapWhere(range: DateRange, extra: Record<string, unknown>) {
    return {
      ...extra,
      vigenteDesde: { lte: range.vigenteHasta ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: range.vigenteDesde } }],
    };
  }

  private async lockValidityRange(tx: any, tipo: string, clave: string): Promise<void> {
    // Serializa altas/ediciones de la misma serie para que dos transacciones
    // concurrentes no puedan aprobar rangos superpuestos a la vez.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tipo}:${clave}`}, 0))`;
  }

  private async audit(
    tx: any,
    userId: string,
    accion: string,
    entidadId: string,
    datos: unknown,
  ): Promise<void> {
    const safeData = JSON.parse(JSON.stringify(datos)) as Record<string, unknown>;
    await tx.outboxEvento.create({
      data: {
        id: randomUUID(),
        eventName: 'AUDITORIA_REGISTRADA',
        payload: {
          usuarioId: userId,
          accion,
          modulo: 'planillas',
          entidad: 'ParametroLegal',
          entidadId,
          datos: safeData,
        },
        occurredOn: new Date(),
      },
    });
  }
}
