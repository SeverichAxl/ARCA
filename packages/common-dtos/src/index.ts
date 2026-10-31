export interface JwtPayload {
  sub: string;
  empleadoId: string;
  rol: string;
  permisos: string[];
  iss: string;
  aud: string;
  exp: number;
}

export interface EventEnvelope<TPayload = unknown> {
  eventId: string;
  eventName: EventName;
  version: number;
  occurredOn: string;
  producer: string;
  payload: TPayload;
}

export const EVENT_NAMES = {
  EMPLEADO_CREADO: 'EMPLEADO_CREADO',
  EMPLEADO_MODIFICADO: 'EMPLEADO_MODIFICADO',
  EMPLEADO_DADO_DE_BAJA: 'EMPLEADO_DADO_DE_BAJA',
  AUDITORIA_REGISTRADA: 'AUDITORIA_REGISTRADA',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export type EmpleadoCreadoPayload = {
  empleadoId: string;
  nombreCompleto: string;
  areaId: string;
  jefeEmpleadoId: string | null;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: string;
  fechaBaja: string | null;
};

export type EmpleadoModificadoPayload = {
  empleadoId: string;
  nombreCompleto: string;
  areaId: string;
  jefeEmpleadoId: string | null;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: string;
  fechaBaja: string | null;
};

export type EmpleadoDadoDeBajaPayload = {
  empleadoId: string;
  nombreCompleto: string;
  areaId: string;
  jefeEmpleadoId: string | null;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: string;
  fechaBaja: string;
};

export type AuditoriaRegistradaPayload = {
  usuarioId: string;
  accion: string;
  modulo: string;
  entidad: string;
  entidadId: string;
  datos?: Record<string, unknown>;
};
