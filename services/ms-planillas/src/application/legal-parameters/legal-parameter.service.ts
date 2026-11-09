import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  CreateLegalParameterDto,
  CreateSeniorityScaleDto,
  LegalParameterQueryDto,
  UpdateLegalParameterDto,
  UpdateSeniorityScaleDto,
} from './legal-parameter.dto';

type DateRange = { vigenciaDesde: Date; vigenciaHasta: Date | null };

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
              vigenciaDesde: { lte: instant },
              OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: instant } }],
            }
          : {}),
      },
      orderBy: [{ tipo: 'asc' }, { vigenciaDesde: 'desc' }],
    });
  }

  async find(id: string) {
    const value = await this.prisma.parametroLegal.findUnique({ where: { id } });
    if (!value) throw new NotFoundException('Parámetro legal no encontrado.');
    return value;
  }

  async create(dto: CreateLegalParameterDto, principal: InternalPrincipal) {
    const range = this.range(dto.vigenciaDesde, dto.vigenciaHasta);
    await this.assertParameterValue(dto.tipo, dto.valor);
    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.parametroLegal.findFirst({
        where: this.overlapWhere(range, { tipo: dto.tipo }),
      });
      if (overlap)
        throw new ConflictException('La vigencia se superpone con otro parámetro del mismo tipo.');
      const created = await tx.parametroLegal.create({
        data: { ...dto, ...range, creadoPor: principal.userId, actualizadoPor: principal.userId },
      });
      await this.audit(
        tx,
        principal.userId,
        'PARAMETRO_LEGAL_CREAR',
        'ParametroLegal',
        created.id,
        { despues: dto },
      );
      return created;
    });
  }

  async update(id: string, dto: UpdateLegalParameterDto, principal: InternalPrincipal) {
    const current = await this.find(id);
    const tipo = dto.tipo ?? current.tipo;
    const valor = dto.valor ?? Number(current.valor);
    await this.assertParameterValue(tipo, valor);
    const range = this.range(
      dto.vigenciaDesde ?? current.vigenciaDesde.toISOString(),
      dto.vigenciaHasta === undefined ? current.vigenciaHasta?.toISOString() : dto.vigenciaHasta,
    );
    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.parametroLegal.findFirst({
        where: { ...this.overlapWhere(range, { tipo }), id: { not: id } },
      });
      if (overlap)
        throw new ConflictException('La vigencia se superpone con otro parámetro del mismo tipo.');
      const updated = await tx.parametroLegal.update({
        where: { id },
        data: { ...dto, ...range, actualizadoPor: principal.userId },
      });
      await this.audit(tx, principal.userId, 'PARAMETRO_LEGAL_MODIFICAR', 'ParametroLegal', id, {
        antes: current,
        despues: updated,
      });
      return updated;
    });
  }

  async remove(id: string, principal: InternalPrincipal) {
    const current = await this.find(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.parametroLegal.delete({ where: { id } });
      await this.audit(tx, principal.userId, 'PARAMETRO_LEGAL_ELIMINAR', 'ParametroLegal', id, {
        antes: current,
      });
    });
  }

  listScales() {
    return this.prisma.escalaBonoAntiguedad.findMany({
      orderBy: [{ vigenciaDesde: 'desc' }, { aniosDesde: 'asc' }],
    });
  }

  async createScale(dto: CreateSeniorityScaleDto, principal: InternalPrincipal) {
    this.assertYears(dto.aniosDesde, dto.aniosHasta);
    const range = this.range(dto.vigenciaDesde, dto.vigenciaHasta);
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.escalaBonoAntiguedad.findMany({
        where: this.overlapWhere(range, {}),
      });
      if (
        candidates.some((scale) =>
          this.yearsOverlap(dto.aniosDesde, dto.aniosHasta, scale.aniosDesde, scale.aniosHasta),
        )
      )
        throw new ConflictException('La escala se superpone en antigüedad y vigencia.');
      const created = await tx.escalaBonoAntiguedad.create({
        data: { ...dto, ...range, creadoPor: principal.userId, actualizadoPor: principal.userId },
      });
      await this.audit(
        tx,
        principal.userId,
        'ESCALA_ANTIGUEDAD_CREAR',
        'EscalaBonoAntiguedad',
        created.id,
        { despues: dto },
      );
      return created;
    });
  }

  async updateScale(id: string, dto: UpdateSeniorityScaleDto, principal: InternalPrincipal) {
    const current = await this.prisma.escalaBonoAntiguedad.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Escala no encontrada.');
    const years = {
      from: dto.aniosDesde ?? current.aniosDesde,
      to: dto.aniosHasta === undefined ? (current.aniosHasta ?? undefined) : dto.aniosHasta,
    };
    this.assertYears(years.from, years.to);
    const range = this.range(
      dto.vigenciaDesde ?? current.vigenciaDesde.toISOString(),
      dto.vigenciaHasta === undefined ? current.vigenciaHasta?.toISOString() : dto.vigenciaHasta,
    );
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.escalaBonoAntiguedad.findMany({
        where: { ...this.overlapWhere(range, {}), id: { not: id } },
      });
      if (
        candidates.some((scale) =>
          this.yearsOverlap(years.from, years.to, scale.aniosDesde, scale.aniosHasta),
        )
      )
        throw new ConflictException('La escala se superpone en antigüedad y vigencia.');
      const updated = await tx.escalaBonoAntiguedad.update({
        where: { id },
        data: { ...dto, ...range, actualizadoPor: principal.userId },
      });
      await this.audit(
        tx,
        principal.userId,
        'ESCALA_ANTIGUEDAD_MODIFICAR',
        'EscalaBonoAntiguedad',
        id,
        { antes: current, despues: updated },
      );
      return updated;
    });
  }

  async removeScale(id: string, principal: InternalPrincipal) {
    const current = await this.prisma.escalaBonoAntiguedad.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Escala no encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.escalaBonoAntiguedad.delete({ where: { id } });
      await this.audit(
        tx,
        principal.userId,
        'ESCALA_ANTIGUEDAD_ELIMINAR',
        'EscalaBonoAntiguedad',
        id,
        { antes: current },
      );
    });
  }

  private async assertParameterValue(tipo: string, valor: number) {
    if (tipo !== 'SALARIO_MINIMO_NACIONAL' && valor > 100)
      throw new BadRequestException('Un aporte porcentual no puede superar 100.');
    if (tipo === 'SALARIO_MINIMO_NACIONAL' && valor <= 0)
      throw new BadRequestException('El salario mínimo debe ser mayor que cero.');
  }
  private assertYears(from: number, to?: number) {
    if (to !== undefined && to < from)
      throw new BadRequestException('aniosHasta debe ser mayor o igual a aniosDesde.');
  }
  private date(value: string) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Fecha inválida.');
    return date;
  }
  private range(from: string, to?: string): DateRange {
    const range = { vigenciaDesde: this.date(from), vigenciaHasta: to ? this.date(to) : null };
    if (range.vigenciaHasta && range.vigenciaHasta < range.vigenciaDesde)
      throw new BadRequestException('vigenciaHasta no puede ser anterior a vigenciaDesde.');
    return range;
  }
  private overlapWhere(range: DateRange, extra: Record<string, unknown>) {
    return {
      ...extra,
      vigenciaDesde: { lte: range.vigenciaHasta ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: range.vigenciaDesde } }],
    };
  }
  private yearsOverlap(aFrom: number, aTo: number | undefined, bFrom: number, bTo: number | null) {
    return aFrom <= (bTo ?? Number.MAX_SAFE_INTEGER) && bFrom <= (aTo ?? Number.MAX_SAFE_INTEGER);
  }
  private async audit(
    tx: any,
    userId: string,
    accion: string,
    entidad: string,
    entidadId: string,
    datos: unknown,
  ) {
    const safeData = JSON.parse(JSON.stringify(datos)) as Record<string, unknown>;
    await tx.outboxEvento.create({
      data: {
        id: randomUUID(),
        eventName: 'AUDITORIA_REGISTRADA',
        payload: {
          usuarioId: userId,
          accion,
          modulo: 'planillas',
          entidad,
          entidadId,
          datos: safeData,
        },
        occurredOn: new Date(),
      },
    });
  }
}
