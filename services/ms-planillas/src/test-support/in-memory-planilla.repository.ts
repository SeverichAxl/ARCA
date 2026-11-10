import { formatCents, formatPorcentaje, toCents } from '../domain/common/money';
import type { NovedadNomina } from '../domain/nomina/calculo';
import { filasIniciales } from '../domain/nomina/parametros-iniciales';
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
  PlanillaNoEncontradaError,
  type PlanillaRepository,
} from '../domain/planillas/planilla.models';

/** Solo para pruebas. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
}

/** Repositorio en memoria que respeta las mismas reglas que la BD. */
export class InMemoryRepo implements PlanillaRepository {
  planillas = new Map<string, PlanillaCabecera>();
  detalles = new Map<string, PlanillaDetalleRegistro[]>();
  novedades = new Map<string, NovedadRegistro>();
  private seq = 0;

  async obtenerParametrosVigentes() {
    return filasIniciales();
  }
  async obtenerRetencionAnios() {
    return 8;
  }
  async listarNovedades(periodo: string) {
    return [...this.novedades.values()].filter((n) => n.periodo === periodo);
  }
  async novedadesComoMapa(periodo: string) {
    const mapa = new Map<string, NovedadNomina>();
    for (const n of await this.listarNovedades(periodo)) {
      mapa.set(n.empleadoId, {
        diasTrabajados: n.diasTrabajados,
        otrosIngresos: toCents(n.otrosIngresos),
        otrosDescuentos: toCents(n.otrosDescuentos),
        rcIvaComputable: toCents(n.rcIvaComputable),
        subsidios: n.subsidios,
      });
    }
    return mapa;
  }
  async guardarNovedad(input: GuardarNovedadInput) {
    if (
      [...this.planillas.values()].some(
        (p) => p.periodo === input.periodo && p.estado === 'CERRADA',
      )
    ) {
      throw new EstadoInvalidoError(input.periodo, 'CERRADA', 'novedad');
    }
    const registro: NovedadRegistro = {
      periodo: input.periodo,
      empleadoId: input.empleadoId,
      diasTrabajados: input.diasTrabajados,
      otrosIngresos: formatCents(input.otrosIngresos),
      otrosDescuentos: formatCents(input.otrosDescuentos),
      rcIvaComputable: formatCents(input.rcIvaComputable),
      subsidios: input.subsidios,
      observacion: input.observacion,
      actualizadoPor: input.actorUserId,
      actualizadoEn: new Date(),
    };
    this.novedades.set(`${input.periodo}|${input.empleadoId}`, registro);
    return registro;
  }
  async saldosRcIva(periodo: string) {
    const planilla = await this.buscarPorPeriodo(periodo);
    const mapa = new Map<string, bigint>();
    if (planilla?.estado !== 'CERRADA') return mapa;
    for (const d of this.detalles.get(planilla.id) ?? [])
      mapa.set(d.empleadoId, toCents(d.rcIvaSaldoSiguiente));
    return mapa;
  }
  async buscarPorPeriodo(periodo: string) {
    return [...this.planillas.values()].find((p) => p.periodo === periodo) ?? null;
  }
  async buscarPorId(id: string) {
    return this.planillas.get(id) ?? null;
  }
  /** Boletas emitidas por planilla (las crea el módulo de boletas; aquí solo para KPIs). */
  boletas = new Map<string, { empleadoId: string; estado: 'EMITIDA' | 'ANULADA' }[]>();

  async iniciarProceso(
    periodo: string,
    actorUserId: string,
    iniciadoEn: Date,
    observacion: string | null,
  ) {
    if (await this.buscarPorPeriodo(periodo)) throw new PeriodoDuplicadoError(periodo);
    const [anio, mes] = periodo.split('-').map(Number);
    const cabecera: PlanillaCabecera = {
      id: uuid(5000 + ++this.seq),
      periodo,
      anio,
      mes,
      estado: 'EN_PROCESO',
      version: 0,
      parametros: null,
      totalEmpleados: 0,
      totalGanado: '0.00',
      totalAportesLaborales: '0.00',
      totalAns: '0.00',
      totalRcIva: '0.00',
      totalOtrosDescuentos: '0.00',
      totalLiquido: '0.00',
      totalAportesPatronales: '0.00',
      duracionMs: 0,
      calculadoPor: actorUserId,
      calculadoEn: iniciadoEn,
      cerradoPor: null,
      cerradoEn: null,
      retencionHasta: null,
      observacion,
      errorProceso: null,
    };
    this.planillas.set(cabecera.id, cabecera);
    this.detalles.set(cabecera.id, []);
    return cabecera;
  }

