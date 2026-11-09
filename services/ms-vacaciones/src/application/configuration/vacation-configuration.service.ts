import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  CreateHolidayDto,
  UpdateHolidayDto,
  UpdateVacationConfigurationDto,
} from './vacation-configuration.dto';
import type { VacationPolicy } from './vacation-policy';

const DEFAULT_POLICY: VacationPolicy = {
  maxGestionesAcumuladas: 2,
  diasEscalaInicial: 15,
  diasEscalaMedia: 20,
  diasEscalaMayor: 30,
};
const KEYS = {
  maxGestionesAcumuladas: 'MAX_GESTIONES_ACUMULADAS',
  diasEscalaInicial: 'ESCALA_0_A_4',
  diasEscalaMedia: 'ESCALA_5_A_9',
  diasEscalaMayor: 'ESCALA_10_MAS',
} as const;

@Injectable()
export class VacationConfigurationService {
  constructor(private readonly prisma: PrismaService) {}
  listHolidays(year?: number) {
    const where = year
      ? {
          fecha: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
          },
        }
      : {};
    return this.prisma.feriado.findMany({ where, orderBy: { fecha: 'asc' } });
  }
  async createHoliday(dto: CreateHolidayDto, principal: InternalPrincipal) {
    this.assertDepartment(dto.ambito, dto.departamento);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feriado.create({
        data: {
          ...dto,
          fecha: this.date(dto.fecha),
          departamento: dto.ambito === 'NACIONAL' ? '' : dto.departamento!.trim(),
        },
      });
      await this.audit(tx, principal.userId, 'FERIADO_CREAR', 'Feriado', created.id, {
        despues: dto,
      });
      return created;
    });
  }
  async updateHoliday(id: string, dto: UpdateHolidayDto, principal: InternalPrincipal) {
    const current = await this.prisma.feriado.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Feriado no encontrado.');
    const ambito = dto.ambito ?? current.ambito;
    const departamento = dto.departamento ?? current.departamento;
    this.assertDepartment(ambito, departamento);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.feriado.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.fecha ? { fecha: this.date(dto.fecha) } : {}),
          departamento: ambito === 'NACIONAL' ? '' : departamento.trim(),
        },
      });
      await this.audit(tx, principal.userId, 'FERIADO_MODIFICAR', 'Feriado', id, {
        antes: current,
        despues: updated,
      });
      return updated;
    });
  }
  async removeHoliday(id: string, principal: InternalPrincipal) {
    const current = await this.prisma.feriado.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Feriado no encontrado.');
    await this.prisma.$transaction(async (tx) => {
      await tx.feriado.delete({ where: { id } });
      await this.audit(tx, principal.userId, 'FERIADO_ELIMINAR', 'Feriado', id, { antes: current });
    });
  }
  async getPolicy(): Promise<VacationPolicy> {
    const rows = await this.prisma.configuracionVacaciones.findMany({
      where: { clave: { in: Object.values(KEYS) } },
    });
    const values = new Map(rows.map((row) => [row.clave, Number(row.valor)]));
    return Object.fromEntries(
      Object.entries(KEYS).map(([property, key]) => [
        property,
        values.get(key) ?? DEFAULT_POLICY[property as keyof VacationPolicy],
      ]),
    ) as unknown as VacationPolicy;
  }
  async updatePolicy(dto: UpdateVacationConfigurationDto, principal: InternalPrincipal) {
    if (dto.maxGestionesAcumuladas !== undefined && dto.maxGestionesAcumuladas > 2)
      throw new BadRequestException('El límite permitido es de dos gestiones.');
    const next = { ...(await this.getPolicy()), ...dto };
    if (!(
      next.diasEscalaInicial <= next.diasEscalaMedia && next.diasEscalaMedia <= next.diasEscalaMayor
    ))
      throw new BadRequestException('Las escalas de días deben ser ascendentes.');
    await this.prisma.$transaction(async (tx) => {
      for (const [property, key] of Object.entries(KEYS)) {
        await tx.configuracionVacaciones.upsert({
          where: { clave: key },
          create: { clave: key, valor: String(next[property as keyof VacationPolicy]) },
          update: { valor: String(next[property as keyof VacationPolicy]) },
        });
      }
      await this.audit(
        tx,
        principal.userId,
        'CONFIGURACION_VACACIONES_MODIFICAR',
        'ConfiguracionVacaciones',
        'POLITICA',
        { despues: next },
      );
    });
    return next;
  }
  private assertDepartment(scope: string, department?: string) {
    if (scope === 'DEPARTAMENTAL' && !department?.trim())
      throw new BadRequestException('departamento es obligatorio para un feriado departamental.');
  }
  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
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
          modulo: 'vacaciones',
          entidad,
          entidadId,
          datos: safeData,
        },
        occurredOn: new Date(),
      },
    });
  }
}
