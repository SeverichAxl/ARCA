import type { AuditEntry, AuditRecorder } from '../audit.types';
import { maskSensitive } from '../mask';

export interface AuditLogPrismaClient {
  auditoriaLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Adaptador para ms-auth: escribe directamente en auditoria_log, en la misma
 * base que conoce Prisma. El payload se vuelve a enmascarar aquí como defensa
 * en profundidad.
 */
export class PrismaAuditLogRecorder implements AuditRecorder {
  constructor(private readonly prisma: AuditLogPrismaClient) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditoriaLog.create({
      data: {
        eventId: entry.eventId,
        usuarioId: entry.usuarioId,
        ipOrigen: entry.ipOrigen,
        modulo: entry.modulo,
        accion: entry.accion,
        metodo: entry.metodo,
        recurso: entry.recurso,
        resultado: entry.resultado,
        payload: maskSensitive(entry.payload),
        ocurridoEn: entry.occurredOn,
      },
    });
  }
}
