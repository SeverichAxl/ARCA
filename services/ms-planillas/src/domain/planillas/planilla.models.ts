import type {
  EmpleadoNomina,
  NovedadNomina,
  ResultadoEmpleado,
  TotalesPlanilla,
} from '../nomina/calculo';
import type {
  ParametroVigenteRaw,
  ParametrosSerializados,
  TramoEscalaRaw,
} from '../nomina/parametros';

export type EstadoPlanilla = 'BORRADOR' | 'CERRADA';

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
  calculadoPor: string;
  calculadoEn: Date;
  cerradoPor: string | null;
  cerradoEn: Date | null;
  retencionHasta: string | null;
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
  areaId: string;
  cargoId: string;
  fechaIngreso: string;
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

export interface GuardarBorradorInput {
  periodo: string;
  anio: number;
  mes: number;
  parametros: ParametrosSerializados;
  detalles: readonly ResultadoEmpleado[];
  totales: TotalesPlanilla;
  duracionMs: number;
  actorUserId: string;
  calculadoEn: Date;
}

export interface Pagina<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface FiltroPlanillas {
  anio?: number;
  estado?: EstadoPlanilla;
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

export interface ResumenPeriodo {
  periodo: string;
  totalEmpleados: number;
  totalGanado: string;
  totalAportesPatronales: string;
  costoTotal: string;
  totalLiquido: string;
}

export class PlanillaNoEncontradaError extends Error {
  constructor() {
    super('El recurso solicitado no existe.');
    this.name = 'PlanillaNoEncontradaError';
  }
}

export class PlanillaCerradaError extends Error {
  constructor(readonly periodo: string) {
    super(`La planilla ${periodo} está cerrada y no admite cambios.`);
    this.name = 'PlanillaCerradaError';
  }
}

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

/** Lectura de funcionarios activos con haber básico, vía ms-personal. */
export interface EmpleadosNominaPort {
  listarActivos(actor: Actor): Promise<EmpleadoNomina[]>;
}

export interface ParametrosVigentesRaw {
  filas: ParametroVigenteRaw[];
  escala: TramoEscalaRaw[];
}

export interface PlanillaRepository {
  obtenerParametrosVigentes(fechaCorte: string): Promise<ParametrosVigentesRaw>;
  obtenerRetencionAnios(): Promise<number>;
  listarNovedades(periodo: string): Promise<NovedadRegistro[]>;
  novedadesComoMapa(periodo: string): Promise<Map<string, NovedadNomina>>;
  guardarNovedad(input: GuardarNovedadInput): Promise<NovedadRegistro>;
  saldosRcIva(periodo: string): Promise<Map<string, bigint>>;
  buscarPorPeriodo(periodo: string): Promise<PlanillaCabecera | null>;
  buscarPorId(id: string): Promise<PlanillaCabecera | null>;

  /** Crea o recalcula el BORRADOR con bloqueo por periodo. */
  guardarBorrador(input: GuardarBorradorInput): Promise<PlanillaCabecera>;

  /** Cierra solo BORRADOR -> CERRADA; null indica cierre concurrente. */
  cerrar(
    id: string,
    actorUserId: string,
    cerradoEn: Date,
    retencionHasta: string,
  ): Promise<PlanillaCabecera | null>;

  eliminarBorrador(id: string): Promise<void>;
  listar(filtro: FiltroPlanillas): Promise<Pagina<PlanillaCabecera>>;
  listarDetalle(planillaId: string, filtro: FiltroDetalle): Promise<Pagina<PlanillaDetalleRegistro>>;
  obtenerDetalle(planillaId: string, empleadoId: string): Promise<PlanillaDetalleRegistro | null>;
  listarPagosEmpleado(
    empleadoId: string,
    page: number,
    pageSize: number,
  ): Promise<Pagina<PlanillaDetalleRegistro>>;
  obtenerPagoEmpleado(empleadoId: string, periodo: string): Promise<PlanillaDetalleRegistro | null>;
  resumenCostos(desde: string, hasta: string): Promise<ResumenPeriodo[]>;
}

export const PLANILLA_REPOSITORY = Symbol('PLANILLA_REPOSITORY');
export const EMPLEADOS_NOMINA_PORT = Symbol('EMPLEADOS_NOMINA_PORT');
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}
