import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OutboxService } from '@arca/messaging';
import type { JsonValue, PrismaTransactionLike } from '@arca/messaging';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface VacationActor {
  usuarioId: string;
  empleadoId: string;
  rol: string;
  permisos: string[];
}

type RequestState =
  'PENDIENTE_JEFE' | 'APROBADO_JEFE' | 'APROBADO_FINAL' | 'RECHAZADA' | 'CANCELADA';

interface RequestRecord {
  id: string;
  empleado_id: string;
  jefe_empleado_id: string | null;
  dias_habiles: number;
  estado: RequestState;
}

interface ManagerRecord {
  jefe_empleado_id: string | null;
}

interface BalanceRecord {
  id: string;
  gestion: number;
  dias_asignados: number;
  dias_tomados: number;
}

interface ExceptionRecord {
  id: string;
  solicitud_id: string;
  dias_excedentes: number;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
}

function stateError(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, code, message });
}

@Injectable()
export class VacationApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async approveByManager(requestId: string, actor: VacationActor, comentario?: string) {
    this.assertPermission(actor, 'vacaciones:approve_jefe');
    if (actor.rol !== 'JEFE_AREA') {
      throw new ForbiddenException('Solo un JEFE_AREA puede aprobar en el nivel de jefatura.');
    }
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.assertNotSelf(request, actor);
      if (request.estado !== 'PENDIENTE_JEFE') {
        throw stateError('VAC_ESTADO_INVALIDO', 'La solicitud no admite esta transición.');
      }

      const [employee] = await tx.$queryRaw<ManagerRecord[]>`
        SELECT jefe_empleado_id
        FROM empleado_ref
        WHERE empleado_id = ${request.empleado_id}::uuid
        FOR UPDATE
      `;
      if (
        !request.jefe_empleado_id ||
        request.jefe_empleado_id !== actor.empleadoId ||
        employee?.jefe_empleado_id !== actor.empleadoId
      ) {
        throw new ForbiddenException('Solo el jefe inmediato actual puede aprobar esta solicitud.');
      }

