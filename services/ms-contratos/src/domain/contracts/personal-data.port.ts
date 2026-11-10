import type { InternalPrincipal } from '@arca/internal-auth';

export const PERSONAL_DATA_PORT = Symbol('PERSONAL_DATA_PORT');

/**
 * Campos mínimos que ms-contratos solicita a ms-personal para resolver las
 * variables de la plantilla vigente. No se persisten CI ni remuneración.
 */
export interface DatosEmpleadoContrato {
  empleadoId: string;
  nombreEmpleado: string;
  ci: string;
  cargo: string;
  /** Se omite cuando el actor no tiene `personal:read_salary`. */
  remuneracion?: string;
  fechaIngreso: string;
  duracionPrueba: string;
}

export interface PersonalDataPort {
  getDatosContrato(
    empleadoId: string,
    principal: InternalPrincipal,
  ): Promise<DatosEmpleadoContrato>;
}
