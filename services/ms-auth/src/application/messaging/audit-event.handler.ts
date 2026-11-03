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
  ipOrigen?: string | null;
  metodo?: string | null;
  recurso?: string | null;
  resultado?: 'EXITO' | 'FALLIDO';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function maskAuditPayload(value: unknown, key = ''): unknown {
  const normalizedKey = key.toLowerCase();
  if (/password|token|remuneracion/.test(normalizedKey)) return '***';
  if (/^(ci|ci_|ci[A-Z])/.test(key) || normalizedKey === 'ci') {
    const text = String(value ?? '');
    return `***${text.slice(-4)}`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskAuditPayload(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        maskAuditPayload(childValue, childKey),
      ]),
    );
  }
  return value;
}

function parseAuditPayload(value: unknown): AuditEventPayload {
  if (
    !isRecord(value) ||
    (value.usuarioId !== null && typeof value.usuarioId !== 'string') ||
    typeof value.accion !== 'string' ||
    typeof value.modulo !== 'string' ||
    typeof value.entidad !== 'string' ||
    typeof value.entidadId !== 'string' ||
    (value.datos !== undefined && !isRecord(value.datos)) ||
    (value.ipOrigen !== undefined &&
      value.ipOrigen !== null &&
      typeof value.ipOrigen !== 'string') ||
    (value.metodo !== undefined && value.metodo !== null && typeof value.metodo !== 'string') ||
    (value.recurso !== undefined &&
      value.recurso !== null &&
      typeof value.recurso !== 'string') ||
    (value.resultado !== undefined &&
      value.resultado !== 'EXITO' &&
      value.resultado !== 'FALLIDO')
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
    ipOrigen: (value.ipOrigen as string | null | undefined) ?? null,
    metodo: (value.metodo as string | null | undefined) ?? null,
    recurso: (value.recurso as string | null | undefined) ?? null,
    resultado: (value.resultado as 'EXITO' | 'FALLIDO' | undefined) ?? 'EXITO',
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
      event_id, usuario_id, ip_origen, modulo, accion, metodo, recurso,
      resultado, payload_json, ocurrido_en
    )
    VALUES (
      ${envelope.eventId}::uuid, ${payload.usuarioId}::uuid,
      ${payload.ipOrigen}, ${payload.modulo}, ${payload.accion},
      ${payload.metodo},
      ${payload.recurso ?? `${payload.entidad}:${payload.entidadId}`},
      ${payload.resultado}::"ResultadoAuditoria",
      ${payload.datos === undefined ? null : JSON.stringify(maskAuditPayload(payload.datos))}::jsonb,
      ${occurredOn}
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id AS "eventId"
  `;
  if (inserted.length === 0) {
    throw new DuplicateEventError();
  }
};
