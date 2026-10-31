import { DuplicateEventError } from '@arca/messaging';
import type {
  EventEnvelope,
  EventHandler,
  PrismaTransactionLike,
} from '@arca/messaging';

interface AuditEventPayload {
  usuarioId: string | null;
  accion: string;
  modulo: string;
  entidad: string;
  entidadId: string;
  datos?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAuditPayload(value: unknown): AuditEventPayload {
  if (
    !isRecord(value) ||
    (value.usuarioId !== null && typeof value.usuarioId !== 'string') ||
    typeof value.accion !== 'string' ||
    typeof value.modulo !== 'string' ||
    typeof value.entidad !== 'string' ||
    typeof value.entidadId !== 'string' ||
    (value.datos !== undefined && !isRecord(value.datos))
  ) {
    throw new Error('El payload AUDITORIA_REGISTRADA no cumple el contrato.');
  }
  return {
    usuarioId: value.usuarioId as string | null,
    accion: value.accion as string,
    modulo: value.modulo as string,
    entidad: value.entidad as string,
    entidadId: value.entidadId as string,
    ...(value.datos === undefined
      ? {}
      : { datos: value.datos as Record<string, unknown> }),
  };
}

export const consumeAuditEvent: EventHandler = async (
  tx: PrismaTransactionLike,
  envelope: EventEnvelope,
): Promise<void> => {
  if (envelope.eventName !== 'AUDITORIA_REGISTRADA') {
    throw new Error(`Evento de auditoría no soportado: ${envelope.eventName}.`);
  }
  const payload = parseAuditPayload(envelope.payload);
  const occurredOn = new Date(envelope.occurredOn);
  if (Number.isNaN(occurredOn.getTime())) {
    throw new Error('occurredOn no contiene una fecha ISO válida.');
  }

  const inserted = await tx.$queryRaw<Array<{ eventId: string }>>`
    INSERT INTO auditoria_log (
      event_id, usuario_id, modulo, accion, recurso, resultado,
      payload_json, ocurrido_en
    )
    VALUES (
      ${envelope.eventId}::uuid, ${payload.usuarioId}::uuid,
      ${payload.modulo}, ${payload.accion},
      ${`${payload.entidad}:${payload.entidadId}`}, 'EXITO',
      ${payload.datos === undefined ? null : JSON.stringify(payload.datos)}::jsonb,
      ${occurredOn}
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id AS "eventId"
  `;
  if (inserted.length === 0) {
    throw new DuplicateEventError();
  }
};
