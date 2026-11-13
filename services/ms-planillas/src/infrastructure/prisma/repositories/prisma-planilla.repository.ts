import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/client';
import { formatCents, formatPorcentaje, toCents } from '../../../domain/common/money';
import type { NovedadNomina } from '../../../domain/nomina/calculo';
import { PrismaService } from '../prisma.service';
import {
  type FiltroDetalle,
  type FiltroPlanillas,
  type GuardarBorradorInput,
  type GuardarNovedadInput,
  type NovedadRegistro,
  type Pagina,
  type ParametrosVigentesRaw,
  type PlanillaCabecera,
  PlanillaCerradaError,
  type PlanillaDetalleRegistro,
  PlanillaInmutableError,
  type PlanillaRepository,
  type ResumenPeriodo,
} from '../../../domain/planillas/planilla.models';

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

type PlanillaRow = Prisma.PlanillaGetPayload<object>;
type DetalleRow = Prisma.PlanillaDetalleNominaGetPayload<{
  include: { planilla: { select: { periodo: true; estado: true } } };
}>;
type NovedadRow = Prisma.NovedadPlanillaGetPayload<object>;

const money = (value: Prisma.Decimal): string => value.toFixed(2);
const toDate = (fecha: string): Date => new Date(`${fecha.slice(0, 10)}T00:00:00.000Z`);
const fromDate = (fecha: Date): string => fecha.toISOString().slice(0, 10);

