import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { formatCents, toCents } from '../../domain/common/money';
import {
  calcularPlanilla,
  LiquidoNegativoError,
  NovedadInconsistenteError,
} from '../../domain/nomina/calculo';
import {
  construirParametros,
  type ParametrosNomina,
  ParametrosIncompletosError,
  ParametrosInvalidosError,
  serializarParametros,
} from '../../domain/nomina/parametros';
import {
  compararFechas,
  parseFecha,
  parsePeriodo,
  type Periodo,
  periodoAnterior,
  sumarAnios,
} from '../../domain/nomina/periodo';
import {
  type Actor,
  CLOCK,
  type Clock,
  EMPLEADOS_NOMINA_PORT,
  type EmpleadosNominaPort,
  type ErrorProceso,
  EstadoInvalidoError,
  type EstadoPlanilla,
  PeriodoFuturoError,
  PersonalNoDisponibleError,
  PLANILLA_REPOSITORY,
  type PlanillaCabecera,
  type PlanillaDetalleRegistro,
  PlanillaNoEncontradaError,
  type PlanillaRepository,
  PlanillaSinEmpleadosError,
} from '../../domain/planillas/planilla.models';
import { SUBSIDIOS_PERMITIDOS, type RegistrarNovedadDto } from './planillas.dto';

/** Una planilla EN_PROCESO más antigua que esto se considera atascada (reinicio del servicio). */
export const PROCESO_ATASCADO_MS = 5 * 60_000;
/** Periodos cerrados incluidos en `tendenciaCostos` de los KPIs. */
export const KPIS_TENDENCIA_PERIODOS = 12;

export interface ResultadoProceso {
  planillaId: string;
  estado: 'CALCULADA' | 'ERROR';
  error?: ErrorProceso;
  observaciones: string[];
}

/** Respuesta 202 del contrato (ProcesamientoAceptado) + promesa del cálculo en segundo plano. */
export interface ProcesoIniciado {
  aceptado: {
    id: string;
    periodo: string;
    estado: 'EN_PROCESO';
    totalEmpleados: number;
    iniciadoEn: string;
  };
  /** Nunca se rechaza: los fallos dejan la planilla en ERROR con su motivo. */
  completado: Promise<ResultadoProceso>;
}

