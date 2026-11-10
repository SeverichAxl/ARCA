import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/client';
import { formatCents, formatPorcentaje, toCents } from '../../../domain/common/money';
import type { NovedadNomina } from '../../../domain/nomina/calculo';
import type { ParametroLegalRaw } from '../../../domain/nomina/parametros';
import {
  type ErrorProceso,
  EstadoInvalidoError,
  type FiltroDetalle,
  type FiltroPlanillas,
  type GuardarNovedadInput,
  type GuardarResultadoInput,
  type KpisPeriodo,
  type NovedadRegistro,
  type Pagina,
  PeriodoDuplicadoError,
  type PlanillaCabecera,
  type PlanillaDetalleRegistro,
  PlanillaInmutableError,
  PlanillaNoEncontradaError,
  type PlanillaRepository,
} from '../../../domain/planillas/planilla.models';
import { PrismaService } from '../prisma.service';

/**
 * Adaptador Prisma sobre el modelo base de TSK-ARQ-202 (planilla_mensual,
 * planilla_detalle) más las columnas del motor (migración 20261109120000).
 */
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

type PlanillaRow = Prisma.PlanillaMensualGetPayload<object>;
type DetalleRow = Prisma.PlanillaDetalleGetPayload<{
  include: { planilla: { select: { periodo: true; estado: true } } };
}>;
type NovedadRow = Prisma.NovedadPlanillaGetPayload<object>;

const money = (value: Prisma.Decimal): string => value.toFixed(2);
const toDate = (fecha: string): Date => new Date(`${fecha.slice(0, 10)}T00:00:00.000Z`);
const fromDate = (fecha: Date): string => fecha.toISOString().slice(0, 10);

function asStringRecord(value: Prisma.JsonValue | null): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function paginar<T>(data: T[], total: number, page: number, pageSize: number): Pagina<T> {
  return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

/** Convierte el RAISE de los triggers de inmutabilidad en un error de dominio. */
function traducirErrorBd(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PLAN_INMUTABLE') || message.includes('Registro inmutable')) {
    throw new PlanillaInmutableError();
  }
  throw error;
}

function mapCabecera(row: PlanillaRow): PlanillaCabecera {
  const [anio, mes] = row.periodo.split('-').map(Number);
  return {
    id: row.id,
    periodo: row.periodo,
    anio,
    mes,
    estado: row.estado,
    version: row.version,
    parametros: row.parametrosAplicados,
    totalEmpleados: row.totalEmpleados,
    totalGanado: money(row.totalGanado),
    totalAportesLaborales: money(row.totalAportesLab),
    totalAns: money(row.totalAns),
    totalRcIva: money(row.totalRcIva),
    totalOtrosDescuentos: money(row.totalOtrosDescuentos),
    totalLiquido: money(row.totalLiquido),
    totalAportesPatronales: money(row.totalAportesPat),
    duracionMs: row.duracionMs ?? 0,
    calculadoPor: row.procesadaPor,
    calculadoEn: row.procesadaEn,
    cerradoPor: row.cerradaPor,
    cerradoEn: row.cerradaEn,
    retencionHasta: row.retencionHasta ? fromDate(row.retencionHasta) : null,
    observacion: row.observacion,
    errorProceso: asErrorProceso(row.errorProceso),
  };
}

function asErrorProceso(value: Prisma.JsonValue | null): ErrorProceso | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { code, message, empleadoId } = value as Record<string, unknown>;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return typeof empleadoId === 'string' ? { code, message, empleadoId } : { code, message };
}

