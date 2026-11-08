import type {
  ContratoCreado,
  ContratoDetalle,
  ContratoEmpleadoResumen,
  ContratoVersionDetalle,
  CreateContratoData,
  CreateContratoVersionData,
} from './contract.models';

export const CONTRATO_REPOSITORY = Symbol('CONTRATO_REPOSITORY');

export interface ContratoRepository {
  create(data: CreateContratoData): Promise<ContratoCreado>;
  findById(id: string): Promise<ContratoDetalle | null>;
  findByEmpleadoId(empleadoId: string): Promise<ContratoEmpleadoResumen[]>;
  /** Última versión del contrato; sirve para heredar firmas ya registradas. */
  findLatestVersion(contratoId: string): Promise<ContratoVersionDetalle | null>;
  /** Versión puntual, validando que pertenezca al contrato. */
  findVersion(
    contratoId: string,
    versionId: string,
  ): Promise<ContratoVersionDetalle | null>;
  /**
   * Calcula `MAX(version) + 1` y persiste una fila nueva junto con el estado del
   * contrato dentro de una transacción. Nunca actualiza versiones anteriores.
   */
  createVersion(data: CreateContratoVersionData): Promise<ContratoVersionDetalle>;
}
