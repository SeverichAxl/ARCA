import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatCents, toCents } from '../../domain/common/money';
import { calcularPlanilla } from '../../domain/nomina/calculo';
import { construirParametros, serializarParametros } from '../../domain/nomina/parametros';
import {
  compararFechas,
  parseFecha,
  parsePeriodo,
  periodoAnterior,
  sumarAnios,
} from '../../domain/nomina/periodo';
import {
  type Actor,
  CLOCK,
  type Clock,
  EMPLEADOS_NOMINA_PORT,
  type EmpleadosNominaPort,
  type EstadoPlanilla,
  PeriodoFuturoError,
  PLANILLA_REPOSITORY,
  type PlanillaCabecera,
  PlanillaCerradaError,
  type PlanillaDetalleRegistro,
  PlanillaNoEncontradaError,
  type PlanillaRepository,
  PlanillaSinEmpleadosError,
} from '../../domain/planillas/planilla.models';
import { SUBSIDIOS_PERMITIDOS, type RegistrarNovedadDto } from './planillas.dto';

export const MAX_MESES_RESUMEN = 36;

function hoy(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

export function presentarCabecera(planilla: PlanillaCabecera) {
  return {
    id: planilla.id,
    periodo: planilla.periodo,
    anio: planilla.anio,
    mes: planilla.mes,
    estado: planilla.estado,
    version: planilla.version,
    totalEmpleados: planilla.totalEmpleados,
    totales: {
      totalGanado: planilla.totalGanado,
      aportesLaborales: planilla.totalAportesLaborales,
      ans: planilla.totalAns,
      rcIva: planilla.totalRcIva,
      otrosDescuentos: planilla.totalOtrosDescuentos,
      liquidoPagable: planilla.totalLiquido,
      aportesPatronales: planilla.totalAportesPatronales,
    },
    parametros: planilla.parametros,
    duracionMs: planilla.duracionMs,
    calculadoPor: planilla.calculadoPor,
    calculadoEn: planilla.calculadoEn.toISOString(),
    cerradoPor: planilla.cerradoPor,
    cerradoEn: planilla.cerradoEn ? planilla.cerradoEn.toISOString() : null,
    retencionHasta: planilla.retencionHasta,
    inmutable: planilla.estado === 'CERRADA',
  };
}

/** Desglose por funcionario: base de boleta PDF, autoconsulta y exportación. */
export function presentarDetalle(detalle: PlanillaDetalleRegistro) {
  return {
    id: detalle.id,
    planillaId: detalle.planillaId,
    periodo: detalle.periodo,
    estadoPlanilla: detalle.estado,
    empleado: {
      empleadoId: detalle.empleadoId,
      nombreCompleto: detalle.nombreCompleto,
      ciEnmascarado: detalle.ciEnmascarado,
      areaId: detalle.areaId,
      cargoId: detalle.cargoId,
      fechaIngreso: detalle.fechaIngreso,
      aniosAntiguedad: detalle.aniosAntiguedad,
    },
    diasTrabajados: detalle.diasTrabajados,
    haberes: {
      haberBasico: detalle.haberBasico,
      haberGanado: detalle.haberGanado,
      porcentajeBonoAntiguedad: detalle.porcentajeBono,
      bonoAntiguedad: detalle.bonoAntiguedad,
      otrosIngresos: detalle.otrosIngresos,
      totalGanado: detalle.totalGanado,
    },
    descuentos: {
      aporteLaboral: detalle.aporteLaboral,
      ans: detalle.ans,
      rcIva: detalle.rcIva,
      otrosDescuentos: detalle.otrosDescuentos,
      totalDescuentos: detalle.totalDescuentos,
    },
    rcIvaDetalle: {
      baseImponible: detalle.rcIvaBaseImponible,
      impuesto: detalle.rcIvaImpuesto,
      computable: detalle.rcIvaComputable,
      saldoAnterior: detalle.rcIvaSaldoAnterior,
      saldoSiguiente: detalle.rcIvaSaldoSiguiente,
    },
    liquidoPagable: detalle.liquidoPagable,
    aportePatronal: detalle.aportePatronal,
    subsidiosInformativos: detalle.subsidios,
  };
}

@Injectable()
export class PlanillasService {
  private readonly logger = new Logger(PlanillasService.name);

  constructor(
    @Inject(PLANILLA_REPOSITORY) private readonly repository: PlanillaRepository,
    @Inject(EMPLEADOS_NOMINA_PORT) private readonly personal: EmpleadosNominaPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async calcular(codigoPeriodo: string, actor: Actor) {
    const inicio = process.hrtime.bigint();
    const periodo = parsePeriodo(codigoPeriodo);
    if (compararFechas(periodo.fechaInicio, hoy(this.clock)) > 0) {
      throw new PeriodoFuturoError(periodo.codigo);
    }

    const existente = await this.repository.buscarPorPeriodo(periodo.codigo);
    if (existente?.estado === 'CERRADA') throw new PlanillaCerradaError(periodo.codigo);

    const raw = await this.repository.obtenerParametrosVigentes(periodo.fechaFin);
    const parametros = construirParametros(periodo.fechaFin, raw.filas, raw.escala);
    const [empleados, novedades, saldosRcIva] = await Promise.all([
      this.personal.listarActivos(actor),
      this.repository.novedadesComoMapa(periodo.codigo),
      this.repository.saldosRcIva(periodoAnterior(periodo)),
    ]);

    const resultado = calcularPlanilla({ periodo, parametros, empleados, novedades, saldosRcIva });
    if (resultado.detalles.length === 0) throw new PlanillaSinEmpleadosError(periodo.codigo);

    const duracionMs = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6);
    const cabecera = await this.repository.guardarBorrador({
      periodo: periodo.codigo,
      anio: periodo.anio,
      mes: periodo.mes,
      parametros: serializarParametros(parametros),
      detalles: resultado.detalles,
      totales: resultado.totales,
      duracionMs,
      actorUserId: actor.userId,
      calculadoEn: this.clock.now(),
    });
    const duracionTotalMs = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6);
    this.logger.log(
      `Planilla ${periodo.codigo} v${cabecera.version}: ${resultado.detalles.length} funcionarios en ${duracionTotalMs} ms`,
    );

    return {
      planilla: presentarCabecera(cabecera),
      observaciones: resultado.observaciones,
      duracionTotalMs,
    };
  }

  async cerrar(id: string, actor: Actor) {
    const planilla = await this.obtenerCabecera(id);
    if (planilla.estado === 'CERRADA') throw new PlanillaCerradaError(planilla.periodo);
    const anios = await this.repository.obtenerRetencionAnios();
    const cerradoEn = this.clock.now();
    const retencionHasta = sumarAnios(cerradoEn.toISOString().slice(0, 10), anios);
    const cerrada = await this.repository.cerrar(id, actor.userId, cerradoEn, retencionHasta);
    if (!cerrada) throw new PlanillaCerradaError(planilla.periodo);
    return presentarCabecera(cerrada);
  }

  async eliminarBorrador(id: string): Promise<void> {
    const planilla = await this.obtenerCabecera(id);
    if (planilla.estado === 'CERRADA') throw new PlanillaCerradaError(planilla.periodo);
    await this.repository.eliminarBorrador(id);
  }

  async registrarNovedad(
    codigoPeriodo: string,
    empleadoId: string,
    dto: RegistrarNovedadDto,
    actor: Actor,
  ) {
    const periodo = parsePeriodo(codigoPeriodo);
    const planilla = await this.repository.buscarPorPeriodo(periodo.codigo);
    if (planilla?.estado === 'CERRADA') throw new PlanillaCerradaError(periodo.codigo);

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

  async listar(filtro: {
    anio?: number;
    estado?: EstadoPlanilla;
    desde?: string;
    hasta?: string;
    page: number;
    pageSize: number;
  }) {
    if (filtro.desde) parsePeriodo(filtro.desde);
    if (filtro.hasta) parsePeriodo(filtro.hasta);
    const pagina = await this.repository.listar(filtro);
    return { data: pagina.data.map(presentarCabecera), meta: pagina.meta };
  }

  async obtener(id: string) {
    return presentarCabecera(await this.obtenerCabecera(id));
  }

  async obtenerPorPeriodo(codigoPeriodo: string) {
    const periodo = parsePeriodo(codigoPeriodo);
    const planilla = await this.repository.buscarPorPeriodo(periodo.codigo);
    if (!planilla) throw new PlanillaNoEncontradaError();
    return presentarCabecera(planilla);
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

  async resumenCostos(desde: string, hasta: string) {
    const inicio = parsePeriodo(desde);
    const fin = parsePeriodo(hasta);
    const meses = (fin.anio - inicio.anio) * 12 + (fin.mes - inicio.mes) + 1;
    if (meses < 1 || meses > MAX_MESES_RESUMEN) {
      throw new RangoInvalidoError(
        `El rango debe tener entre 1 y ${MAX_MESES_RESUMEN} meses y 'desde' no puede ser posterior a 'hasta'.`,
      );
    }
    return { desde, hasta, data: await this.repository.resumenCostos(desde, hasta) };
  }

  async parametrosVigentes(fecha?: string) {
    const fechaCorte = fecha ?? hoy(this.clock);
    parseFecha(fechaCorte);
    const raw = await this.repository.obtenerParametrosVigentes(fechaCorte);
    return serializarParametros(construirParametros(fechaCorte, raw.filas, raw.escala));
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

  private async obtenerCabecera(id: string): Promise<PlanillaCabecera> {
    const planilla = await this.repository.buscarPorId(id);
    if (!planilla) throw new PlanillaNoEncontradaError();
    return planilla;
  }
}

export class RangoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RangoInvalidoError';
  }
}
