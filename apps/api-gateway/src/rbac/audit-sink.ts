import { Injectable, Logger } from '@nestjs/common';

export interface AuditDeniedEvent {
  userId: string | null;
  ip: string;
  method: string;
  ruta: string;
  motivo: string;
  statusCode: number;
  traceId: string;
  occurredOn: string;
}

/**
 * Punto de enganche de auditoría del gateway.
 *
 * TSK-DEV2-104 (Laura) sustituirá LoggerAuditSink por un publicador real de
 * AUDITORIA_REGISTRADA. El gateway NO se conecta a base de datos y no publica
 * directamente el evento en esta tarea.
 */
export interface AuditSink {
  record(event: AuditDeniedEvent): void;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');

@Injectable()
export class LoggerAuditSink implements AuditSink {
  private readonly logger = new Logger(LoggerAuditSink.name);

  record(event: AuditDeniedEvent): void {
    // Nunca se registra el token ni las cabeceras originales.
    this.logger.warn(JSON.stringify({ event: 'AUTH_DECISION_DENEGADA', ...event }));
  }
}
