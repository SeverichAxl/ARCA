import type {
  EmpleadoNomina,
  NovedadNomina,
  ResultadoEmpleado,
  TotalesPlanilla,
} from '../nomina/calculo';
import type { ParametroLegalRaw, ParametrosSerializados } from '../nomina/parametros';

/** Estados del modelo base (TSK-ARQ-202). El motor deja la planilla en CALCULADA. */
export type EstadoPlanilla = 'BORRADOR' | 'EN_PROCESO' | 'CALCULADA' | 'CERRADA' | 'ERROR';
export const ESTADOS_PLANILLA: readonly EstadoPlanilla[] = [
  'BORRADOR',
  'EN_PROCESO',
  'CALCULADA',
  'CERRADA',
  'ERROR',
];

/** Actor autenticado, proveniente de las cabeceras internas firmadas. */
export interface Actor {
  userId: string;
  empleadoId: string | null;
  rol: string;
  permisos: string[];
}

export interface PlanillaCabecera {
  id: string;
  periodo: string;
  anio: number;
  mes: number;
  estado: EstadoPlanilla;
  version: number;
  parametros: unknown;
  totalEmpleados: number;
  totalGanado: string;
  totalAportesLaborales: string;
  totalAns: string;
  totalRcIva: string;
  totalOtrosDescuentos: string;
  totalLiquido: string;
  totalAportesPatronales: string;
  duracionMs: number;
  calculadoPor: string | null;
  calculadoEn: Date | null;
  cerradoPor: string | null;
  cerradoEn: Date | null;
  retencionHasta: string | null;
  observacion: string | null;
  errorProceso: ErrorProceso | null;
}

/** Motivo guardado cuando el proceso asíncrono termina en ERROR. */
export interface ErrorProceso {
  code: string;
  message: string;
  empleadoId?: string;
}

/** Detalle persistido; importes como string decimal con 2 decimales. */
export interface PlanillaDetalleRegistro {
  id: string;
  planillaId: string;
  periodo: string;
  estado: EstadoPlanilla;
  empleadoId: string;
  nombreCompleto: string;
  ciEnmascarado: string | null;
  areaId: string | null;
  cargoId: string | null;
  fechaIngreso: string | null;
  haberBasico: string;
  diasTrabajados: number;
  haberGanado: string;
  aniosAntiguedad: number;
  porcentajeBono: string;
  bonoAntiguedad: string;
  otrosIngresos: string;
  totalGanado: string;
  aporteLaboral: string;
  ans: string;
  rcIvaBaseImponible: string;
  rcIvaImpuesto: string;
  rcIvaComputable: string;
  rcIvaSaldoAnterior: string;
  rcIvaSaldoSiguiente: string;
  rcIva: string;
  otrosDescuentos: string;
  totalDescuentos: string;
  liquidoPagable: string;
  aportePatronal: string;
  subsidios: Record<string, string>;
}

export interface NovedadRegistro {
  periodo: string;
  empleadoId: string;
  diasTrabajados: number | null;
  otrosIngresos: string;
  otrosDescuentos: string;
  rcIvaComputable: string;
  subsidios: Record<string, string>;
  observacion: string | null;
  actualizadoPor: string;
  actualizadoEn: Date;
}

export interface GuardarNovedadInput {
  periodo: string;
  empleadoId: string;
  diasTrabajados: number | null;
  otrosIngresos: bigint;
  otrosDescuentos: bigint;
  rcIvaComputable: bigint;
  subsidios: Record<string, string>;
  observacion: string | null;
  actorUserId: string;
}

export interface GuardarResultadoInput {
  planillaId: string;
  parametros: ParametrosSerializados;
  detalles: readonly ResultadoEmpleado[];
  totales: TotalesPlanilla;
  duracionMs: number;
}

export interface Pagina<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface FiltroPlanillas {
  periodo?: string;
  anio?: number;
  estado?: EstadoPlanilla;
  empleadoId?: string; // solo planillas donde el funcionario tiene detalle
  desde?: string;
  hasta?: string;
  page: number;
  pageSize: number;
}

export interface FiltroDetalle {
  areaId?: string;
  empleadoId?: string;
  page: number;
  pageSize: number;
}

export class PlanillaNoEncontradaError extends Error {
  constructor() {
    super('El recurso solicitado no existe.');
    this.name = 'PlanillaNoEncontradaError';
  }
}

/** Ya existe una planilla para el periodo (contrato: PLANILLA_PERIODO_DUPLICADO). */
export class PeriodoDuplicadoError extends Error {
  constructor(readonly periodo: string) {
    super(`Ya existe una planilla para el periodo ${periodo}.`);
    this.name = 'PeriodoDuplicadoError';
  }
}

/** Transición de estado no permitida (contrato: PLANILLA_ESTADO_INVALIDO). */
export class EstadoInvalidoError extends Error {
  constructor(
    readonly periodo: string,
    readonly estado: EstadoPlanilla,
    readonly operacion: 'recalcular' | 'cerrar' | 'eliminar' | 'novedad' | 'guardar',
  ) {
    super(`La planilla ${periodo} en estado ${estado} no admite la operación ${operacion}.`);
    this.name = 'EstadoInvalidoError';
  }
}