  async reiniciarProceso(id: string, actorUserId: string, iniciadoEn: Date, atascadaAntesDe: Date) {
    const p = this.planillas.get(id);
    if (!p) throw new PlanillaNoEncontradaError();
    const atascada =
      p.estado === 'EN_PROCESO' && (p.calculadoEn === null || p.calculadoEn < atascadaAntesDe);
    if (p.estado === 'CERRADA' || (p.estado === 'EN_PROCESO' && !atascada)) {
      throw new EstadoInvalidoError(p.periodo, p.estado, 'recalcular');
    }
    const reiniciada: PlanillaCabecera = {
      ...p,
      estado: 'EN_PROCESO',
      calculadoPor: actorUserId,
      calculadoEn: iniciadoEn,
      errorProceso: null,
    };
    this.planillas.set(id, reiniciada);
    return reiniciada;
  }

  async guardarResultado(input: GuardarResultadoInput) {
    const p = this.planillas.get(input.planillaId);
    if (!p) throw new PlanillaNoEncontradaError();
    if (p.estado !== 'EN_PROCESO') throw new EstadoInvalidoError(p.periodo, p.estado, 'guardar');
    const t = input.totales;
    const cabecera: PlanillaCabecera = {
      ...p,
      estado: 'CALCULADA',
      version: p.version + 1,
      parametros: input.parametros,
      totalEmpleados: t.totalEmpleados,
      totalGanado: formatCents(t.totalGanado),
      totalAportesLaborales: formatCents(t.totalAportesLaborales),
      totalAns: formatCents(t.totalAns),
      totalRcIva: formatCents(t.totalRcIva),
      totalOtrosDescuentos: formatCents(t.totalOtrosDescuentos),
      totalLiquido: formatCents(t.totalLiquido),
      totalAportesPatronales: formatCents(t.totalAportesPatronales),
      duracionMs: input.duracionMs,
      errorProceso: null,
    };
    this.planillas.set(p.id, cabecera);
    this.detalles.set(
      p.id,
      input.detalles.map((d, i) => ({
        id: uuid(7000 + i),
        planillaId: p.id,
        periodo: p.periodo,
        estado: 'CALCULADA',
        empleadoId: d.empleadoId,
        nombreCompleto: d.nombreCompleto,
        ciEnmascarado: d.ciEnmascarado,
        areaId: d.areaId,
        cargoId: d.cargoId,
        fechaIngreso: d.fechaIngreso,
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
        rcIvaSaldoAnterior: formatCents(d.rcIvaSaldoAnterior),
        rcIvaSaldoSiguiente: formatCents(d.rcIvaSaldoSiguiente),
        rcIva: formatCents(d.rcIva),
        otrosDescuentos: formatCents(d.otrosDescuentos),
        totalDescuentos: formatCents(d.totalDescuentos),
        liquidoPagable: formatCents(d.liquidoPagable),
        aportePatronal: formatCents(d.aportePatronal),
        subsidios: d.subsidios,
      })),
    );
    return cabecera;
  }

  async marcarError(id: string, error: ErrorProceso) {
    const p = this.planillas.get(id);
    if (p?.estado === 'EN_PROCESO') {
      this.planillas.set(id, { ...p, estado: 'ERROR', errorProceso: error });
    }
  }

  async cerrar(id: string, actorUserId: string, cerradoEn: Date, retencionHasta: string) {
    const p = this.planillas.get(id);
    if (!p || p.estado !== 'CALCULADA') return null;
    const cerrada = {
      ...p,
      estado: 'CERRADA' as const,
      cerradoPor: actorUserId,
      cerradoEn,
      retencionHasta,
    };
    this.planillas.set(id, cerrada);
    this.detalles.set(
      id,
      (this.detalles.get(id) ?? []).map((d) => ({ ...d, estado: 'CERRADA' as const })),
    );
    return cerrada;
  }

