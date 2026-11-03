import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { InternalPrincipal } from '@arca/internal-auth';
import type { JsonValue } from '@arca/messaging';
import {
  EstadoExcepcion,
  EstadoSolicitud,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const managerPermission = 'vacaciones:approve_jefe';
const hrPermission = 'vacaciones:approve_rrhh';
const exceptionPermission = 'vacaciones:excepcion_resolve';
type VacationTransaction = Prisma.TransactionClient;

@Injectable()
export class VacationApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async approveByManager(
    requestId: string,
    principal: InternalPrincipal,
    comentario?: string,
  ) {
    this.requirePermission(principal, managerPermission);
    const actorId = this.requireEmployee(principal);

    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.rejectSelfApproval(request.empleadoId, actorId);
      const manager = await tx.empleadoRef.findUnique({
        where: { empleadoId: actorId },
        select: { areaId: true },
      });
      if (!manager || request.empleado.areaId !== manager.areaId) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró la solicitud en el ámbito del jefe.',
        });
      }
      if (request.empleado.jefeEmpleadoId !== actorId) {
        throw new ForbiddenException('Solo el jefe inmediato actual puede aprobar esta solicitud.');
      }
      this.requireState(request.estado, EstadoSolicitud.PENDIENTE_JEFE);
      if (request.excepcion?.estado === EstadoExcepcion.PENDIENTE) {
        throw this.exceptionPending();
      }
      if (request.excepcion?.estado === EstadoExcepcion.RECHAZADA) {
        throw this.invalidState('La excepción de esta solicitud fue rechazada.');
      }

      const approvedAt = new Date();
      const updated = await tx.solicitudVacacion.updateMany({
        where: { id: requestId, estado: EstadoSolicitud.PENDIENTE_JEFE },
        data: {
          estado: EstadoSolicitud.APROBADO_JEFE,
          aprobadoJefePor: actorId,
          aprobadoJefeEn: approvedAt,
        },
      });
      this.requireUpdated(updated.count);
      await tx.historialSolicitud.create({
        data: {
          solicitudId: requestId,
          desde: EstadoSolicitud.PENDIENTE_JEFE,
          hacia: EstadoSolicitud.APROBADO_JEFE,
          actorUsuarioId: principal.userId,
          comentario: comentario ?? null,
        },
      });
      await this.audit(tx, principal, 'VACACION_APROBAR_JEFE', 'solicitud_vacacion', requestId, {
        estadoAnterior: EstadoSolicitud.PENDIENTE_JEFE,
        estadoNuevo: EstadoSolicitud.APROBADO_JEFE,
      });

      return {
        id: requestId,
        estado: EstadoSolicitud.APROBADO_JEFE,
        aprobadoJefePor: actorId,
        aprobadoJefeEn: approvedAt,
      };
    });
  }

  async approveByHr(
    requestId: string,
    principal: InternalPrincipal,
    comentario?: string,
  ) {
    this.requirePermission(principal, hrPermission);
    if (principal.rol !== 'RRHH_OPERATIVO') {
      throw new ForbiddenException('Solo RRHH Operativo puede realizar la aprobación final.');
    }
    const actorId = this.requireEmployee(principal);

    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.rejectSelfApproval(request.empleadoId, actorId);
      this.requireState(request.estado, EstadoSolicitud.APROBADO_JEFE);
      if (request.excepcion && request.excepcion.estado !== EstadoExcepcion.APROBADA) {
        throw request.excepcion.estado === EstadoExcepcion.PENDIENTE
          ? this.exceptionPending()
          : this.invalidState('La excepción de esta solicitud no fue aprobada.');
      }

      const balances = await tx.saldoVacaciones.findMany({
        where: { empleadoId: request.empleadoId, congelado: false },
        orderBy: { gestion: 'asc' },
        select: {
          id: true,
          gestion: true,
          diasAsignados: true,
          diasExcepcion: true,
          diasTomados: true,
        },
      });
      const pending = await tx.solicitudVacacion.aggregate({
        where: {
          empleadoId: request.empleadoId,
          id: { not: requestId },
          estado: {
            in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE],
          },
        },
        _sum: { diasHabiles: true },
      });
      const otherReservations = pending._sum.diasHabiles ?? 0;
      const availableDays =
        balances.reduce(
          (total, balance) =>
            total + balance.diasAsignados + balance.diasExcepcion - balance.diasTomados,
          0,
        ) - otherReservations;
      if (request.diasHabiles > availableDays) {
        throw new ConflictException({
          code: 'VAC_SALDO_INSUFICIENTE',
          message: 'El saldo ya no cubre los días de esta solicitud.',
          details: {
            diasSolicitados: request.diasHabiles,
            diasDisponibles: Math.max(availableDays, 0),
          },
        });
      }

      let daysToDeduct = request.diasHabiles;
      const deductions: Array<{ saldoId: string; gestion: number; dias: number }> = [];
      for (const balance of balances) {
        if (daysToDeduct === 0) break;
        const available =
          balance.diasAsignados + balance.diasExcepcion - balance.diasTomados;
        const days = Math.min(daysToDeduct, available);
        if (days <= 0) continue;

        const updatedBalance = await tx.saldoVacaciones.updateMany({
          where: { id: balance.id, diasTomados: balance.diasTomados },
          data: { diasTomados: { increment: days } },
        });
        if (updatedBalance.count !== 1) {
          throw new ConflictException({
            code: 'VAC_SALDO_INSUFICIENTE',
            message: 'El saldo cambió durante la aprobación; intente nuevamente.',
          });
        }
        await tx.descuentoSaldo.create({
          data: { solicitudId: requestId, saldoId: balance.id, dias: days },
        });
        deductions.push({ saldoId: balance.id, gestion: balance.gestion, dias: days });
        daysToDeduct -= days;
      }

      if (daysToDeduct > 0) {
        throw new ConflictException({
          code: 'VAC_SALDO_INSUFICIENTE',
          message: 'El saldo ya no cubre los días de esta solicitud.',
        });
      }

      const approvedAt = new Date();
      const updatedRequest = await tx.solicitudVacacion.updateMany({
        where: { id: requestId, estado: EstadoSolicitud.APROBADO_JEFE },
        data: {
          estado: EstadoSolicitud.APROBADO_FINAL,
          aprobadoRrhhPor: actorId,
          aprobadoRrhhEn: approvedAt,
        },
      });
      this.requireUpdated(updatedRequest.count);
      await tx.historialSolicitud.create({
        data: {
          solicitudId: requestId,
          desde: EstadoSolicitud.APROBADO_JEFE,
          hacia: EstadoSolicitud.APROBADO_FINAL,
          actorUsuarioId: principal.userId,
          comentario: comentario ?? null,
        },
      });
      await this.audit(tx, principal, 'VACACION_APROBAR_RRHH', 'solicitud_vacacion', requestId, {
        estadoAnterior: EstadoSolicitud.APROBADO_JEFE,
        estadoNuevo: EstadoSolicitud.APROBADO_FINAL,
        descuentos: deductions,
      });

      return {
        id: requestId,
        estado: EstadoSolicitud.APROBADO_FINAL,
        aprobadoRrhhPor: actorId,
        aprobadoRrhhEn: approvedAt,
        descuentos: deductions,
      };
    });
  }

  async reject(
    requestId: string,
    principal: InternalPrincipal,
    motivo: string,
  ) {
    const actorId = this.requireEmployee(principal);
    const canRejectAsManager = principal.permisos.includes(managerPermission);
    const canRejectAsHr = principal.permisos.includes(hrPermission);
    if (!canRejectAsManager && !canRejectAsHr) {
      throw new ForbiddenException('No tiene permiso para rechazar esta solicitud.');
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      this.rejectSelfApproval(request.empleadoId, actorId);

      let requiredState: EstadoSolicitud;
      let action: string;
      if (request.estado === EstadoSolicitud.PENDIENTE_JEFE && canRejectAsManager) {
        if (request.empleado.jefeEmpleadoId !== actorId) {
          throw new ForbiddenException('Solo el jefe inmediato actual puede rechazar esta solicitud.');
        }
        requiredState = EstadoSolicitud.PENDIENTE_JEFE;
        action = 'VACACION_RECHAZAR_JEFE';
      } else if (request.estado === EstadoSolicitud.APROBADO_JEFE && canRejectAsHr) {
        if (principal.rol !== 'RRHH_OPERATIVO') {
          throw new ForbiddenException('Solo RRHH Operativo puede rechazar en la aprobación final.');
        }
        requiredState = EstadoSolicitud.APROBADO_JEFE;
        action = 'VACACION_RECHAZAR_RRHH';
      } else {
        throw this.invalidState();
      }

      const updated = await tx.solicitudVacacion.updateMany({
        where: { id: requestId, estado: requiredState },
        data: { estado: EstadoSolicitud.RECHAZADA, motivoRechazo: motivo },
      });
      this.requireUpdated(updated.count);
      await tx.historialSolicitud.create({
        data: {
          solicitudId: requestId,
          desde: requiredState,
          hacia: EstadoSolicitud.RECHAZADA,
          actorUsuarioId: principal.userId,
          comentario: motivo,
        },
      });
      if (request.excepcion?.estado === EstadoExcepcion.PENDIENTE) {
        await tx.solicitudExcepcion.updateMany({
          where: {
            id: request.excepcion.id,
            estado: EstadoExcepcion.PENDIENTE,
          },
          data: {
            estado: EstadoExcepcion.RECHAZADA,
            resueltoPor: actorId,
            resueltoEn: new Date(),
            comentario: `Solicitud de vacaciones rechazada: ${motivo}`,
          },
        });
      }
      await this.audit(tx, principal, action, 'solicitud_vacacion', requestId, {
        estadoAnterior: requiredState,
        estadoNuevo: EstadoSolicitud.RECHAZADA,
        motivo,
        ...(request.excepcion?.estado === EstadoExcepcion.PENDIENTE
          ? { excepcionId: request.excepcion.id, excepcionEstado: EstadoExcepcion.RECHAZADA }
          : {}),
      });
      if (request.excepcion?.estado === EstadoExcepcion.PENDIENTE) {
        await this.audit(
          tx,
          principal,
          'VACACION_EXCEPCION_CANCELAR_POR_RECHAZO',
          'solicitud_excepcion',
          request.excepcion.id,
          { estadoAnterior: EstadoExcepcion.PENDIENTE, estadoNuevo: EstadoExcepcion.RECHAZADA },
        );
      }

      return { id: requestId, estado: EstadoSolicitud.RECHAZADA };
    });
  }

  async createException(
    requestId: string,
    principal: InternalPrincipal,
    justificacion: string,
  ) {
    this.requirePermission(principal, 'vacaciones:request');
    const actorId = this.requireEmployee(principal);
    if (!justificacion.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La justificación de la excepción es obligatoria.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequest(tx, requestId);
      if (request.empleadoId !== actorId) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'La solicitud no existe en el ámbito del usuario.',
        });
      }
      this.requireState(request.estado, EstadoSolicitud.PENDIENTE_JEFE);
      if (request.excepcion) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'La solicitud ya tiene una excepción asociada.',
        });
      }

      const exception = await this.createExceptionRecord(tx, request, justificacion);
      await this.audit(
        tx,
        principal,
        'VACACION_EXCEPCION_SOLICITAR',
        'solicitud_excepcion',
        exception.id,
        { solicitudId: requestId, diasExcedentes: exception.diasExcedentes },
      );
      return exception;
    });
  }

  async resolveException(
    exceptionId: string,
    principal: InternalPrincipal,
    decision: 'APROBADA' | 'RECHAZADA',
    comentario?: string,
  ) {
    this.requirePermission(principal, exceptionPermission);
    if (!['GERENCIA', 'RRHH_OPERATIVO'].includes(principal.rol)) {
      throw new ForbiddenException('Solo Gerencia o RRHH Operativo puede resolver excepciones.');
    }
    const actorId = this.requireEmployee(principal);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.solicitudExcepcion.findUnique({
        where: { id: exceptionId },
        select: { solicitudId: true },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró la solicitud de excepción.',
        });
      }

      const request = await this.lockRequest(tx, existing.solicitudId);
      this.rejectSelfApproval(request.empleadoId, actorId);
      const exception = request.excepcion;
      if (!exception || exception.id !== exceptionId) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró la solicitud de excepción.',
        });
      }
      if (exception.estado !== EstadoExcepcion.PENDIENTE) {
        throw new ConflictException({
          code: 'VAC_EXCEPCION_ESTADO_INVALIDO',
          message: 'La excepción ya fue resuelta.',
        });
      }
      if (
        request.estado !== EstadoSolicitud.PENDIENTE_JEFE &&
        request.estado !== EstadoSolicitud.APROBADO_JEFE
      ) {
        throw this.invalidState('La solicitud asociada ya no admite resolver excepciones.');
      }

      let approvedExceptionDays = exception.diasExcedentes;
      if (decision === 'APROBADA') {
        const balances = await tx.saldoVacaciones.findMany({
          where: { empleadoId: request.empleadoId, congelado: false },
          orderBy: { gestion: 'asc' },
          select: {
            id: true,
            diasAsignados: true,
            diasExcepcion: true,
            diasTomados: true,
          },
        });
        const reservations = await tx.solicitudVacacion.aggregate({
          where: {
            empleadoId: request.empleadoId,
            id: { not: request.id },
            estado: {
              in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE],
            },
          },
          _sum: { diasHabiles: true },
        });
        const available =
          balances.reduce(
            (total, balance) =>
              total +
              balance.diasAsignados +
              balance.diasExcepcion -
              balance.diasTomados,
            0,
          ) - (reservations._sum.diasHabiles ?? 0);
        approvedExceptionDays = request.diasHabiles - available;
        if (approvedExceptionDays <= 0) {
          throw new ConflictException({
            code: 'VAC_EXCEPCION_NO_REQUERIDA',
            message: 'El saldo ya cubre la solicitud; la excepción no requiere aprobación.',
          });
        }
        const balance = balances[0];
        if (!balance) {
          throw new ConflictException({
            code: 'VAC_SALDO_INSUFICIENTE',
            message: 'No hay un saldo activo para aplicar la excepción aprobada.',
          });
        }
        await tx.saldoVacaciones.update({
          where: { id: balance.id },
          data: { diasExcepcion: { increment: approvedExceptionDays } },
        });
      } else {
        const updatedRequest = await tx.solicitudVacacion.updateMany({
          where: {
            id: request.id,
            estado: { in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE] },
          },
          data: {
            estado: EstadoSolicitud.RECHAZADA,
            motivoRechazo: comentario ?? 'La solicitud de excepción fue rechazada.',
          },
        });
        this.requireUpdated(updatedRequest.count);
        await tx.historialSolicitud.create({
          data: {
            solicitudId: request.id,
            desde: request.estado,
            hacia: EstadoSolicitud.RECHAZADA,
            actorUsuarioId: principal.userId,
            comentario: comentario ?? 'La solicitud de excepción fue rechazada.',
          },
        });
      }

      const resolvedAt = new Date();
      const updatedException = await tx.solicitudExcepcion.updateMany({
        where: { id: exceptionId, estado: EstadoExcepcion.PENDIENTE },
        data: {
          estado: decision,
          ...(decision === 'APROBADA'
            ? { diasExcedentes: approvedExceptionDays }
            : {}),
          resueltoPor: actorId,
          resueltoEn: resolvedAt,
          comentario: comentario ?? null,
        },
      });
      this.requireUpdated(updatedException.count);
      await this.audit(
        tx,
        principal,
        'VACACION_EXCEPCION_RESOLVER',
        'solicitud_excepcion',
        exceptionId,
        { estadoAnterior: EstadoExcepcion.PENDIENTE, estadoNuevo: decision },
      );

      return {
        id: exceptionId,
        estado: decision,
        resueltoPor: actorId,
        resueltoEn: resolvedAt,
      };
    });
  }

  private async createExceptionRecord(
    tx: VacationTransaction,
    request: Awaited<ReturnType<VacationApprovalService['lockRequest']>>,
    justification: string,
  ) {
    const pending = await tx.solicitudVacacion.aggregate({
      where: {
        empleadoId: request.empleadoId,
        id: { not: request.id },
        estado: { in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE] },
      },
      _sum: { diasHabiles: true },
    });
    const balances = await tx.saldoVacaciones.findMany({
      where: { empleadoId: request.empleadoId, congelado: false },
      select: { diasAsignados: true, diasExcepcion: true, diasTomados: true },
    });
    const available =
      balances.reduce(
        (total, row) =>
          total + row.diasAsignados + row.diasExcepcion - row.diasTomados,
        0,
      ) - (pending._sum.diasHabiles ?? 0);
    const excess = request.diasHabiles - available;
    if (excess <= 0) {
      throw new ConflictException({
        code: 'VAC_EXCEPCION_NO_REQUERIDA',
        message: 'El saldo disponible cubre esta solicitud; no requiere excepción.',
      });
    }

    return tx.solicitudExcepcion.create({
      data: {
        solicitudId: request.id,
        diasExcedentes: excess,
        justificacion: justification,
        estado: EstadoExcepcion.PENDIENTE,
      },
    });
  }

  private async lockRequest(
    tx: VacationTransaction,
    requestId: string,
  ) {
    const existing = await tx.solicitudVacacion.findUnique({
      where: { id: requestId },
      select: { empleadoId: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontró la solicitud de vacaciones.',
      });
    }
    const employees = await tx.$queryRaw<Array<{ empleado_id: string }>>`
      SELECT empleado_id FROM empleado_ref
      WHERE empleado_id = ${existing.empleadoId}::uuid
      FOR UPDATE
    `;
    if (employees.length === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontró el funcionario de la solicitud.',
      });
    }
    await tx.$queryRaw`
      SELECT id FROM solicitud_vacacion
      WHERE id = ${requestId}::uuid
      FOR UPDATE
    `;
    const request = await tx.solicitudVacacion.findUnique({
      where: { id: requestId },
      include: { empleado: true, excepcion: true },
    });
    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontró la solicitud de vacaciones.',
      });
    }
    return request;
  }

  private requirePermission(principal: InternalPrincipal, permission: string): void {
    if (!principal.permisos.includes(permission)) {
      throw new ForbiddenException('No tiene permiso para realizar esta operación.');
    }
  }

  private requireEmployee(principal: InternalPrincipal): string {
    if (!principal.empleadoId) {
      throw new ForbiddenException('El usuario autenticado no tiene un funcionario asociado.');
    }
    return principal.empleadoId;
  }

  private rejectSelfApproval(employeeId: string, actorId: string): void {
    if (employeeId === actorId) {
      throw new ForbiddenException({
        code: 'VAC_AUTOAPROBACION',
        message: 'No puede aprobar ni resolver su propia solicitud.',
      });
    }
  }

  private requireState(actual: EstadoSolicitud, expected: EstadoSolicitud): void {
    if (actual !== expected) {
      throw this.invalidState();
    }
  }

  private requireUpdated(count: number): void {
    if (count !== 1) {
      throw this.invalidState();
    }
  }

  private invalidState(message = 'La solicitud no admite esta transición.') {
    return new ConflictException({
      code: 'VAC_ESTADO_INVALIDO',
      message,
    });
  }

  private exceptionPending() {
    return new ConflictException({
      code: 'VAC_EXCEPCION_PENDIENTE',
      message: 'La solicitud debe esperar la resolución de su excepción.',
    });
  }

  private async audit(
    tx: VacationTransaction,
    principal: InternalPrincipal,
    action: string,
    entity: string,
    entityId: string,
    data: Record<string, JsonValue>,
  ): Promise<void> {
    await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
      usuarioId: principal.userId,
      accion: action,
      modulo: 'vacaciones',
      entidad: entity,
      entidadId: entityId,
      datos: data,
    });
  }
}
