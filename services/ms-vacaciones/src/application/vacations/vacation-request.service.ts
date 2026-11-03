import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoLicencia, EstadoSolicitud } from '../../../prisma/generated/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { synchronizeVacationBalances } from './vacation-balance.sync';
import { isVacationEligible } from './vacation-eligibility';
import { countBusinessDays, parseDateOnly } from './vacation-dates';

@Injectable()
export class VacationRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    empleadoId: string | null,
    actorUserId: string,
    fechaInicio: string,
    fechaFin: string,
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
        select: { diasAsignados: true, diasTomados: true },
      });
      const availableDays = balances.reduce(
        (total, balance) => total + balance.diasAsignados - balance.diasTomados,
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
      if (businessDays > availableDays - reservedDays) {
        throw new ConflictException({
          code: 'VAC_SALDO_INSUFICIENTE',
          message: 'El saldo disponible no cubre los días hábiles solicitados.',
          details: {
            diasSolicitados: businessDays,
            diasDisponibles: Math.max(availableDays - reservedDays, 0),
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

      return request;
    });
  }
}