function asStringRecord(value: Prisma.JsonValue): Record<string, string> {
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

function traducirErrorBd(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PLAN_INMUTABLE')) throw new PlanillaInmutableError();
  throw error;
}

function mapCabecera(row: PlanillaRow): PlanillaCabecera {
  return {
    id: row.id,
    periodo: row.periodo,
    anio: row.anio,
    mes: row.mes,
    estado: row.estado,
    version: row.version,
    parametros: row.parametros,
    totalEmpleados: row.totalEmpleados,
    totalGanado: money(row.totalGanado),
    totalAportesLaborales: money(row.totalAportesLaborales),
    totalAns: money(row.totalAns),
    totalRcIva: money(row.totalRcIva),
    totalOtrosDescuentos: money(row.totalOtrosDescuentos),
    totalLiquido: money(row.totalLiquido),
    totalAportesPatronales: money(row.totalAportesPatronales),
    duracionMs: row.duracionMs,
    calculadoPor: row.calculadoPor,
    calculadoEn: row.calculadoEn,
    cerradoPor: row.cerradoPor,
    cerradoEn: row.cerradoEn,
    retencionHasta: row.retencionHasta ? fromDate(row.retencionHasta) : null,
  };
}

function mapDetalle(row: DetalleRow): PlanillaDetalleRegistro {
  return {
    id: row.id,
    planillaId: row.planillaId,
    periodo: row.planilla.periodo,
    estado: row.planilla.estado,
    empleadoId: row.empleadoId,
    nombreCompleto: row.nombreCompleto,
    ciEnmascarado: row.ciEnmascarado,
    areaId: row.areaId,
    cargoId: row.cargoId,
    fechaIngreso: fromDate(row.fechaIngreso),
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
    subsidios: asStringRecord(row.subsidios),
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

  async obtenerParametrosVigentes(fechaCorte: string): Promise<ParametrosVigentesRaw> {
    const fecha = toDate(fechaCorte);
    const [filas, escala] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ clave: string; valor: string; vigente_desde: string }>
      >`SELECT DISTINCT ON (clave) clave, valor::text AS valor, vigente_desde::text AS vigente_desde
        FROM parametro_legal
        WHERE vigente_desde <= ${fecha}::date
        ORDER BY clave, vigente_desde DESC`,
      this.prisma.$queryRaw<
        Array<{
          anios_desde: number;
          anios_hasta: number | null;
          porcentaje: string;
          vigente_desde: string;
        }>
      >`SELECT anios_desde, anios_hasta, porcentaje::text AS porcentaje, vigente_desde::text AS vigente_desde
        FROM escala_antiguedad
        WHERE vigente_desde = (
          SELECT MAX(vigente_desde) FROM escala_antiguedad WHERE vigente_desde <= ${fecha}::date
        )
        ORDER BY anios_desde`,
    ]);
    return {
      filas: filas.map((fila) => ({
        clave: fila.clave,
        valor: fila.valor,
        vigenteDesde: fila.vigente_desde,
      })),
      escala: escala.map((tramo) => ({
        aniosDesde: tramo.anios_desde,
        aniosHasta: tramo.anios_hasta,
        porcentaje: tramo.porcentaje,
        vigenteDesde: tramo.vigente_desde,
      })),
    };
  }

  async obtenerRetencionAnios(): Promise<number> {
    const fila = await this.prisma.configuracionPlanillas.findUnique({
      where: { clave: 'RETENCION_ANIOS' },
    });
    const anios = fila ? Number.parseInt(fila.valor, 10) : 8;
    return Number.isInteger(anios) && anios >= 8 && anios <= 100 ? anios : 8;
  }

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
      return traducirErrorBd(error);
    }
  }

  async saldosRcIva(periodo: string): Promise<Map<string, bigint>> {
    const rows = await this.prisma.planillaDetalleNomina.findMany({
      where: { planilla: { periodo, estado: 'CERRADA' } },
      select: { empleadoId: true, rcIvaSaldoSiguiente: true },
    });
    return new Map(rows.map((row) => [row.empleadoId, toCents(row.rcIvaSaldoSiguiente)]));
  }

  async buscarPorPeriodo(periodo: string): Promise<PlanillaCabecera | null> {
    const row = await this.prisma.planilla.findUnique({ where: { periodo } });
    return row ? mapCabecera(row) : null;
  }

  async buscarPorId(id: string): Promise<PlanillaCabecera | null> {
    const row = await this.prisma.planilla.findUnique({ where: { id } });
    return row ? mapCabecera(row) : null;
  }

  async guardarBorrador(input: GuardarBorradorInput): Promise<PlanillaCabecera> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.bloquearPeriodo(tx, input.periodo);
        const existente = await tx.planilla.findUnique({ where: { periodo: input.periodo } });
        if (existente?.estado === 'CERRADA') throw new PlanillaCerradaError(input.periodo);

        const cabecera = {
          parametros: input.parametros as unknown as Prisma.InputJsonValue,
          totalEmpleados: input.totales.totalEmpleados,
          totalGanado: formatCents(input.totales.totalGanado),
          totalAportesLaborales: formatCents(input.totales.totalAportesLaborales),
          totalAns: formatCents(input.totales.totalAns),
          totalRcIva: formatCents(input.totales.totalRcIva),
          totalOtrosDescuentos: formatCents(input.totales.totalOtrosDescuentos),
          totalLiquido: formatCents(input.totales.totalLiquido),
          totalAportesPatronales: formatCents(input.totales.totalAportesPatronales),
          duracionMs: input.duracionMs,
          calculadoPor: input.actorUserId,
          calculadoEn: input.calculadoEn,
        };

        let planillaId: string;
        if (existente) {
          await tx.planillaDetalleNomina.deleteMany({ where: { planillaId: existente.id } });
          await tx.planilla.update({
            where: { id: existente.id },
            data: { ...cabecera, version: { increment: 1 } },
          });
          planillaId = existente.id;
        } else {
          const creada = await tx.planilla.create({
            data: { periodo: input.periodo, anio: input.anio, mes: input.mes, ...cabecera },
          });
          planillaId = creada.id;
        }

        await tx.planillaDetalleNomina.createMany({
          data: input.detalles.map((detalle) => ({
            planillaId,
            empleadoId: detalle.empleadoId,
            nombreCompleto: detalle.nombreCompleto,
            ciEnmascarado: detalle.ciEnmascarado,
            areaId: detalle.areaId,
            cargoId: detalle.cargoId,
            fechaIngreso: toDate(detalle.fechaIngreso),
            haberBasico: formatCents(detalle.haberBasico),
            diasTrabajados: detalle.diasTrabajados,
            haberGanado: formatCents(detalle.haberGanado),
            aniosAntiguedad: detalle.aniosAntiguedad,
            porcentajeBono: formatPorcentaje(detalle.porcentajeBono),
            bonoAntiguedad: formatCents(detalle.bonoAntiguedad),
            otrosIngresos: formatCents(detalle.otrosIngresos),
            totalGanado: formatCents(detalle.totalGanado),
            aporteLaboral: formatCents(detalle.aporteLaboral),
            ans: formatCents(detalle.ans),
            rcIvaBaseImponible: formatCents(detalle.rcIvaBaseImponible),
            rcIvaImpuesto: formatCents(detalle.rcIvaImpuesto),
            rcIvaComputable: formatCents(detalle.rcIvaComputable),
            rcIvaSaldoAnterior: formatCents(detalle.rcIvaSaldoAnterior),
            rcIvaSaldoSiguiente: formatCents(detalle.rcIvaSaldoSiguiente),
            rcIva: formatCents(detalle.rcIva),
            otrosDescuentos: formatCents(detalle.otrosDescuentos),
            totalDescuentos: formatCents(detalle.totalDescuentos),
            liquidoPagable: formatCents(detalle.liquidoPagable),
            aportePatronal: formatCents(detalle.aportePatronal),
            subsidios: detalle.subsidios,
          })),
        });

        return mapCabecera(await tx.planilla.findUniqueOrThrow({ where: { id: planillaId } }));
      }, TX_OPTIONS);
    } catch (error) {
      if (error instanceof PlanillaCerradaError) throw error;
      return traducirErrorBd(error);
    }
  }

  async cerrar(
    id: string,
    actorUserId: string,
    cerradoEn: Date,
    retencionHasta: string,
  ): Promise<PlanillaCabecera | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await tx.planilla.findUnique({ where: { id }, select: { periodo: true } });
        if (!actual) return null;
        await this.bloquearPeriodo(tx, actual.periodo);
        const { count } = await tx.planilla.updateMany({
          where: { id, estado: 'BORRADOR' },
          data: {
            estado: 'CERRADA',
            cerradoPor: actorUserId,
            cerradoEn,
            retencionHasta: toDate(retencionHasta),
          },
        });
        if (count === 0) return null;
        return mapCabecera(await tx.planilla.findUniqueOrThrow({ where: { id } }));
      }, TX_OPTIONS);
    } catch (error) {
      return traducirErrorBd(error);
    }
  }

  async eliminarBorrador(id: string): Promise<void> {
    try {
      const { count } = await this.prisma.planilla.deleteMany({
        where: { id, estado: 'BORRADOR' },
      });
      if (count === 0) throw new PlanillaInmutableError();
    } catch (error) {
      if (error instanceof PlanillaInmutableError) throw error;
      traducirErrorBd(error);
    }
  }

  async listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>> {
    const where: Prisma.PlanillaWhereInput = {
      ...(filtro.anio ? { anio: filtro.anio } : {}),
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.desde || filtro.hasta
        ? {
            periodo: {
              ...(filtro.desde ? { gte: filtro.desde } : {}),
              ...(filtro.hasta ? { lte: filtro.hasta } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planilla.findMany({
        where,
        orderBy: { periodo: 'desc' },
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.planilla.count({ where }),
    ]);
    return paginar(rows.map(mapCabecera), total, filtro.page, filtro.pageSize);
  }

  async listarDetalle(
    planillaId: string,
    filtro: FiltroDetalle,
  ): Promise<Pagina<PlanillaDetalleRegistro>> {
    const where: Prisma.PlanillaDetalleNominaWhereInput = {
      planillaId,
      ...(filtro.areaId ? { areaId: filtro.areaId } : {}),
      ...(filtro.empleadoId ? { empleadoId: filtro.empleadoId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planillaDetalleNomina.findMany({
        where,
        include: INCLUDE_PLANILLA,
        orderBy: [{ nombreCompleto: 'asc' }, { empleadoId: 'asc' }],
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
      this.prisma.planillaDetalleNomina.count({ where }),
    ]);
    return paginar(rows.map(mapDetalle), total, filtro.page, filtro.pageSize);
  }

  async obtenerDetalle(
    planillaId: string,
    empleadoId: string,
  ): Promise<PlanillaDetalleRegistro | null> {
    const row = await this.prisma.planillaDetalleNomina.findUnique({
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
    const where: Prisma.PlanillaDetalleNominaWhereInput = {
      empleadoId,
      planilla: { estado: 'CERRADA' },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planillaDetalleNomina.findMany({
        where,
        include: INCLUDE_PLANILLA,
        orderBy: { planilla: { periodo: 'desc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.planillaDetalleNomina.count({ where }),
    ]);
    return paginar(rows.map(mapDetalle), total, page, pageSize);
  }

  async obtenerPagoEmpleado(
    empleadoId: string,
    periodo: string,
  ): Promise<PlanillaDetalleRegistro | null> {
    const row = await this.prisma.planillaDetalleNomina.findFirst({
      where: { empleadoId, planilla: { periodo, estado: 'CERRADA' } },
      include: INCLUDE_PLANILLA,
    });
    return row ? mapDetalle(row) : null;
  }

  async resumenCostos(desde: string, hasta: string): Promise<ResumenPeriodo[]> {
    const rows = await this.prisma.planilla.findMany({
      where: { estado: 'CERRADA', periodo: { gte: desde, lte: hasta } },
      orderBy: { periodo: 'asc' },
    });
    return rows.map((row) => ({
      periodo: row.periodo,
      totalEmpleados: row.totalEmpleados,
      totalGanado: money(row.totalGanado),
      totalAportesPatronales: money(row.totalAportesPatronales),
      costoTotal: formatCents(toCents(row.totalGanado) + toCents(row.totalAportesPatronales)),
      totalLiquido: money(row.totalLiquido),
    }));
  }

  /** Serializa cálculo y cierre del mismo periodo (evita duplicados y doble cierre). */
  private async bloquearPeriodo(tx: Prisma.TransactionClient, periodo: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`planilla:${periodo}`}))`;
  }
}
