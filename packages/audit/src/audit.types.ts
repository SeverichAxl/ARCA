export type AuditResultado = 'EXITO' | 'FALLIDO';

export interface AuditErrorDetail {
  statusCode: number;
  code: string;
}

export interface AuditPayload {
  antes: unknown;
  despues: unknown;
  empleadoId?: string;
  error?: AuditErrorDetail;
}

export interface AuditEntry {
  eventId: string;
  occurredOn: Date;
  usuarioId: string | null;
  empleadoId: string | null;
  ipOrigen: string | null;
  modulo: string;
  accion: string;
  metodo: string;
  recurso: string;
  resultado: AuditResultado;
  payload: AuditPayload;
}

export interface AuditRecorder {
  record(entry: AuditEntry): Promise<void>;
}