  async eliminar(id: string) {
    const p = this.planillas.get(id);
    if (!p) throw new PlanillaNoEncontradaError();
    if (p.estado === 'CERRADA') throw new EstadoInvalidoError(p.periodo, p.estado, 'eliminar');
    this.planillas.delete(id);
    this.detalles.delete(id);
  }

  async listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>> {
    const data = [...this.planillas.values()]
      .filter((p) => !filtro.estado || p.estado === filtro.estado)
      .filter((p) => !filtro.periodo || p.periodo === filtro.periodo)
      .filter((p) => !filtro.anio || p.anio === filtro.anio)
      .filter((p) => !filtro.desde || p.periodo >= filtro.desde)
      .filter((p) => !filtro.hasta || p.periodo <= filtro.hasta)
      .filter(
        (p) =>
          !filtro.empleadoId ||
          (this.detalles.get(p.id) ?? []).some((d) => d.empleadoId === filtro.empleadoId),
      )
      .sort((a, b) => b.periodo.localeCompare(a.periodo));
    const start = (filtro.page - 1) * filtro.pageSize;
    const pageData = data.slice(start, start + filtro.pageSize);
    return {
      data: pageData,
      meta: {
        page: filtro.page,
        pageSize: filtro.pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / filtro.pageSize),
      },
    };
  }

  async listarDetalle(id: string, filtro: FiltroDetalle): Promise<Pagina<PlanillaDetalleRegistro>> {
    const data = (this.detalles.get(id) ?? [])
      .filter((d) => !filtro.empleadoId || d.empleadoId === filtro.empleadoId)
      .filter((d) => !filtro.areaId || d.areaId === filtro.areaId);
    const start = (filtro.page - 1) * filtro.pageSize;
    return {
      data: data.slice(start, start + filtro.pageSize),
      meta: {
        page: filtro.page,
        pageSize: filtro.pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / filtro.pageSize),
      },
    };
  }

  async obtenerDetalle(id: string, empleadoId: string) {
    return (this.detalles.get(id) ?? []).find((d) => d.empleadoId === empleadoId) ?? null;
  }

  async listarPagosEmpleado(empleadoId: string, page: number, pageSize: number) {
    const data = [...this.detalles.values()]
      .flat()
      .filter((d) => d.empleadoId === empleadoId && d.estado === 'CERRADA');
    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      meta: { page, pageSize, total: data.length, totalPages: Math.ceil(data.length / pageSize) },
    };
  }

  async obtenerPagoEmpleado(empleadoId: string, periodo: string) {
    return (
      (await this.listarPagosEmpleado(empleadoId, 1, Number.MAX_SAFE_INTEGER)).data.find(
        (d) => d.periodo === periodo,
      ) ?? null
    );
  }

  async areaDelEmpleado(empleadoId: string, hastaPeriodo: string) {
    const fila = [...this.detalles.values()]
      .flat()
      .filter((d) => d.empleadoId === empleadoId && d.estado === 'CERRADA' && d.areaId)
      .filter((d) => d.periodo <= hastaPeriodo)
      .sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
    return fila?.areaId ?? null;
  }

  async kpisCerradas(
    hastaPeriodo: string | null,
    areaId: string | null,
    limite: number,
  ): Promise<KpisPeriodo[]> {
    return [...this.planillas.values()]
      .filter((p) => p.estado === 'CERRADA' && (!hastaPeriodo || p.periodo <= hastaPeriodo))
      .sort((a, b) => b.periodo.localeCompare(a.periodo))
      .slice(0, limite)
      .map((p) => {
        const detalles = (this.detalles.get(p.id) ?? []).filter(
          (d) => !areaId || d.areaId === areaId,
        );
        const costo = areaId
          ? detalles.reduce((t, d) => t + toCents(d.totalGanado) + toCents(d.aportePatronal), 0n)
          : toCents(p.totalGanado) + toCents(p.totalAportesPatronales);
        const empleados = new Set(detalles.map((d) => d.empleadoId));
        const boletas = (this.boletas.get(p.id) ?? []).filter(
          (b) => b.estado === 'EMITIDA' && (!areaId || empleados.has(b.empleadoId)),
        );
        return {
          periodo: p.periodo,
          costoPlanilla: formatCents(costo),
          boletasEmitidas: boletas.length,
        };
      });
  }
}
