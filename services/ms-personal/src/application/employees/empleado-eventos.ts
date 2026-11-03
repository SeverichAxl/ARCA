import type { OutboxService, PrismaTransactionLike } from '@arca/messaging';
import type { JwtPayload } from 'common-dtos';
import { enmascarar } from '../../common/audit/enmascarar';
import { formatFecha } from '../../domain/empleado/fechas';

interface EmpleadoParaEvento {
  id: string;
  nombres: string;
  apellidos: string;
  areaId: string;
  estado: string;
  fechaIngreso: Date;
}

/** Payload común de eventos de empleado: nunca CI ni montos. */
export function payloadEmpleado(
  e: EmpleadoParaEvento,
  jefeEmpleadoId: string | null,
  fechaBaja: Date | null,
) {
  return {
    empleadoId: e.id,
    nombreCompleto: `${e.nombres} ${e.apellidos}`,
    areaId: e.areaId,
    jefeEmpleadoId,
    estado: e.estado,
    fechaIngreso: formatFecha(e.fechaIngreso),
    fechaBaja: fechaBaja ? formatFecha(fechaBaja) : null,
  };
}

/** Registra AUDITORIA_REGISTRADA en el Outbox, en la misma transacción del cambio. */
export async function registrarAuditoria(
  outbox: OutboxService,
  tx: PrismaTransactionLike,
  actor: JwtPayload,
  accion: string,
  entidad: string,
  entidadId: string,
  datos?: Record<string, unknown>,
): Promise<void> {
  await outbox.add(tx, 'AUDITORIA_REGISTRADA', {
    usuarioId: actor.sub,
    accion,
    modulo: 'personal',
    entidad,
    entidadId,
    ...(datos ? { datos: enmascarar(datos) } : {}),
  });
}
