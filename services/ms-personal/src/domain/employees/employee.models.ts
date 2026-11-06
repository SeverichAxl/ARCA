import type { TipoInamovilidad } from './inamovilidad';

export type EstadoEmpleado = 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';

export type TipoMovimiento =
  | 'ALTA'
  | 'CAMBIO_AREA'
  | 'CAMBIO_CARGO'
  | 'CAMBIO_REMUNERACION'
  | 'RATIFICACION'
  | 'BAJA';

export interface EmpleadoRecord {
  id: string;
  nombres: string;
  apellidos: string;
  ciCifrado: string;
  ciHash: string;
  ciExpedido: string | null;
  fechaNacimiento: string | null;
  esExtranjero: boolean;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  areaId: string;
  cargoId: string;
  remuneracionCifrada: string;
  fechaIngreso: string;
  diasPrueba: number;
  estado: EstadoEmpleado;
  fechaRatificacion: string | null;
  firmaPublicId: string;
  creadoPor: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface InamovilidadRecord {
  id: string;
  empleadoId: string;
  tipo: TipoInamovilidad;
  fechaInicio: string;
  fechaFin: string | null;
  estadoActivo: boolean;
  respaldoPublicId: string | null;
  observacion: string | null;
  registradoPor: string;
  creadoEn: Date;
}

export interface HistorialRecord {
  id: string;
  empleadoId: string;
  tipo: TipoMovimiento;
  fechaEfectiva: string;
  motivo: string | null;
  areaAnteriorId: string | null;
  areaNuevaId: string | null;
  cargoAnteriorId: string | null;
  cargoNuevoId: string | null;
  remuneracionAnteriorCifrada: string | null;
  remuneracionNuevaCifrada: string | null;
  registradoPor: string;
  creadoEn: Date;
}

export interface BajaRecord {
  id: string;
  empleadoId: string;
  fechaBaja: string;
  motivo: string;
  aplicaDesahucio: boolean;
  autorizacionMtPublicId: string | null;
  sueldoPromedioCifrado: string;
  finiquitoTotalCifrado: string;
  finiquitoDetalleCifrado: string;
  registradoPor: string;
  creadoEn: Date;
}

export interface CreateEmpleadoData {
  nombres: string;
  apellidos: string;
  ciCifrado: string;
  ciHash: string;
  ciExpedido: string | null;
  fechaNacimiento: string | null;
  esExtranjero: boolean;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  areaId: string;
  cargoId: string;
  remuneracionCifrada: string;
  fechaIngreso: string;
  diasPrueba: number;
  estado: EstadoEmpleado;
  firmaPublicId: string;
  creadoPor: string;
}

export interface UpdateEmpleadoData {
  areaId?: string;
  cargoId?: string;
  remuneracionCifrada?: string;
  estado?: EstadoEmpleado;
  fechaRatificacion?: string | null;
}

export interface CreateHistorialData {
  empleadoId: string;
  tipo: TipoMovimiento;
  fechaEfectiva: string;
  motivo: string | null;
  areaAnteriorId: string | null;
  areaNuevaId: string | null;
  cargoAnteriorId: string | null;
  cargoNuevoId: string | null;
  remuneracionAnteriorCifrada: string | null;
  remuneracionNuevaCifrada: string | null;
  registradoPor: string;
}

export interface CreateInamovilidadData {
  empleadoId: string;
  tipo: TipoInamovilidad;
  fechaInicio: string;
  fechaFin: string | null;
  estadoActivo: boolean;
  respaldoPublicId: string | null;
  observacion: string | null;
  registradoPor: string;
}

export interface CreateBajaData {
  empleadoId: string;
  fechaBaja: string;
  motivo: string;
  aplicaDesahucio: boolean;
  autorizacionMtPublicId: string | null;
  sueldoPromedioCifrado: string;
  finiquitoTotalCifrado: string;
  finiquitoDetalleCifrado: string;
  registradoPor: string;
}

export interface EmployeeListQuery {
  /** Restricción para el propio funcionario. */
  empleadoId?: string;
  nombre?: string;
  ciHash?: string;
  areaId?: string;
  areaIdsRestringidos?: string[];
  cargoId?: string;
  estado?: EstadoEmpleado;
  inamovilidad?: boolean;
  fechaReferenciaInamovilidad: string;
  page: number;
  pageSize: number;
}

export interface HistorialListQuery {
  empleadoId: string;
  page: number;
  pageSize: number;
}

export interface InamovilidadListQuery {
  empleadoId: string;
  page: number;
  pageSize: number;
}

export interface Page<T> {
  data: T[];
  total: number;
}
