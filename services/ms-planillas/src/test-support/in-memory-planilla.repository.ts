import { formatCents, formatPorcentaje, toCents } from '../domain/common/money';
import type { NovedadNomina } from '../domain/nomina/calculo';
import { filasIniciales } from '../domain/nomina/parametros-iniciales';
import {
  type FiltroDetalle,
  type FiltroPlanillas,
  type GuardarBorradorInput,
  type GuardarNovedadInput,
  type NovedadRegistro,
  type Pagina,
  type PlanillaCabecera,
  PlanillaCerradaError,
  type PlanillaDetalleRegistro,
  PlanillaInmutableError,
  type PlanillaRepository,
  type ResumenPeriodo,
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
      throw new PlanillaInmutableError();
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
  async guardarBorrador(input: GuardarBorradorInput) {
    const existente = await this.buscarPorPeriodo(input.periodo);
    if (existente?.estado === 'CERRADA') throw new PlanillaCerradaError(input.periodo);
    const id = existente?.id ?? uuid(5000 + ++this.seq);
    const t = input.totales;
    const cabecera: PlanillaCabecera = {
      id,
      periodo: input.periodo,
      anio: input.anio,
      mes: input.mes,
      estado: 'BORRADOR',
      version: (existente?.version ?? 0) + 1,
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
      calculadoPor: input.actorUserId,
      calculadoEn: input.calculadoEn,
      cerradoPor: null,
      cerradoEn: null,
      retencionHasta: null,
    };
    this.planillas.set(id, cabecera);
    this.detalles.set(
      id,
      input.detalles.map((d, i) => ({
        id: uuid(7000 + i),
        planillaId: id,
        periodo: input.periodo,
        estado: 'BORRADOR',
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
  async cerrar(id: string, actorUserId: string, cerradoEn: Date, retencionHasta: string) {
    const p = this.planillas.get(id);
    if (!p || p.estado !== 'BORRADOR') return null;
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
  async eliminarBorrador(id: string) {
    if (this.planillas.get(id)?.estado !== 'BORRADOR') throw new PlanillaInmutableError();
    this.planillas.delete(id);
    this.detalles.delete(id);
  }
  async listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>> {
    const data = [...this.planillas.values()].filter(
      (p) => !filtro.estado || p.estado === filtro.estado,
    );
    return {
      data,
      meta: { page: 1, pageSize: filtro.pageSize, total: data.length, totalPages: 1 },
    };
  }
  async listarDetalle(id: string, filtro: FiltroDetalle): Promise<Pagina<PlanillaDetalleRegistro>> {
    const data = (this.detalles.get(id) ?? []).filter(
      (d) => !filtro.empleadoId || d.empleadoId === filtro.empleadoId,
    );
    return {
      data,
      meta: { page: 1, pageSize: filtro.pageSize, total: data.length, totalPages: 1 },
    };
  }
  async obtenerDetalle(id: string, empleadoId: string) {
    return (this.detalles.get(id) ?? []).find((d) => d.empleadoId === empleadoId) ?? null;
  }
  async listarPagosEmpleado(empleadoId: string, page: number, pageSize: number) {
    const data = [...this.detalles.values()]
      .flat()
      .filter((d) => d.empleadoId === empleadoId && d.estado === 'CERRADA');
    return { data, meta: { page, pageSize, total: data.length, totalPages: 1 } };
  }
  async obtenerPagoEmpleado(empleadoId: string, periodo: string) {
    return (
      (await this.listarPagosEmpleado(empleadoId, 1, 100)).data.find(
        (d) => d.periodo === periodo,
      ) ?? null
    );
  }
  async resumenCostos(desde: string, hasta: string): Promise<ResumenPeriodo[]> {
    return [...this.planillas.values()]
      .filter((p) => p.estado === 'CERRADA' && p.periodo >= desde && p.periodo <= hasta)
      .map((p) => ({
        periodo: p.periodo,
        totalEmpleados: p.totalEmpleados,
        totalGanado: p.totalGanado,
        totalAportesPatronales: p.totalAportesPatronales,
        costoTotal: formatCents(toCents(p.totalGanado) + toCents(p.totalAportesPatronales)),
        totalLiquido: p.totalLiquido,
      }));
  }
}