/** Un trigger de BD rechazó la escritura sobre registros de una planilla cerrada. */
export class PlanillaInmutableError extends Error {
  constructor(message = 'La planilla cerrada es inmutable.') {
    super(message);
    this.name = 'PlanillaInmutableError';
  }
}

export class PlanillaSinEmpleadosError extends Error {
  constructor(readonly periodo: string) {
    super(`No hay funcionarios activos para el periodo ${periodo}.`);
    this.name = 'PlanillaSinEmpleadosError';
  }
}

export class PersonalNoDisponibleError extends Error {
  constructor(message = 'No se pudo obtener la nómina de personal.') {
    super(message);
    this.name = 'PersonalNoDisponibleError';
  }
}

export class PeriodoFuturoError extends Error {
  constructor(readonly periodo: string) {
    super(`El periodo ${periodo} todavía no inició.`);
    this.name = 'PeriodoFuturoError';
  }
}

// --------------------------------------------------------------------------
// Puertos (RNF-08: el dominio no conoce Prisma ni HTTP)
// --------------------------------------------------------------------------

/** Lectura de funcionarios activos con haber básico, vía interfaz autorizada de ms-personal. */
export interface EmpleadosNominaPort {
  listarActivos(actor: Actor): Promise<EmpleadoNomina[]>;
}

export interface KpisPeriodo {
  periodo: string;
  costoPlanilla: string; // total ganado + aportes patronales
  boletasEmitidas: number;
}

export interface PlanillaRepository {
  /** Filas activas y vigentes a la fecha de corte (una por tipo+clave). */
  obtenerParametrosVigentes(fechaCorte: string): Promise<ParametroLegalRaw[]>;
  obtenerRetencionAnios(): Promise<number>;

  listarNovedades(periodo: string): Promise<NovedadRegistro[]>;
  novedadesComoMapa(periodo: string): Promise<Map<string, NovedadNomina>>;
  /** Lanza EstadoInvalidoError si la planilla del periodo está cerrada. */
  guardarNovedad(input: GuardarNovedadInput): Promise<NovedadRegistro>;

  /** Saldos RC-IVA a favor del dependiente según la planilla CERRADA del periodo. */
  saldosRcIva(periodo: string): Promise<Map<string, bigint>>;

  buscarPorPeriodo(periodo: string): Promise<PlanillaCabecera | null>;
  buscarPorId(id: string): Promise<PlanillaCabecera | null>;

  /**
   * Crea la planilla del periodo en EN_PROCESO, con bloqueo por periodo.
   * Lanza PeriodoDuplicadoError si ya existe una planilla para el periodo.
   */
  iniciarProceso(
    periodo: string,
    actorUserId: string,
    iniciadoEn: Date,
    observacion: string | null,
  ): Promise<PlanillaCabecera>;

  /**
   * Vuelve a EN_PROCESO una planilla CALCULADA, ERROR o BORRADOR (o EN_PROCESO
   * atascada desde antes de `atascadaAntesDe`). Lanza EstadoInvalidoError si no.
   */
  reiniciarProceso(
    id: string,
    actorUserId: string,
    iniciadoEn: Date,
    atascadaAntesDe: Date,
  ): Promise<PlanillaCabecera>;

  /** Reemplaza el detalle y deja la planilla CALCULADA. Solo desde EN_PROCESO. */
  guardarResultado(input: GuardarResultadoInput): Promise<PlanillaCabecera>;

  /** Marca ERROR con su motivo, solo si sigue EN_PROCESO. */
  marcarError(id: string, error: ErrorProceso): Promise<void>;

  /** Cierra solo CALCULADA -> CERRADA; null indica que ya no estaba CALCULADA. */
  cerrar(
    id: string,
    actorUserId: string,
    cerradoEn: Date,
    retencionHasta: string,
  ): Promise<PlanillaCabecera | null>;

  /** Elimina una planilla no cerrada y su detalle. Lanza EstadoInvalidoError si está cerrada. */
  eliminar(id: string): Promise<void>;

  listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>>;
  listarDetalle(
    planillaId: string,
    filtro: FiltroDetalle,
  ): Promise<Pagina<PlanillaDetalleRegistro>>;
  obtenerDetalle(planillaId: string, empleadoId: string): Promise<PlanillaDetalleRegistro | null>;

  /** Pagos (detalles de planillas CERRADAS) de un funcionario, más recientes primero. */
  listarPagosEmpleado(
    empleadoId: string,
    page: number,
    pageSize: number,
  ): Promise<Pagina<PlanillaDetalleRegistro>>;
  obtenerPagoEmpleado(empleadoId: string, periodo: string): Promise<PlanillaDetalleRegistro | null>;

  /** Área (snapshot) del funcionario en su planilla cerrada más reciente hasta el periodo. */
  areaDelEmpleado(empleadoId: string, hastaPeriodo: string): Promise<string | null>;

  /**
   * KPIs de planillas CERRADAS hasta `hastaPeriodo` (más recientes primero, máx. `limite`).
   * Con `areaId` se suman solo los detalles de esa área.
   */
  kpisCerradas(
    hastaPeriodo: string | null,
    areaId: string | null,
    limite: number,
  ): Promise<KpisPeriodo[]>;
}

export const PLANILLA_REPOSITORY = Symbol('PLANILLA_REPOSITORY');
export const EMPLEADOS_NOMINA_PORT = Symbol('EMPLEADOS_NOMINA_PORT');
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}