function mapDetalle(row: DetalleRow): PlanillaDetalleRegistro {
  return {
    id: row.id,
    planillaId: row.planillaId,
    periodo: row.planilla.periodo,
    estado: row.planilla.estado,
    empleadoId: row.empleadoId,
    nombreCompleto: row.nombreCompleto ?? '',
    ciEnmascarado: row.ciEnmascarado,
    areaId: row.areaId,
    cargoId: row.cargoId,
    fechaIngreso: row.fechaIngreso ? fromDate(row.fechaIngreso) : null,
    haberBasico: money(row.haberBasico),
    diasTrabajados: row.diasTrabajados,
    haberGanado: money(row.haberGanado),
    aniosAntiguedad: row.aniosAntiguedad,
    porcentajeBono: row.porcentajeBono.toFixed(4),
    bonoAntiguedad: money(row.bonoAntiguedad),
    otrosIngresos: money(row.otrosIngresos),
    totalGanado: money(row.totalGanado),
    aporteLaboral: money(row.aporteLaboral),
    ans: money(row.ans),
    rcIvaBaseImponible: money(row.rcIvaBaseImponible),
    rcIvaImpuesto: money(row.rcIvaImpuesto),
    rcIvaComputable: money(row.rcIvaComputable),
    rcIvaSaldoAnterior: money(row.rcIvaSaldoAnterior),
    rcIvaSaldoSiguiente: money(row.rcIvaSaldoSiguiente),
    rcIva: money(row.rcIva),
    otrosDescuentos: money(row.otrosDescuentos),
    totalDescuentos: money(row.totalDescuentos),
    liquidoPagable: money(row.liquidoPagable),
    aportePatronal: money(row.aportePatronal),
    subsidios: asStringRecord(row.subsidiosInfo),
  };
}

function mapNovedad(row: NovedadRow): NovedadRegistro {
  return {
    periodo: row.periodo,
    empleadoId: row.empleadoId,
    diasTrabajados: row.diasTrabajados,
    otrosIngresos: money(row.otrosIngresos),
    otrosDescuentos: money(row.otrosDescuentos),
    rcIvaComputable: money(row.rcIvaComputable),
    subsidios: asStringRecord(row.subsidios),
    observacion: row.observacion,
    actualizadoPor: row.actualizadoPor,
    actualizadoEn: row.actualizadoEn,
  };
}

const INCLUDE_PLANILLA = { planilla: { select: { periodo: true, estado: true } } } as const;

