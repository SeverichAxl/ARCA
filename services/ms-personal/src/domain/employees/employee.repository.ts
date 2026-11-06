import type {
  BajaRecord,
  CreateBajaData,
  CreateEmpleadoData,
  CreateHistorialData,
  CreateInamovilidadData,
  EmpleadoRecord,
  EmployeeListQuery,
  HistorialListQuery,
  HistorialRecord,
  InamovilidadListQuery,
  InamovilidadRecord,
  Page,
  UpdateEmpleadoData,
} from './employee.models';

export type OutboxPayload =
  | string
  | number
  | boolean
  | null
  | OutboxPayload[]
  | { [key: string]: OutboxPayload };

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

/** Se lanza cuando el índice único de ci_hash detecta una carrera. */
export class CiDuplicadaError extends Error {
  constructor() {
    super('Ya existe un funcionario con ese CI.');
    this.name = 'CiDuplicadaError';
  }
}

/** Se lanza cuando una transición exige un empleado que ya no está activo. */
export class EmpleadoInactivoError extends Error {
  constructor() {
    super('El funcionario está inactivo.');
    this.name = 'EmpleadoInactivoError';
  }
}

export interface EmployeeTransaction {
  findEmpleadoById(id: string, options?: { forUpdate?: boolean }): Promise<EmpleadoRecord | null>;
  createEmpleado(data: CreateEmpleadoData): Promise<EmpleadoRecord>;
  updateEmpleado(id: string, data: UpdateEmpleadoData): Promise<EmpleadoRecord>;
  /** Cambia el estado solo si sigue distinto de INACTIVO; devuelve false si no aplicó. */
  updateEstadoSiActivo(id: string, data: UpdateEmpleadoData): Promise<boolean>;

  createHistorial(data: CreateHistorialData): Promise<void>;
  createInamovilidad(data: CreateInamovilidadData): Promise<InamovilidadRecord>;
  listInamovilidadesByEmpleado(empleadoId: string): Promise<InamovilidadRecord[]>;
  findInamovilidadById(id: string): Promise<InamovilidadRecord | null>;
  cerrarInamovilidad(id: string, fechaFin: string, observacion: string | null): Promise<boolean>;

  createBaja(data: CreateBajaData): Promise<BajaRecord>;

  getConfig(clave: string): Promise<string | null>;
  lockLimiteExtranjeros(): Promise<void>;
  countEmpleadosActivos(): Promise<number>;
  countExtranjerosActivos(): Promise<number>;

  addOutbox(eventName: string, payload: Exclude<OutboxPayload, null>): Promise<void>;
}

export interface EmployeeRepository {
  /** Ejecuta el trabajo en una única transacción Prisma (cambio + outbox). */
  withTransaction<T>(work: (tx: EmployeeTransaction) => Promise<T>): Promise<T>;
  findEmpleadoById(id: string): Promise<EmpleadoRecord | null>;
  /** Inamovilidades vigentes para una fecha de referencia (para listados y fichas). */
  findInamovilidadesVigentes(
    empleadoIds: string[],
    fechaReferencia: string,
  ): Promise<InamovilidadRecord[]>;
  listEmpleados(query: EmployeeListQuery): Promise<Page<EmpleadoRecord>>;
  listHistorial(query: HistorialListQuery): Promise<Page<HistorialRecord>>;
  listInamovilidades(query: InamovilidadListQuery): Promise<Page<InamovilidadRecord>>;
}