function hoy(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

/** Esquema `Planilla` del contrato + extensiones del motor de cálculo. */
export function presentarCabecera(planilla: PlanillaCabecera) {
  return {
    id: planilla.id,
    periodo: planilla.periodo,
    estado: planilla.estado,
    totalEmpleados: planilla.totalEmpleados,
    totalGanado: planilla.totalGanado,
    totalAportesLab: planilla.totalAportesLaborales,
    totalAportesPat: planilla.totalAportesPatronales,
    totalLiquido: planilla.totalLiquido,
    cerradaEn: planilla.cerradoEn ? planilla.cerradoEn.toISOString() : null,
    // Extensiones (TSK-DEV2-202..204)
    totalAns: planilla.totalAns,
    totalRcIva: planilla.totalRcIva,
    totalOtrosDescuentos: planilla.totalOtrosDescuentos,
    version: planilla.version,
    observacion: planilla.observacion,
    error: planilla.errorProceso,
    procesadaPor: planilla.calculadoPor,
    procesadaEn: planilla.calculadoEn ? planilla.calculadoEn.toISOString() : null,
    duracionMs: planilla.duracionMs,
    cerradaPor: planilla.cerradoPor,
    retencionHasta: planilla.retencionHasta,
    inmutable: planilla.estado === 'CERRADA',
    parametrosAplicados: planilla.parametros,
  };
}

/** Esquema `Detalle` del contrato + desglose completo (fuente de la boleta, HU-22). */
export function presentarDetalle(detalle: PlanillaDetalleRegistro) {
  return {
    id: detalle.id,
    planillaId: detalle.planillaId,
    periodo: detalle.periodo,
    estadoPlanilla: detalle.estado,
    empleadoId: detalle.empleadoId,
    totalGanado: detalle.totalGanado,
    bonoAntiguedad: detalle.bonoAntiguedad,
    aporteLaboral: detalle.aporteLaboral,
    aportePatronal: detalle.aportePatronal,
    ans: detalle.ans,
    rcIvaComputable: detalle.rcIvaComputable,
    liquidoPagable: detalle.liquidoPagable,
    subsidiosInformativos: Object.entries(detalle.subsidios).map(([tipo, monto]) => ({
      tipo,
      monto,
    })),
    // Extensiones: identificación (snapshot) y desglose completo
    nombreCompleto: detalle.nombreCompleto,
    ciEnmascarado: detalle.ciEnmascarado,
    areaId: detalle.areaId,
    cargoId: detalle.cargoId,
    fechaIngreso: detalle.fechaIngreso,
    aniosAntiguedad: detalle.aniosAntiguedad,
    diasTrabajados: detalle.diasTrabajados,
    haberBasico: detalle.haberBasico,
    haberGanado: detalle.haberGanado,
    porcentajeBonoAntiguedad: detalle.porcentajeBono,
    otrosIngresos: detalle.otrosIngresos,
    rcIva: detalle.rcIva,
    otrosDescuentos: detalle.otrosDescuentos,
    totalDescuentos: detalle.totalDescuentos,
    rcIvaDetalle: {
      baseImponible: detalle.rcIvaBaseImponible,
      impuesto: detalle.rcIvaImpuesto,
      computable: detalle.rcIvaComputable,
      saldoAnterior: detalle.rcIvaSaldoAnterior,
      saldoSiguiente: detalle.rcIvaSaldoSiguiente,
    },
  };
}

/** Motivo de ERROR sin filtrar detalles internos (stack, SQL, etc.). */
export function describirError(error: unknown): ErrorProceso {
  if (error instanceof PlanillaSinEmpleadosError) {
    return {
      code: 'PLANILLA_SIN_EMPLEADOS',
      message: 'No hay funcionarios activos para el periodo.',
    };
  }
  if (error instanceof PersonalNoDisponibleError) {
    return {
      code: 'PLANILLA_PERSONAL_NO_DISPONIBLE',
      message: 'No se pudo obtener la nómina desde el servicio de personal.',
    };
  }
  if (error instanceof LiquidoNegativoError) {
    return {
      code: 'PLANILLA_LIQUIDO_NEGATIVO',
      message: 'Los descuentos de un funcionario superan su total ganado.',
      empleadoId: error.empleadoId,
    };
  }
  if (error instanceof NovedadInconsistenteError) {
    return {
      code: 'PLANILLA_NOVEDAD_INCONSISTENTE',
      message: 'Una novedad no es coherente con los datos del funcionario.',
      empleadoId: error.empleadoId,
    };
  }
  if (error instanceof ParametrosIncompletosError || error instanceof ParametrosInvalidosError) {
    return {
      code: 'PLANILLA_PARAMETROS_VIGENTES_FALTANTES',
      message: 'No están configurados todos los parámetros requeridos.',
    };
  }
  return { code: 'PLANILLA_CALCULO_ERROR', message: 'No se pudo calcular la planilla.' };
}

@Injectable()
export class PlanillasService implements OnModuleDestroy {
  private readonly logger = new Logger(PlanillasService.name);
  private readonly enCurso = new Set<Promise<ResultadoProceso>>();

  constructor(
    @Inject(PLANILLA_REPOSITORY) private readonly repository: PlanillaRepository,
    @Inject(EMPLEADOS_NOMINA_PORT) private readonly personal: EmpleadosNominaPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Espera los cálculos en curso antes de apagar (evita planillas EN_PROCESO huérfanas). */
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.enCurso]);
  }

  // ------------------------------------------------------- procesamiento (HU-21)

  /** POST /planillas: crea la planilla EN_PROCESO y calcula en segundo plano. */
  async procesar(
    dto: { periodo: string; observacion?: string },
    actor: Actor,
  ): Promise<ProcesoIniciado> {
    const periodo = this.periodoProcesable(dto.periodo);
    // Los parámetros se validan antes de aceptar: un 422 inmediato es más útil que un ERROR.
    await this.parametrosDe(periodo);
    const cabecera = await this.repository.iniciarProceso(
      periodo.codigo,
      actor.userId,
      this.clock.now(),
      dto.observacion?.trim() || null,
    );
    return this.lanzar(cabecera, periodo, actor);
  }

  /** POST /planillas/:id/recalcular (extensión): tras editar novedades o parámetros. */
  async recalcular(id: string, actor: Actor): Promise<ProcesoIniciado> {
    const actual = await this.obtenerCabecera(id);
    const periodo = parsePeriodo(actual.periodo);
    if (actual.estado === 'CERRADA') {
      throw new EstadoInvalidoError(actual.periodo, actual.estado, 'recalcular');
    }
    await this.parametrosDe(periodo);
    const ahora = this.clock.now();
    const cabecera = await this.repository.reiniciarProceso(
      id,
      actor.userId,
      ahora,
      new Date(ahora.getTime() - PROCESO_ATASCADO_MS),
    );
    return this.lanzar(cabecera, periodo, actor);
  }

  private lanzar(cabecera: PlanillaCabecera, periodo: Periodo, actor: Actor): ProcesoIniciado {
    const completado = this.ejecutar(cabecera.id, periodo, actor);
    this.enCurso.add(completado);
    void completado.finally(() => this.enCurso.delete(completado));
    return {
      aceptado: {
        id: cabecera.id,
        periodo: cabecera.periodo,
        estado: 'EN_PROCESO',
        totalEmpleados: cabecera.totalEmpleados,
        iniciadoEn: (cabecera.calculadoEn ?? this.clock.now()).toISOString(),
      },
      completado,
    };
  }

  private async ejecutar(
    planillaId: string,
    periodo: Periodo,
    actor: Actor,
  ): Promise<ResultadoProceso> {
    const inicio = process.hrtime.bigint();
    try {
      const parametros = await this.parametrosDe(periodo);
      const [empleados, novedades, saldosRcIva] = await Promise.all([
        this.personal.listarActivos(actor),
        this.repository.novedadesComoMapa(periodo.codigo),
        this.repository.saldosRcIva(periodoAnterior(periodo)),
      ]);
      const resultado = calcularPlanilla({
        periodo,
        parametros,
        empleados,
        novedades,
        saldosRcIva,
      });
      if (resultado.detalles.length === 0) throw new PlanillaSinEmpleadosError(periodo.codigo);

      const duracionMs = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6);
      const cabecera = await this.repository.guardarResultado({
        planillaId,
        parametros: serializarParametros(parametros),
        detalles: resultado.detalles,
        totales: resultado.totales,
        duracionMs,
      });
      this.logger.log(
        `Planilla ${periodo.codigo} v${cabecera.version}: ${resultado.detalles.length} funcionarios en ${duracionMs} ms`,
      );
      return { planillaId, estado: 'CALCULADA', observaciones: resultado.observaciones };
    } catch (error) {
      const motivo = describirError(error);
      this.logger.warn(
        `Planilla ${periodo.codigo} terminó en ERROR (${motivo.code}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.repository
        .marcarError(planillaId, motivo)
        .catch((e: unknown) =>
          this.logger.error(`No se pudo marcar ERROR en ${periodo.codigo}: ${String(e)}`),
        );
      return { planillaId, estado: 'ERROR', error: motivo, observaciones: [] };
    }
  }

  async cerrar(id: string, actor: Actor) {
    const planilla = await this.obtenerCabecera(id);
    if (planilla.estado !== 'CALCULADA') {
      throw new EstadoInvalidoError(planilla.periodo, planilla.estado, 'cerrar');
    }
    const anios = await this.repository.obtenerRetencionAnios();
    const cerradoEn = this.clock.now();
    const retencionHasta = sumarAnios(cerradoEn.toISOString().slice(0, 10), anios);
    const cerrada = await this.repository.cerrar(id, actor.userId, cerradoEn, retencionHasta);
    if (!cerrada) throw new EstadoInvalidoError(planilla.periodo, 'CERRADA', 'cerrar');
    return presentarCabecera(cerrada);
  }

  /** DELETE /planillas/:id (extensión): descarta una planilla no cerrada ni en proceso. */
  async eliminar(id: string): Promise<void> {
    const planilla = await this.obtenerCabecera(id);
    if (planilla.estado === 'CERRADA' || this.enProcesoVigente(planilla)) {
      throw new EstadoInvalidoError(planilla.periodo, planilla.estado, 'eliminar');
    }
    await this.repository.eliminar(id);
  }

  // ---------------------------------------------------------------- novedades

  async registrarNovedad(
    codigoPeriodo: string,
    empleadoId: string,
    dto: RegistrarNovedadDto,
    actor: Actor,
  ) {
    const periodo = parsePeriodo(codigoPeriodo);
    const planilla = await this.repository.buscarPorPeriodo(periodo.codigo);
    if (planilla?.estado === 'CERRADA') {
      throw new EstadoInvalidoError(periodo.codigo, planilla.estado, 'novedad');
    }

    const subsidios: Record<string, string> = {};
    for (const clave of SUBSIDIOS_PERMITIDOS) {
      const valor = dto.subsidios?.[clave];
      if (valor !== undefined) subsidios[clave] = formatCents(toCents(valor, `subsidios.${clave}`));
    }

    const registro = await this.repository.guardarNovedad({
      periodo: periodo.codigo,
      empleadoId,
      diasTrabajados: dto.diasTrabajados ?? null,
      otrosIngresos: toCents(dto.otrosIngresos ?? '0', 'otrosIngresos'),
      otrosDescuentos: toCents(dto.otrosDescuentos ?? '0', 'otrosDescuentos'),
      rcIvaComputable: toCents(dto.rcIvaComputable ?? '0', 'rcIvaComputable'),
      subsidios,
      observacion: dto.observacion ?? null,
      actorUserId: actor.userId,
    });
    return {
      ...registro,
      actualizadoEn: registro.actualizadoEn.toISOString(),
      requiereRecalculo: planilla !== null,
    };
  }

  async listarNovedades(codigoPeriodo: string) {
    const periodo = parsePeriodo(codigoPeriodo);
    const data = await this.repository.listarNovedades(periodo.codigo);
    return {
      data: data.map((novedad) => ({
        ...novedad,
        actualizadoEn: novedad.actualizadoEn.toISOString(),
      })),
    };
  }

  // ---------------------------------------------------------------- consultas

  /** GET /planillas: `desde`/`hasta` son fechas; se comparan por su periodo (YYYY-MM). */
  async listar(filtro: {
    periodo?: string;
    estado?: EstadoPlanilla;
    desde?: string;
    hasta?: string;
    page: number;
    pageSize: number;
  }) {
    if (filtro.periodo) parsePeriodo(filtro.periodo);
    if (filtro.desde) parseFecha(filtro.desde);
    if (filtro.hasta) parseFecha(filtro.hasta);
    const pagina = await this.repository.listar({
      periodo: filtro.periodo,
      estado: filtro.estado,
      desde: filtro.desde?.slice(0, 7),
      hasta: filtro.hasta?.slice(0, 7),
      page: filtro.page,
      pageSize: filtro.pageSize,
    });
    return { data: pagina.data.map(presentarCabecera), meta: pagina.meta };
  }

  /** GET /planillas/historial (HU-24): solo planillas cerradas e inmutables. */
  async historial(filtro: {
    periodo?: string;
    empleadoId?: string;
    gestion?: number;
    page: number;
    pageSize: number;
  }) {
    if (filtro.periodo) parsePeriodo(filtro.periodo);
    const pagina = await this.repository.listar({
      periodo: filtro.periodo,
      anio: filtro.gestion,
      empleadoId: filtro.empleadoId,
      estado: 'CERRADA',
      page: filtro.page,
      pageSize: filtro.pageSize,
    });
    return { data: pagina.data.map(presentarCabecera), meta: pagina.meta };
  }

  async obtener(id: string) {
    return presentarCabecera(await this.obtenerCabecera(id));
  }

  async listarDetalle(
    id: string,
    filtro: { areaId?: string; empleadoId?: string; page: number; pageSize: number },
  ) {
    await this.obtenerCabecera(id);
    const pagina = await this.repository.listarDetalle(id, filtro);
    return { data: pagina.data.map(presentarDetalle), meta: pagina.meta };
  }

  async obtenerDetalleEmpleado(id: string, empleadoId: string) {
    const detalle = await this.repository.obtenerDetalle(id, empleadoId);
    if (!detalle) throw new PlanillaNoEncontradaError();
    return presentarDetalle(detalle);
  }

  /** Autoconsulta (HU-23): solo pagos propios y de planillas cerradas. */
  async misPagos(actor: Actor, page: number, pageSize: number) {
    if (!actor.empleadoId) {
      return { data: [], meta: { page, pageSize, total: 0, totalPages: 0 } };
    }
    const pagina = await this.repository.listarPagosEmpleado(actor.empleadoId, page, pageSize);
    return { data: pagina.data.map(presentarDetalle), meta: pagina.meta };
  }

  async miPago(actor: Actor, codigoPeriodo: string) {
    const periodo = parsePeriodo(codigoPeriodo);
    if (!actor.empleadoId) throw new PlanillaNoEncontradaError();
    const detalle = await this.repository.obtenerPagoEmpleado(actor.empleadoId, periodo.codigo);
    if (!detalle) throw new PlanillaNoEncontradaError();
    return presentarDetalle(detalle);
  }

  /**
   * GET /planillas/kpis (HU-25): costos y boletas de planillas CERRADAS.
   * `dashboard:read` ve la empresa (o el área pedida); `dashboard:read_area` solo su
   * propia área, resuelta desde el snapshot de su último detalle (área ajena: 404).
   */
  async kpis(filtro: { periodo?: string; areaId?: string }, actor: Actor) {
    if (filtro.periodo) parsePeriodo(filtro.periodo);
    let areaId: string | null = filtro.areaId ?? null;
    if (!actor.permisos.includes('dashboard:read')) {
      const propia = actor.empleadoId
        ? await this.repository.areaDelEmpleado(actor.empleadoId, filtro.periodo ?? '9999-12')
        : null;
      if (!propia || (filtro.areaId && filtro.areaId !== propia)) {
        throw new PlanillaNoEncontradaError();
      }
      areaId = propia;
    }

    const filas = await this.repository.kpisCerradas(
      filtro.periodo ?? null,
      areaId,
      KPIS_TENDENCIA_PERIODOS,
    );
    if (filtro.periodo && filas[0]?.periodo !== filtro.periodo) {
      throw new PlanillaNoEncontradaError();
    }
    const actual = filas[0];
    return {
      periodo: actual?.periodo ?? null,
      costoPlanilla: actual?.costoPlanilla ?? '0.00',
      boletasEmitidas: actual?.boletasEmitidas ?? 0,
      tendenciaCostos: [...filas]
        .reverse()
        .map((fila) => ({ periodo: fila.periodo, total: fila.costoPlanilla })),
      areaId,
    };
  }

  async parametrosVigentes(fecha?: string) {
    const fechaCorte = fecha ?? hoy(this.clock);
    parseFecha(fechaCorte);
    const registros = await this.repository.obtenerParametrosVigentes(fechaCorte);
    return serializarParametros(construirParametros(fechaCorte, registros));
  }

  async politicaRetencion() {
    const anios = await this.repository.obtenerRetencionAnios();
    return {
      retencionAnios: anios,
      minimoLegalAnios: 8,
      reglas: [
        'Las planillas CERRADAS no admiten UPDATE ni DELETE (servicio y triggers de BD).',
        'retencionHasta = fecha de cierre + retencionAnios.',
        'La purga solo procede vencida la retención y con autorización explícita de BD.',
      ],
    };
  }

  // ------------------------------------------------------------------ helpers

  private periodoProcesable(codigo: string): Periodo {
    const periodo = parsePeriodo(codigo);
    if (compararFechas(periodo.fechaInicio, hoy(this.clock)) > 0) {
      throw new PeriodoFuturoError(periodo.codigo);
    }
    return periodo;
  }

  private async parametrosDe(periodo: Periodo): Promise<ParametrosNomina> {
    const registros = await this.repository.obtenerParametrosVigentes(periodo.fechaFin);
    return construirParametros(periodo.fechaFin, registros);
  }

  private enProcesoVigente(planilla: PlanillaCabecera): boolean {
    if (planilla.estado !== 'EN_PROCESO') return false;
    const inicio = planilla.calculadoEn?.getTime() ?? 0;
    return this.clock.now().getTime() - inicio < PROCESO_ATASCADO_MS;
  }

  private async obtenerCabecera(id: string): Promise<PlanillaCabecera> {
    const planilla = await this.repository.buscarPorId(id);
    if (!planilla) throw new PlanillaNoEncontradaError();
    return planilla;
  }
}