@Injectable()
export class PrismaPlanillaRepository implements PlanillaRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------ parámetros

  async obtenerParametrosVigentes(fechaCorte: string): Promise<ParametroLegalRaw[]> {
    const fecha = toDate(fechaCorte);
    const filas = await this.prisma.parametroLegal.findMany({
      where: {
        activo: true,
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      orderBy: [{ tipo: 'asc' }, { clave: 'asc' }, { vigenteDesde: 'desc' }],
    });
    const vigentes = new Map<string, ParametroLegalRaw>();
    for (const fila of filas) {
      const id = `${fila.tipo}:${fila.clave}`;
      if (vigentes.has(id)) continue;
      vigentes.set(id, {
        tipo: fila.tipo,
        clave: fila.clave,
        valor: fila.valor.toString(),
        metadata: fila.metadata,
        vigenteDesde: fromDate(fila.vigenteDesde),
      });
    }
    return [...vigentes.values()];
  }

  async obtenerRetencionAnios(): Promise<number> {
    const fila = await this.prisma.configuracionPlanillas.findUnique({
      where: { clave: 'RETENCION_ANIOS' },
    });
    const anios = fila ? Number.parseInt(fila.valor, 10) : 8;
    // La BD impide valores < 8; el máximo protege contra una configuración absurda.
    return Number.isInteger(anios) && anios >= 8 && anios <= 100 ? anios : 8;
  }

  // ------------------------------------------------------------- novedades

  async listarNovedades(periodo: string): Promise<NovedadRegistro[]> {
    const rows = await this.prisma.novedadPlanilla.findMany({
      where: { periodo },
      orderBy: { empleadoId: 'asc' },
    });
    return rows.map(mapNovedad);
  }

  async novedadesComoMapa(periodo: string): Promise<Map<string, NovedadNomina>> {
    const rows = await this.prisma.novedadPlanilla.findMany({ where: { periodo } });
    return new Map(
      rows.map((row) => [
        row.empleadoId,
        {
          diasTrabajados: row.diasTrabajados,
          otrosIngresos: toCents(row.otrosIngresos),
          otrosDescuentos: toCents(row.otrosDescuentos),
          rcIvaComputable: toCents(row.rcIvaComputable),
          subsidios: asStringRecord(row.subsidios),
        },
      ]),
    );
  }

  async guardarNovedad(input: GuardarNovedadInput): Promise<NovedadRegistro> {
    const data = {
      diasTrabajados: input.diasTrabajados,
      otrosIngresos: formatCents(input.otrosIngresos),
      otrosDescuentos: formatCents(input.otrosDescuentos),
      rcIvaComputable: formatCents(input.rcIvaComputable),
      subsidios: input.subsidios,
      observacion: input.observacion,
      actualizadoPor: input.actorUserId,
    };
    try {
      const row = await this.prisma.novedadPlanilla.upsert({
        where: { periodo_empleadoId: { periodo: input.periodo, empleadoId: input.empleadoId } },
        create: { periodo: input.periodo, empleadoId: input.empleadoId, ...data },
        update: data,
      });
      return mapNovedad(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('PLAN_INMUTABLE')) {
        throw new EstadoInvalidoError(input.periodo, 'CERRADA', 'novedad');
      }
      return traducirErrorBd(error);
    }
  }

  async saldosRcIva(periodo: string): Promise<Map<string, bigint>> {
    const rows = await this.prisma.planillaDetalle.findMany({
      where: { planilla: { periodo, estado: 'CERRADA' } },
      select: { empleadoId: true, rcIvaSaldoSiguiente: true },
    });
    return new Map(rows.map((row) => [row.empleadoId, toCents(row.rcIvaSaldoSiguiente)]));
  }

  // --------------------------------------------------------- ciclo de vida

  async buscarPorPeriodo(periodo: string): Promise<PlanillaCabecera | null> {
    const row = await this.prisma.planillaMensual.findUnique({ where: { periodo } });
    return row ? mapCabecera(row) : null;
  }

  async buscarPorId(id: string): Promise<PlanillaCabecera | null> {
    const row = await this.prisma.planillaMensual.findUnique({ where: { id } });
    return row ? mapCabecera(row) : null;
  }

  async iniciarProceso(
    periodo: string,
    actorUserId: string,
    iniciadoEn: Date,
    observacion: string | null,
  ): Promise<PlanillaCabecera> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.bloquearPeriodo(tx, periodo);
        const existente = await tx.planillaMensual.findUnique({
          where: { periodo },
          select: { id: true },
        });
        if (existente) throw new PeriodoDuplicadoError(periodo);
        return mapCabecera(
          await tx.planillaMensual.create({
            data: {
              periodo,
              estado: 'EN_PROCESO',
              procesadaPor: actorUserId,
              procesadaEn: iniciadoEn,
              observacion,
            },
          }),
        );
      }, TX_OPTIONS);
    } catch (error) {
      if (error instanceof PeriodoDuplicadoError) throw error;
      // Carrera contra la restricción única de periodo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new PeriodoDuplicadoError(periodo);
      }
      return traducirErrorBd(error);
    }
  }

  async reiniciarProceso(
    id: string,
    actorUserId: string,
    iniciadoEn: Date,
    atascadaAntesDe: Date,
  ): Promise<PlanillaCabecera> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await tx.planillaMensual.findUnique({ where: { id } });
        if (!actual) throw new PlanillaNoEncontradaError();
        await this.bloquearPeriodo(tx, actual.periodo);
        const vigente = await tx.planillaMensual.findUniqueOrThrow({ where: { id } });
        const atascada =
          vigente.estado === 'EN_PROCESO' &&
          (vigente.procesadaEn === null || vigente.procesadaEn < atascadaAntesDe);
        if (vigente.estado === 'CERRADA' || (vigente.estado === 'EN_PROCESO' && !atascada)) {
          throw new EstadoInvalidoError(vigente.periodo, vigente.estado, 'recalcular');
        }
        return mapCabecera(
          await tx.planillaMensual.update({
            where: { id },
            data: {
              estado: 'EN_PROCESO',
              procesadaPor: actorUserId,
              procesadaEn: iniciadoEn,
              errorProceso: Prisma.DbNull,
            },
          }),
        );
      }, TX_OPTIONS);
    } catch (error) {
      if (error instanceof EstadoInvalidoError || error instanceof PlanillaNoEncontradaError) {
        throw error;
      }
      return traducirErrorBd(error);
    }
  }

  async guardarResultado(input: GuardarResultadoInput): Promise<PlanillaCabecera> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await tx.planillaMensual.findUnique({
          where: { id: input.planillaId },
          select: { periodo: true },
        });
        if (!actual) throw new PlanillaNoEncontradaError();
        await this.bloquearPeriodo(tx, actual.periodo);
        const vigente = await tx.planillaMensual.findUniqueOrThrow({
          where: { id: input.planillaId },
        });
        if (vigente.estado !== 'EN_PROCESO') {
          throw new EstadoInvalidoError(vigente.periodo, vigente.estado, 'guardar');
        }

        await tx.planillaDetalle.deleteMany({ where: { planillaId: vigente.id } });
        const actualizada = await tx.planillaMensual.update({
          where: { id: vigente.id },
          data: {
            estado: 'CALCULADA',
            version: { increment: 1 },
            parametrosAplicados: input.parametros as unknown as Prisma.InputJsonValue,
            errorProceso: Prisma.DbNull,
            totalEmpleados: input.totales.totalEmpleados,
            totalGanado: formatCents(input.totales.totalGanado),
            totalAportesLab: formatCents(input.totales.totalAportesLaborales),
            totalAportesPat: formatCents(input.totales.totalAportesPatronales),
            totalAns: formatCents(input.totales.totalAns),
            totalRcIva: formatCents(input.totales.totalRcIva),
            totalOtrosDescuentos: formatCents(input.totales.totalOtrosDescuentos),
            totalLiquido: formatCents(input.totales.totalLiquido),
            duracionMs: input.duracionMs,
          },
        });

        // Trazabilidad del RC-IVA computable editado (quién, cuándo, por qué).
        const novedades = new Map(
          (await tx.novedadPlanilla.findMany({ where: { periodo: vigente.periodo } })).map((n) => [
            n.empleadoId,
            n,
          ]),
        );

        await tx.planillaDetalle.createMany({
          data: input.detalles.map((d) => {
            const novedad = novedades.get(d.empleadoId);
            const rcIvaEditado = novedad !== undefined && d.rcIvaComputable > 0n;
            return {
              planillaId: vigente.id,
              empleadoId: d.empleadoId,
              nombreCompleto: d.nombreCompleto,
              ciEnmascarado: d.ciEnmascarado,
              areaId: d.areaId,
              cargoId: d.cargoId,
              fechaIngreso: toDate(d.fechaIngreso),
              haberBasico: formatCents(d.haberBasico),
              diasTrabajados: d.diasTrabajados,
              haberGanado: formatCents(d.haberGanado),
              aniosAntiguedad: d.aniosAntiguedad,
              porcentajeBono: formatPorcentaje(d.porcentajeBono),
              bonoAntiguedad: formatCents(d.bonoAntiguedad),
              otrosIngresos: formatCents(d.otrosIngresos),
              totalGanado: formatCents(d.totalGanado),
              aporteLaboral: formatCents(d.aporteLaboral),
              ans: formatCents(d.ans),
              rcIvaBaseImponible: formatCents(d.rcIvaBaseImponible),
              rcIvaImpuesto: formatCents(d.rcIvaImpuesto),
              rcIvaComputable: formatCents(d.rcIvaComputable),
              rcIvaEditadoPor: rcIvaEditado ? novedad.actualizadoPor : null,
              rcIvaEditadoEn: rcIvaEditado ? novedad.actualizadoEn : null,
              rcIvaObservacion: rcIvaEditado ? novedad.observacion : null,
              rcIvaSaldoAnterior: formatCents(d.rcIvaSaldoAnterior),
              rcIvaSaldoSiguiente: formatCents(d.rcIvaSaldoSiguiente),
              rcIva: formatCents(d.rcIva),
              otrosDescuentos: formatCents(d.otrosDescuentos),
              totalDescuentos: formatCents(d.totalDescuentos),
              liquidoPagable: formatCents(d.liquidoPagable),
              aportePatronal: formatCents(d.aportePatronal),
              subsidiosInfo: d.subsidios,
              calculoSnapshot: {
                parametrosEn: 'planilla_mensual.parametros_aplicados',
                version: actualizada.version,
              },
            };
          }),
        });
        return mapCabecera(actualizada);
      }, TX_OPTIONS);
    } catch (error) {
      if (error instanceof EstadoInvalidoError || error instanceof PlanillaNoEncontradaError) {
        throw error;
      }
      return traducirErrorBd(error);
    }
  }

  async marcarError(id: string, error: ErrorProceso): Promise<void> {
    await this.prisma.planillaMensual.updateMany({
      where: { id, estado: 'EN_PROCESO' },
      data: { estado: 'ERROR', errorProceso: { ...error } },
    });
  }

  async cerrar(
    id: string,
    actorUserId: string,
    cerradoEn: Date,
    retencionHasta: string,
  ): Promise<PlanillaCabecera | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await tx.planillaMensual.findUnique({
          where: { id },
          select: { periodo: true },
        });
        if (!actual) return null;
        await this.bloquearPeriodo(tx, actual.periodo);
        const { count } = await tx.planillaMensual.updateMany({
          where: { id, estado: 'CALCULADA' },
          data: {
            estado: 'CERRADA',
            cerradaPor: actorUserId,
            cerradaEn: cerradoEn,
            retencionHasta: toDate(retencionHasta),
          },
        });
        if (count === 0) return null;
        return mapCabecera(await tx.planillaMensual.findUniqueOrThrow({ where: { id } }));
      }, TX_OPTIONS);
    } catch (error) {
      return traducirErrorBd(error);
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const actual = await tx.planillaMensual.findUnique({
          where: { id },
          select: { periodo: true, estado: true },
        });
        if (!actual) throw new PlanillaNoEncontradaError();
        if (actual.estado === 'CERRADA') {
          throw new EstadoInvalidoError(actual.periodo, actual.estado, 'eliminar');
        }
        await this.bloquearPeriodo(tx, actual.periodo);
        // FK RESTRICT: primero el detalle, luego la cabecera (nunca una cerrada).
        await tx.planillaDetalle.deleteMany({ where: { planillaId: id } });
        const { count } = await tx.planillaMensual.deleteMany({
          where: { id, estado: { not: 'CERRADA' } },
        });
        if (count === 0) throw new EstadoInvalidoError(actual.periodo, 'CERRADA', 'eliminar');
      }, TX_OPTIONS);
    } catch (error) {
      if (error instanceof EstadoInvalidoError || error instanceof PlanillaNoEncontradaError) {
        throw error;
      }
      traducirErrorBd(error);
    }
  }

  // ------------------------------------------------------------- consultas

  async listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>> {
    const periodo: Prisma.StringFilter = {
      ...(filtro.periodo ? { equals: filtro.periodo } : {}),
      ...(filtro.anio ? { startsWith: `${filtro.anio}-` } : {}),
      ...(filtro.desde ? { gte: filtro.desde } : {}),
      ...(filtro.hasta ? { lte: filtro.hasta } : {}),
    };
    const where: Prisma.PlanillaMensualWhereInput = {
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(Object.keys(periodo).length > 0 ? { periodo } : {}),
      ...(filtro.empleadoId ? { detalles: { some: { empleadoId: filtro.empleadoId } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planillaMensual.findMany({
        where,
        orderBy: { periodo: 'desc' },
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.planillaMensual.count({ where }),
    ]);
    return paginar(rows.map(mapCabecera), total, filtro.page, filtro.pageSize);
  }

  async listarDetalle(
    planillaId: string,
    filtro: FiltroDetalle,
  ): Promise<Pagina<PlanillaDetalleRegistro>> {
    const where: Prisma.PlanillaDetalleWhereInput = {
      planillaId,
      ...(filtro.areaId ? { areaId: filtro.areaId } : {}),
      ...(filtro.empleadoId ? { empleadoId: filtro.empleadoId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planillaDetalle.findMany({
        where,
        include: INCLUDE_PLANILLA,
        orderBy: [{ nombreCompleto: 'asc' }, { empleadoId: 'asc' }],
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.planillaDetalle.count({ where }),
    ]);
    return paginar(rows.map(mapDetalle), total, filtro.page, filtro.pageSize);
  }

  async obtenerDetalle(
    planillaId: string,
    empleadoId: string,
  ): Promise<PlanillaDetalleRegistro | null> {
    const row = await this.prisma.planillaDetalle.findUnique({
      where: { planillaId_empleadoId: { planillaId, empleadoId } },
      include: INCLUDE_PLANILLA,
    });
    return row ? mapDetalle(row) : null;
  }

  async listarPagosEmpleado(
    empleadoId: string,
    page: number,
    pageSize: number,
  ): Promise<Pagina<PlanillaDetalleRegistro>> {
    const where: Prisma.PlanillaDetalleWhereInput = { empleadoId, planilla: { estado: 'CERRADA' } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planillaDetalle.findMany({
        where,
        include: INCLUDE_PLANILLA,
        orderBy: { planilla: { periodo: 'desc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.planillaDetalle.count({ where }),
    ]);
    return paginar(rows.map(mapDetalle), total, page, pageSize);
  }

  async obtenerPagoEmpleado(
    empleadoId: string,
    periodo: string,
  ): Promise<PlanillaDetalleRegistro | null> {
    const row = await this.prisma.planillaDetalle.findFirst({
      where: { empleadoId, planilla: { periodo, estado: 'CERRADA' } },
      include: INCLUDE_PLANILLA,
    });
    return row ? mapDetalle(row) : null;
  }

  async areaDelEmpleado(empleadoId: string, hastaPeriodo: string): Promise<string | null> {
    const fila = await this.prisma.planillaDetalle.findFirst({
      where: {
        empleadoId,
        areaId: { not: null },
        planilla: { estado: 'CERRADA', periodo: { lte: hastaPeriodo } },
      },
      orderBy: { planilla: { periodo: 'desc' } },
      select: { areaId: true },
    });
    return fila?.areaId ?? null;
  }

  async kpisCerradas(
    hastaPeriodo: string | null,
    areaId: string | null,
    limite: number,
  ): Promise<KpisPeriodo[]> {
    const planillas = await this.prisma.planillaMensual.findMany({
      where: { estado: 'CERRADA', ...(hastaPeriodo ? { periodo: { lte: hastaPeriodo } } : {}) },
      orderBy: { periodo: 'desc' },
      take: limite,
      select: { id: true, periodo: true, totalGanado: true, totalAportesPat: true },
    });
    if (planillas.length === 0) return [];
    const ids = planillas.map((p) => p.id);

    const boletas = await this.prisma.boletaPago.groupBy({
      by: ['planillaId'],
      where: {
        planillaId: { in: ids },
        estado: 'EMITIDA',
        ...(areaId ? { detalle: { areaId } } : {}),
      },
      _count: { _all: true },
    });
    const boletasPorPlanilla = new Map(boletas.map((b) => [b.planillaId, b._count._all]));

    const costos = new Map<string, bigint>();
    if (areaId) {
      const sumas = await this.prisma.planillaDetalle.groupBy({
        by: ['planillaId'],
        where: { planillaId: { in: ids }, areaId },
        _sum: { totalGanado: true, aportePatronal: true },
      });
      for (const suma of sumas) {
        costos.set(
          suma.planillaId,
          toCents(suma._sum.totalGanado ?? '0') + toCents(suma._sum.aportePatronal ?? '0'),
        );
      }
    } else {
      for (const p of planillas) {
        costos.set(p.id, toCents(p.totalGanado) + toCents(p.totalAportesPat));
      }
    }

    return planillas.map((p) => ({
      periodo: p.periodo,
      costoPlanilla: formatCents(costos.get(p.id) ?? 0n),
      boletasEmitidas: boletasPorPlanilla.get(p.id) ?? 0,
    }));
  }

  /** Serializa proceso, cierre y descarte del mismo periodo (sin duplicados ni doble cierre). */
  private async bloquearPeriodo(tx: Prisma.TransactionClient, periodo: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`planilla:${periodo}`}))`;
  }
}