      const approvedAt = new Date();
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE solicitud_vacacion
        SET estado = 'APROBADO_JEFE'::"EstadoSolicitud",
            aprobado_jefe_por = ${actor.empleadoId}::uuid,
            aprobado_jefe_en = ${approvedAt},
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ${requestId}::uuid
          AND estado = 'PENDIENTE_JEFE'::"EstadoSolicitud"
        RETURNING id
      `;
      this.assertUpdated(updated);
      await this.recordTransition(
        tx,
        requestId,
        'PENDIENTE_JEFE',
        'APROBADO_JEFE',
        actor.usuarioId,
        comentario,
      );
      await this.audit(tx, actor.usuarioId, 'VACACION_APROBAR_JEFE', requestId, {
        estadoAnterior: 'PENDIENTE_JEFE',
        estadoNuevo: 'APROBADO_JEFE',
      });

      return {
        id: requestId,
        estado: 'APROBADO_JEFE' as const,
        aprobadoJefePor: actor.empleadoId,
        aprobadoJefeEn: approvedAt,
      };
    });
  }

  async approveByHr(requestId: string, actor: VacationActor, comentario?: string) {
    this.assertPermission(actor, 'vacaciones:approve_rrhh');
    if (actor.rol !== 'RRHH_OPERATIVO') {
      throw new ForbiddenException('Solo RRHH_OPERATIVO puede aprobar en el nivel final.');
    }
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.assertNotSelf(request, actor);
      if (request.estado !== 'APROBADO_JEFE') {
        throw stateError('VAC_ESTADO_INVALIDO', 'La solicitud no admite esta transición.');
      }

      await tx.$queryRaw`
        SELECT empleado_id
        FROM empleado_ref
        WHERE empleado_id = ${request.empleado_id}::uuid
        FOR UPDATE
      `;
      const [exception] = await tx.$queryRaw<
        Array<{ estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'; dias_excedentes: number }>
      >`
        SELECT estado, dias_excedentes
        FROM solicitud_excepcion
        WHERE solicitud_id = ${requestId}::uuid
        FOR UPDATE
      `;
      if (exception?.estado === 'PENDIENTE') {
        throw stateError(
          'VAC_EXCEPCION_PENDIENTE',
          'La excepción debe resolverse antes de aprobar definitivamente.',
        );
      }
      const balances = await tx.$queryRaw<BalanceRecord[]>`
        SELECT id, gestion, dias_asignados, dias_tomados
        FROM saldo_vacaciones
        WHERE empleado_id = ${request.empleado_id}::uuid
          AND congelado = FALSE
        ORDER BY gestion
        FOR UPDATE
      `;
      const availableDays = balances.reduce(
        (total, balance) => total + balance.dias_asignados - balance.dias_tomados,
        0,
      );
      let remainingToCharge = Math.min(request.dias_habiles, Math.max(availableDays, 0));
      const uncoveredDays = request.dias_habiles - remainingToCharge;
      const approvedExceptionDays =
        exception?.estado === 'APROBADA' ? exception.dias_excedentes : 0;
      if (uncoveredDays > approvedExceptionDays) {
        throw stateError(
          'VAC_SALDO_INSUFICIENTE',
          'El saldo actual no cubre los días solicitados y la excepción aprobada.',
        );
      }

      const discounts: Array<{ saldoId: string; gestion: number; dias: number }> = [];
      for (const balance of balances) {
        if (remainingToCharge === 0) {
          break;
        }
        const pending = balance.dias_asignados - balance.dias_tomados;
        const days = Math.min(pending, remainingToCharge);
        if (days <= 0) {
          continue;
        }
        const updatedBalance = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE saldo_vacaciones
          SET dias_tomados = dias_tomados + ${days}
          WHERE id = ${balance.id}::uuid
            AND congelado = FALSE
            AND dias_tomados + ${days} <= dias_asignados
          RETURNING id
        `;
        if (updatedBalance.length === 0) {
          throw stateError(
            'VAC_SALDO_INSUFICIENTE',
            'El saldo cambió durante la aprobación; vuelva a intentarlo.',
          );
        }
        await tx.$queryRaw`
          INSERT INTO descuento_saldo (id, solicitud_id, saldo_id, dias)
          VALUES (
            ${randomUUID()}::uuid,
            ${requestId}::uuid,
            ${balance.id}::uuid,
            ${days}
          )
          RETURNING id
        `;
        discounts.push({ saldoId: balance.id, gestion: balance.gestion, dias: days });
        remainingToCharge -= days;
      }

      const approvedAt = new Date();
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE solicitud_vacacion
        SET estado = 'APROBADO_FINAL'::"EstadoSolicitud",
            aprobado_rrhh_por = ${actor.empleadoId}::uuid,
            aprobado_rrhh_en = ${approvedAt},
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ${requestId}::uuid
          AND estado = 'APROBADO_JEFE'::"EstadoSolicitud"
        RETURNING id
      `;
      this.assertUpdated(updated);
      await this.recordTransition(
        tx,
        requestId,
        'APROBADO_JEFE',
        'APROBADO_FINAL',
        actor.usuarioId,
        comentario,
      );
      await this.audit(tx, actor.usuarioId, 'VACACION_APROBAR_RRHH', requestId, {
        estadoAnterior: 'APROBADO_JEFE',
        estadoNuevo: 'APROBADO_FINAL',
        descuentos: discounts,
        diasPorExcepcion: uncoveredDays,
      });

      return {
        id: requestId,
        estado: 'APROBADO_FINAL' as const,
        aprobadoRrhhPor: actor.empleadoId,
        aprobadoRrhhEn: approvedAt,
        descuentos: discounts,
      };
    });
  }

  async reject(requestId: string, actor: VacationActor, motivo: string) {
    const canRejectAsManager =
      actor.rol === 'JEFE_AREA' && actor.permisos.includes('vacaciones:approve_jefe');
    const canRejectAsHr =
      actor.rol === 'RRHH_OPERATIVO' && actor.permisos.includes('vacaciones:approve_rrhh');
    if (!canRejectAsManager && !canRejectAsHr) {
      throw new ForbiddenException('No tiene permiso para rechazar esta solicitud.');
    }
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.assertNotSelf(request, actor);

      let from: 'PENDIENTE_JEFE' | 'APROBADO_JEFE';
      let action: 'VACACION_RECHAZAR_JEFE' | 'VACACION_RECHAZAR_RRHH';
      if (request.estado === 'PENDIENTE_JEFE' && canRejectAsManager) {
        from = 'PENDIENTE_JEFE';
        action = 'VACACION_RECHAZAR_JEFE';
        const [employee] = await tx.$queryRaw<ManagerRecord[]>`
          SELECT jefe_empleado_id
          FROM empleado_ref
          WHERE empleado_id = ${request.empleado_id}::uuid
          FOR UPDATE
        `;
        if (
          !request.jefe_empleado_id ||
          request.jefe_empleado_id !== actor.empleadoId ||
          employee?.jefe_empleado_id !== actor.empleadoId
        ) {
          throw new ForbiddenException(
            'Solo el jefe inmediato actual puede rechazar esta solicitud.',
          );
        }
      } else if (request.estado === 'APROBADO_JEFE' && canRejectAsHr) {
        from = 'APROBADO_JEFE';
        action = 'VACACION_RECHAZAR_RRHH';
      } else {
        throw stateError('VAC_ESTADO_INVALIDO', 'La solicitud no admite esta transición.');
      }

      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE solicitud_vacacion
        SET estado = 'RECHAZADA'::"EstadoSolicitud",
            motivo_rechazo = ${motivo.trim()},
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ${requestId}::uuid
          AND estado = ${from}::"EstadoSolicitud"
        RETURNING id
      `;
      this.assertUpdated(updated);
      await this.recordTransition(tx, requestId, from, 'RECHAZADA', actor.usuarioId, motivo.trim());
      await this.audit(tx, actor.usuarioId, action, requestId, {
        estadoAnterior: from,
        estadoNuevo: 'RECHAZADA',
        motivo: motivo.trim(),
      });

      return { id: requestId, estado: 'RECHAZADA' as const };
    });
  }

  async resolveException(
    exceptionId: string,
    actor: VacationActor,
    decision: 'APROBADA' | 'RECHAZADA',
    comentario?: string,
  ) {
    this.assertPermission(actor, 'vacaciones:excepcion_resolve');
    if (!['GERENCIA', 'RRHH_OPERATIVO'].includes(actor.rol)) {
      throw new ForbiddenException('Solo GERENCIA o RRHH_OPERATIVO puede resolver excepciones.');
    }

    return this.prisma.$transaction(async (tx) => {
      const [exceptionReference] = await tx.$queryRaw<Array<{ solicitud_id: string }>>`
        SELECT solicitud_id
        FROM solicitud_excepcion
        WHERE id = ${exceptionId}::uuid
      `;
      if (!exceptionReference) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'La excepción solicitada no existe.',
        });
      }
      const request = await this.lockRequest(tx, exceptionReference.solicitud_id);
      const [exception] = await tx.$queryRaw<ExceptionRecord[]>`
        SELECT id, solicitud_id, dias_excedentes, estado
        FROM solicitud_excepcion
        WHERE id = ${exceptionId}::uuid
        FOR UPDATE
      `;
      if (!exception) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'La excepción solicitada no existe.',
        });
      }
      if (request.empleado_id === actor.empleadoId) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'VAC_AUTOAPROBACION',
          message: 'No puede aprobar ni resolver su propia solicitud.',
        });
      }
      if (exception.estado !== 'PENDIENTE') {
        throw stateError(
          'VAC_EXCEPCION_ESTADO_INVALIDO',
          'La excepción no admite esta transición.',
        );
      }
      if (!['PENDIENTE_JEFE', 'APROBADO_JEFE'].includes(request.estado)) {
        throw stateError(
          'VAC_EXCEPCION_ESTADO_INVALIDO',
          'La solicitud asociada ya no admite resolver su excepción.',
        );
      }

      const resolvedAt = new Date();
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE solicitud_excepcion
        SET estado = ${decision}::"EstadoExcepcion",
            resuelto_por = ${actor.empleadoId}::uuid,
            resuelto_en = ${resolvedAt},
            comentario = ${comentario?.trim() || null}
        WHERE id = ${exceptionId}::uuid
          AND estado = 'PENDIENTE'::"EstadoExcepcion"
        RETURNING id
      `;
      this.assertUpdated(updated);
      await this.recordTransition(
        tx,
        exception.solicitud_id,
        request.estado,
        request.estado,
        actor.usuarioId,
        `Excepción ${decision.toLowerCase()}${comentario?.trim() ? `: ${comentario.trim()}` : ''}`,
      );
      await this.audit(
        tx,
        actor.usuarioId,
        `VACACION_EXCEPCION_${decision}`,
        exception.solicitud_id,
        {
          excepcionId: exception.id,
          decision,
          diasExcedentes: exception.dias_excedentes,
          comentario: comentario?.trim() || null,
        },
      );

      return {
        id: exceptionId,
        estado: decision,
        resueltoPor: actor.empleadoId,
        resueltoEn: resolvedAt,
      };
    });
  }

  private async lockRequest(tx: PrismaTransactionLike, requestId: string): Promise<RequestRecord> {
    const [request] = await tx.$queryRaw<RequestRecord[]>`
      SELECT id, empleado_id, jefe_empleado_id, dias_habiles, estado
      FROM solicitud_vacacion
      WHERE id = ${requestId}::uuid
      FOR UPDATE
    `;
    if (!request) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'La solicitud no existe.',
      });
    }
    return request;
  }

  private assertNotSelf(request: RequestRecord, actor: VacationActor): void {
    if (request.empleado_id === actor.empleadoId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'VAC_AUTOAPROBACION',
        message: 'No puede aprobar ni resolver su propia solicitud.',
      });
    }
  }

  private assertPermission(actor: VacationActor, permission: string): void {
    if (!actor.permisos.includes(permission)) {
      throw new ForbiddenException('No tiene permiso para realizar esta operación.');
    }
  }

  private assertUpdated(rows: Array<{ id: string }>): void {
    if (rows.length === 0) {
      throw stateError('VAC_ESTADO_INVALIDO', 'La solicitud cambió; vuelva a consultar su estado.');
    }
  }

  private async recordTransition(
    tx: PrismaTransactionLike,
    requestId: string,
    from: RequestState,
    to: RequestState,
    actorUsuarioId: string,
    comentario?: string,
  ): Promise<void> {
    await tx.$queryRaw`
      INSERT INTO historial_solicitud (
        id, solicitud_id, desde, hacia, actor_usuario_id, comentario
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${requestId}::uuid,
        ${from}::"EstadoSolicitud",
        ${to}::"EstadoSolicitud",
        ${actorUsuarioId}::uuid,
        ${comentario?.trim() || null}
      )
      RETURNING id
    `;
  }

  private async audit(
    tx: PrismaTransactionLike,
    usuarioId: string,
    accion: string,
    solicitudId: string,
    datos: Record<string, JsonValue>,
  ): Promise<void> {
    await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
      usuarioId,
      accion,
      modulo: 'vacaciones',
      entidad: 'SolicitudVacacion',
      entidadId: solicitudId,
      datos,
    });
  }
}
