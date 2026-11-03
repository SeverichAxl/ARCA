import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { InternalPrincipal } from '@arca/internal-auth';
import {
  EstadoExcepcion,
  EstadoLicencia,
  EstadoSolicitud,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { synchronizeVacationBalances } from './vacation-balance.sync';
import { isVacationEligible } from './vacation-eligibility';
import { countBusinessDays, parseDateOnly } from './vacation-dates';
import type { VacationRequestQueryDto } from './vacation-request-query.dto';

@Injectable()
export class VacationRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(principal: InternalPrincipal, query: VacationRequestQueryDto) {
    const employeeId = this.requireEmployee(principal);
    const filters: Prisma.SolicitudVacacionWhereInput[] = [];

    if (query.desde) filters.push({ fechaFin: { gte: parseDateOnly(query.desde) } });
    if (query.hasta) filters.push({ fechaInicio: { lte: parseDateOnly(query.hasta) } });
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La fecha desde debe ser igual o anterior a la fecha hasta.',
      });
    }

    let scope: Prisma.SolicitudVacacionWhereInput = {};
    switch (query.vista) {
      case 'propias':
        this.requirePermission(principal, 'vacaciones:read_own');
        scope = { empleadoId: employeeId };
        break;
      case 'bandeja-jefe': {
        this.requirePermission(principal, 'vacaciones:approve_jefe');
        const manager = await this.prisma.empleadoRef.findUnique({
          where: { empleadoId: employeeId },
          select: { areaId: true },
        });
        if (!manager) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'No se encontró el funcionario autenticado.',
          });
        }
        scope = {
          jefeEmpleadoId: employeeId,
          empleado: { areaId: manager.areaId },
        };
        break;
      }
      case 'bandeja-rrhh':
        this.requirePermission(principal, 'vacaciones:approve_rrhh');
        if (principal.rol !== 'RRHH_OPERATIVO') {
          throw new ForbiddenException('Solo RRHH Operativo puede consultar esta bandeja.');
        }
        if (query.estado && query.estado !== EstadoSolicitud.APROBADO_JEFE) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'La bandeja de RRHH solo admite solicitudes aprobadas por el jefe.',
          });
        }
        scope = {
          estado: EstadoSolicitud.APROBADO_JEFE,
          empleadoId: { not: employeeId },
        };
        break;
    }

    const where: Prisma.SolicitudVacacionWhereInput = {
      ...scope,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(filters.length ? { AND: filters } : {}),
    };
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    return this.prisma.$transaction(async (tx) => {
      const [data, total] = await Promise.all([
        tx.solicitudVacacion.findMany({
          where,
          orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
          skip: (pagina - 1) * limite,
          take: limite,
          include: {
            empleado: { select: { nombreCompleto: true, areaId: true } },
            excepcion: true,
          },
        }),
        tx.solicitudVacacion.count({ where }),
      ]);
      return {
        data,
        meta: {
          pagina,
          limite,
          total,
          paginas: Math.ceil(total / limite),
        },
      };
    });
  }

  async getById(requestId: string, principal: InternalPrincipal) {
    const request = await this.prisma.solicitudVacacion.findUnique({
      where: { id: requestId },
      include: {
        empleado: { select: { areaId: true } },
        historial: { orderBy: { creadoEn: 'asc' } },
        excepcion: true,
      },
    });
    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontró la solicitud de vacaciones.',
      });
    }

    const employeeId = principal.empleadoId;
    const canReadOwn =
      employeeId !== null &&
      request.empleadoId === employeeId &&
      principal.permisos.includes('vacaciones:read_own');
    const canReadAll = principal.permisos.includes('vacaciones:read_all');
    let canReadArea = false;
    if (employeeId && principal.permisos.includes('vacaciones:read_area')) {
      const viewer = await this.prisma.empleadoRef.findUnique({
        where: { empleadoId: employeeId },
        select: { areaId: true },
      });
      canReadArea = viewer?.areaId === request.empleado.areaId;
    }
    if (!canReadOwn && !canReadAll && !canReadArea) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontró la solicitud en el ámbito del usuario.',
      });
    }
    return request;
  }

  async cancel(
    requestId: string,
    principal: InternalPrincipal,
    motivo?: string,
  ) {
    this.requirePermission(principal, 'vacaciones:request');
    const employeeId = this.requireEmployee(principal);

    return this.prisma.$transaction(async (tx) => {
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

      await tx.$queryRaw`
        SELECT empleado_id FROM empleado_ref
        WHERE empleado_id = ${existing.empleadoId}::uuid
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT id FROM solicitud_vacacion
        WHERE id = ${requestId}::uuid
        FOR UPDATE
      `;
      const request = await tx.solicitudVacacion.findUnique({
        where: { id: requestId },
        include: { excepcion: true },
      });
      if (!request || request.empleadoId !== employeeId) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró la solicitud en el ámbito del usuario.',
        });
      }
      if (
        request.estado !== EstadoSolicitud.PENDIENTE_JEFE &&
        request.estado !== EstadoSolicitud.APROBADO_JEFE
      ) {
        throw new ConflictException({
          code: 'VAC_ESTADO_INVALIDO',
          message: 'Solo se pueden cancelar solicitudes antes de la aprobación final.',
        });
      }

      const canceledAt = new Date();
      const updated = await tx.solicitudVacacion.updateMany({
        where: { id: requestId, estado: request.estado },
        data: { estado: EstadoSolicitud.CANCELADA },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'VAC_ESTADO_INVALIDO',
          message: 'La solicitud cambió de estado y ya no puede cancelarse.',
        });
      }

      if (request.excepcion?.estado === EstadoExcepcion.PENDIENTE) {
        const canceledException = await tx.solicitudExcepcion.updateMany({
          where: {
            id: request.excepcion.id,
            estado: EstadoExcepcion.PENDIENTE,
          },
          data: {
            estado: EstadoExcepcion.RECHAZADA,
            resueltoEn: canceledAt,
            comentario: 'La solicitud de vacaciones fue cancelada.',
          },
        });
        if (canceledException.count !== 1) {
          throw new ConflictException({
            code: 'VAC_EXCEPCION_ESTADO_INVALIDO',
            message: 'La excepción cambió de estado y no pudo cancelarse.',
          });
        }
        await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
          usuarioId: principal.userId,
          accion: 'VACACION_EXCEPCION_CANCELAR_POR_CANCELACION',
          modulo: 'vacaciones',
          entidad: 'solicitud_excepcion',
          entidadId: request.excepcion.id,
          datos: {
            estadoAnterior: EstadoExcepcion.PENDIENTE,
            estadoNuevo: EstadoExcepcion.RECHAZADA,
            solicitudId: requestId,
          },
        });
      }

      await tx.historialSolicitud.create({
        data: {
          solicitudId: requestId,
          desde: request.estado,
          hacia: EstadoSolicitud.CANCELADA,
          actorUsuarioId: principal.userId,
          comentario: motivo?.trim() || 'Solicitud cancelada por el funcionario.',
        },
      });
      await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
        usuarioId: principal.userId,
        accion: 'VACACION_CANCELAR',
        modulo: 'vacaciones',
        entidad: 'solicitud_vacacion',
        entidadId: requestId,
        datos: {
          estadoAnterior: request.estado,
          estadoNuevo: EstadoSolicitud.CANCELADA,
          motivo: motivo?.trim() || null,
        },
      });
      return { id: requestId, estado: EstadoSolicitud.CANCELADA };
    });
  }

  async create(
    empleadoId: string | null,
    actorUserId: string,
    fechaInicio: string,
    fechaFin: string,
    solicitarExcepcion = false,
    justificacionExcepcion?: string,
  ) {
    if (!empleadoId) {
      throw new ForbiddenException('El usuario autenticado no tiene un funcionario asociado.');
    }

    let start: Date;
    let end: Date;
    try {
      start = parseDateOnly(fechaInicio);
      end = parseDateOnly(fechaFin);
    } catch (error) {
      throw new UnprocessableEntityException({
        code: 'VAC_FECHAS_INVALIDAS',
        message: error instanceof Error ? error.message : 'El rango de fechas no es válido.',
      });
    }

    if (end < start) {
      throw new UnprocessableEntityException({
        code: 'VAC_FECHAS_INVALIDAS',
        message: 'La fecha fin debe ser igual o posterior a la fecha inicio.',
      });
    }
    const exceptionJustification = justificacionExcepcion?.trim();
    if (solicitarExcepcion && !exceptionJustification) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La justificación es obligatoria para solicitar una excepción.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Serializa solicitudes simultáneas del mismo funcionario antes de revisar su saldo.
      const employees = await tx.$queryRaw<Array<{ empleado_id: string }>>`
        SELECT empleado_id
        FROM empleado_ref
        WHERE empleado_id = ${empleadoId}::uuid
        FOR UPDATE
      `;
      if (employees.length === 0) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró el funcionario autenticado.',
        });
      }

      const employee = await tx.empleadoRef.findUnique({ where: { empleadoId } });
      if (!employee) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'No se encontró el funcionario autenticado.',
        });
      }

      const asOf = new Date();
      if (!isVacationEligible(employee, asOf)) {
        throw new UnprocessableEntityException({
          code: 'VAC_NO_ELEGIBLE',
          message: 'El funcionario debe estar ratificado y tener al menos un año completo.',
        });
      }
      if (!employee.jefeEmpleadoId) {
        throw new ConflictException({
          code: 'VAC_JEFE_NO_ASIGNADO',
          message: 'El funcionario no tiene un jefe inmediato asignado.',
        });
      }

      await synchronizeVacationBalances(
        tx,
        {
          empleadoId: employee.empleadoId,
          estado: employee.estado,
          fechaIngreso: employee.fechaIngreso,
        },
        asOf,
      );

      const holidays = await tx.feriado.findMany({
        where: {
          fecha: { gte: start, lte: end },
          ambito: 'NACIONAL',
        },
        select: { fecha: true },
      });
      const businessDays = countBusinessDays(
        start,
        end,
        holidays.map(({ fecha }) => fecha),
      );
      if (businessDays === 0) {
        throw new UnprocessableEntityException({
          code: 'VAC_DIAS_HABILES_INVALIDOS',
          message: 'El rango debe incluir al menos un día hábil que no sea feriado.',
        });
      }

      const activeRequests = [
        EstadoSolicitud.PENDIENTE_JEFE,
        EstadoSolicitud.APROBADO_JEFE,
        EstadoSolicitud.APROBADO_FINAL,
      ];
      const overlappingRequest = await tx.solicitudVacacion.findFirst({
        where: {
          empleadoId,
          estado: { in: activeRequests },
          fechaInicio: { lte: end },
          fechaFin: { gte: start },
        },
        select: { id: true },
      });
      const overlappingLeave = await tx.licencia.findFirst({
        where: {
          empleadoId,
          estado: { in: [EstadoLicencia.PENDIENTE, EstadoLicencia.AUTORIZADA] },
          fechaInicio: { lte: end },
          fechaFin: { gte: start },
        },
        select: { id: true },
      });
      if (overlappingRequest || overlappingLeave) {
        throw new ConflictException({
          code: 'VAC_TRASLAPE',
          message: 'El rango solicitado se traslapa con otra solicitud o licencia.',
        });
      }

      const balances = await tx.saldoVacaciones.findMany({
        where: { empleadoId, congelado: false },
        select: { diasAsignados: true, diasExcepcion: true, diasTomados: true },
      });
      const availableDays = balances.reduce(
        (total, balance) =>
          total + balance.diasAsignados + balance.diasExcepcion - balance.diasTomados,
        0,
      );
      const pendingRequests = await tx.solicitudVacacion.aggregate({
        where: {
          empleadoId,
          estado: { in: [EstadoSolicitud.PENDIENTE_JEFE, EstadoSolicitud.APROBADO_JEFE] },
        },
        _sum: { diasHabiles: true },
      });
      const reservedDays = pendingRequests._sum.diasHabiles ?? 0;
      const excessDays = businessDays - (availableDays - reservedDays);
      if (excessDays > 0 && !solicitarExcepcion) {
        throw new ConflictException({
          code: 'VAC_SALDO_INSUFICIENTE',
          message: 'El saldo disponible no cubre los días hábiles solicitados.',
          details: {
            diasSolicitados: businessDays,
            diasDisponibles: Math.max(availableDays - reservedDays, 0),
            excepcionDisponible: true,
          },
        });
      }

      const request = await tx.solicitudVacacion.create({
        data: {
          empleadoId,
          fechaInicio: start,
          fechaFin: end,
          diasHabiles: businessDays,
          jefeEmpleadoId: employee.jefeEmpleadoId,
          estado: EstadoSolicitud.PENDIENTE_JEFE,
        },
      });
      await tx.historialSolicitud.create({
        data: {
          solicitudId: request.id,
          desde: null,
          hacia: EstadoSolicitud.PENDIENTE_JEFE,
          actorUsuarioId: actorUserId,
          comentario: 'Solicitud creada.',
        },
      });

      let exception:
        | Awaited<ReturnType<typeof tx.solicitudExcepcion.create>>
        | undefined;
      if (excessDays > 0) {
        exception = await tx.solicitudExcepcion.create({
          data: {
            solicitudId: request.id,
            diasExcedentes: excessDays,
            justificacion: exceptionJustification ?? '',
            estado: 'PENDIENTE',
          },
        });
      }
      await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
        usuarioId: actorUserId,
        accion: 'VACACION_SOLICITAR',
        modulo: 'vacaciones',
        entidad: 'solicitud_vacacion',
        entidadId: request.id,
        datos: {
          estadoNuevo: EstadoSolicitud.PENDIENTE_JEFE,
          diasHabiles: businessDays,
          ...(exception ? { excepcionId: exception.id, diasExcedentes: excessDays } : {}),
        },
      });
      if (exception) {
        await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
          usuarioId: actorUserId,
          accion: 'VACACION_EXCEPCION_SOLICITAR',
          modulo: 'vacaciones',
          entidad: 'solicitud_excepcion',
          entidadId: exception.id,
          datos: {
            solicitudId: request.id,
            estadoNuevo: 'PENDIENTE',
            diasExcedentes: excessDays,
          },
        });
      }

      return exception ? { ...request, excepcion: exception } : request;
    });
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
}
