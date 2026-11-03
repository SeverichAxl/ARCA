import { OutboxService, type JsonValue, type PrismaTransactionLike } from '@arca/messaging';
import type { AuditEntry, AuditRecorder } from '../audit.types';
import { maskSensitive } from '../mask';

export interface OutboxAuditPrismaClient {
  $transaction<T>(callback: (tx: PrismaTransactionLike) => Promise<T>): Promise<T>;
}

/**
 * Adaptador para servicios con su propia base: inserta AUDITORIA_REGISTRADA en
 * su outbox_evento. El publicador de @arca/messaging agrega version, producer y
 * eventId (UUID) al sobre. El payload se enmascara antes de persistir/publish.
 */
export class OutboxAuditRecorder implements AuditRecorder {
  constructor(
    private readonly prisma: OutboxAuditPrismaClient,
    private readonly outbox: OutboxService,
    private readonly producer: string,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const datos = maskSensitive(entry.payload) as Record<string, unknown>;
    const payload = {
      usuarioId: entry.usuarioId,
      accion: entry.accion,
      modulo: entry.modulo,
      entidad: entry.modulo,
      entidadId: entry.recurso,
      datos,
      empleadoId: entry.empleadoId,
      ipOrigen: entry.ipOrigen,
      metodo: entry.metodo,
      recurso: entry.recurso,
      resultado: entry.resultado,
      producer: this.producer,
      ocurridoEn: entry.occurredOn.toISOString(),
    };

    await this.prisma.$transaction((tx) =>
      this.outbox.add(
        tx,
        'AUDITORIA_REGISTRADA',
        payload as unknown as Exclude<JsonValue, null>,
      ),
    );
  }
}
