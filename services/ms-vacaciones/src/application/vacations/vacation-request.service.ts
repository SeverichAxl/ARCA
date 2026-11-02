import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OutboxService } from '@arca/messaging';
import type { PrismaTransactionLike } from '@arca/messaging';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  completedServiceYears,
  isVacationEligible,
  parsePositiveIntegerConfiguration,
} from './vacation-eligibility';

interface EmployeeRecord {
  empleado_id: string;
  area_id: string;
  jefe_empleado_id: string | null;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fecha_ingreso: Date;
}

interface BalanceRecord {
  dias_asignados: number;
  dias_tomados: number;
}

interface HolidayRecord {
  fecha: Date;
}

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VAC_FECHAS_INVALIDAS',
      message: 'El rango de fechas no es válido.',
    });
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VAC_FECHAS_INVALIDAS',
      message: 'El rango de fechas no es válido.',
    });
  }
  return date;
}

export function countBusinessDays(start: Date, end: Date, holidays: Date[]): number {
  const holidayKeys = new Set(holidays.map((date) => date.toISOString().slice(0, 10)));
  let count = 0;

  for (
    const date = new Date(start);
    date.getTime() <= end.getTime();
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    if (!isWeekend && !holidayKeys.has(date.toISOString().slice(0, 10))) {
      count += 1;
    }
  }

  return count;
}

function vacationError(
  code: string,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): ConflictException {
  return new ConflictException({
    statusCode,
    code,
    message,
    ...(details ? { details } : {}),
  });
}

@Injectable()
export class VacationRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(
    empleadoId: string,
    actorUsuarioId: string,
    fechaInicio: string,
    fechaFin: string,
    solicitarExcepcion: boolean,
    justificacionExcepcion?: string,
  ) {
    const start = parseDateOnly(fechaInicio);
    const end = parseDateOnly(fechaFin);
    if (end < start) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VAC_FECHAS_INVALIDAS',
        message: 'El rango de fechas no es válido.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const [employee] = await tx.$queryRaw<EmployeeRecord[]>`
        SELECT empleado_id, area_id, jefe_empleado_id, estado, fecha_ingreso
        FROM empleado_ref
        WHERE empleado_id = ${empleadoId}::uuid
        FOR UPDATE
      `;
      if (!employee) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'El funcionario no existe o no está sincronizado.',
        });
      }

      if (!isVacationEligible(employee.estado, employee.fecha_ingreso, new Date())) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'VAC_NO_ELEGIBLE',
          message: 'El funcionario todavía no es elegible para vacaciones.',
        });
      }
      if (!employee.jefe_empleado_id || employee.jefe_empleado_id === empleadoId) {
        throw vacationError(
          'VAC_JEFE_NO_ASIGNADO',
          409,
          'El funcionario no tiene un jefe inmediato distinto asignado.',
        );
      }

      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${empleadoId}, 0))
      `;

      const [daysPerManagementConfiguration] = await tx.$queryRaw<Array<{ valor: string }>>`
        SELECT valor
        FROM configuracion_vacaciones
        WHERE clave = 'DIAS_POR_GESTION'
      `;
      if (!daysPerManagementConfiguration) {
        throw new Error('No existe la configuración DIAS_POR_GESTION.');
      }
      const daysPerManagement = parsePositiveIntegerConfiguration(
        'DIAS_POR_GESTION',
        daysPerManagementConfiguration.valor,
      );

      const completedYears = completedServiceYears(employee.fecha_ingreso, new Date());
      for (let management = 1; management <= completedYears; management += 1) {
        await tx.$queryRaw`
          INSERT INTO saldo_vacaciones (id, empleado_id, gestion, dias_asignados)
          VALUES (
            ${randomUUID()}::uuid,
            ${empleadoId}::uuid,
            ${management},
            ${daysPerManagement}
          )
          ON CONFLICT (empleado_id, gestion) DO NOTHING
          RETURNING id
        `;
      }

      const holidayRows = await tx.$queryRaw<HolidayRecord[]>`
        SELECT fecha
        FROM feriado
        WHERE ambito = 'NACIONAL'::"AmbitoFeriado"
          AND departamento = ''
          AND fecha BETWEEN ${start}::date AND ${end}::date
      `;
      const businessDays = countBusinessDays(
        start,
        end,
        holidayRows.map((holiday) => holiday.fecha),
      );
      if (businessDays === 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VAC_FECHAS_INVALIDAS',
          message: 'El rango no contiene días hábiles.',
        });
      }

      const [overlappingRequest] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM solicitud_vacacion
        WHERE empleado_id = ${empleadoId}::uuid
          AND estado NOT IN (
            'RECHAZADA'::"EstadoSolicitud",
            'CANCELADA'::"EstadoSolicitud"
          )
          AND fecha_inicio <= ${end}::date
          AND fecha_fin >= ${start}::date
        LIMIT 1
      `;
      const [overlappingLeave] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM licencia
        WHERE empleado_id = ${empleadoId}::uuid
          AND estado IN (
            'PENDIENTE'::"EstadoLicencia",
            'AUTORIZADA'::"EstadoLicencia"
          )
          AND fecha_inicio <= ${end}::date
          AND fecha_fin >= ${start}::date
        LIMIT 1
      `;
      if (overlappingRequest || overlappingLeave) {
        throw vacationError(
          'VAC_TRASLAPE',
          409,
          'El rango solicitado se traslapa con otra gestión.',
        );
      }

      const balances = await tx.$queryRaw<BalanceRecord[]>`
        SELECT dias_asignados, dias_tomados
        FROM saldo_vacaciones
        WHERE empleado_id = ${empleadoId}::uuid
          AND congelado = FALSE
      `;
      const availableDays = balances.reduce(
        (total, balance) => total + balance.dias_asignados - balance.dias_tomados,
        0,
      );
      const [reservedDays] = await tx.$queryRaw<Array<{ dias: number }>>`
        SELECT COALESCE(SUM(dias_habiles), 0)::int AS dias
        FROM solicitud_vacacion
        WHERE empleado_id = ${empleadoId}::uuid
          AND estado IN (
            'PENDIENTE_JEFE'::"EstadoSolicitud",
            'APROBADO_JEFE'::"EstadoSolicitud"
          )
      `;
      const remainingDays = availableDays - (reservedDays?.dias ?? 0);
      const exceedsBalance = businessDays > remainingDays;
      const normalizedJustification = justificacionExcepcion?.trim();
      if (exceedsBalance && !solicitarExcepcion) {
        throw vacationError(
          'VAC_SALDO_INSUFICIENTE',
          409,
          'El saldo disponible no cubre los días solicitados.',
          { diasDisponibles: Math.max(remainingDays, 0), excepcionDisponible: true },
        );
      }
      if (exceedsBalance && !normalizedJustification) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'La justificación es obligatoria para solicitar una excepción.',
          details: { fields: { justificacionExcepcion: 'Campo obligatorio.' } },
        });
      }

      const solicitudId = randomUUID();
      await tx.$queryRaw`
        INSERT INTO solicitud_vacacion (
          id, empleado_id, fecha_inicio, fecha_fin, dias_habiles,
          estado, jefe_empleado_id, creado_en, actualizado_en
        )
        VALUES (
          ${solicitudId}::uuid,
          ${empleadoId}::uuid,
          ${start}::date,
          ${end}::date,
          ${businessDays},
          'PENDIENTE_JEFE'::"EstadoSolicitud",
          ${employee.jefe_empleado_id}::uuid,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
      let exception: { id: string; diasExcedentes: number; estado: 'PENDIENTE' } | undefined;
      if (exceedsBalance) {
        const exceptionId = randomUUID();
        const excessDays = businessDays - Math.max(remainingDays, 0);
        await tx.$queryRaw`
          INSERT INTO solicitud_excepcion (
            id, solicitud_id, dias_excedentes, justificacion, estado, creado_en
          )
          VALUES (
            ${exceptionId}::uuid,
            ${solicitudId}::uuid,
            ${excessDays},
            ${normalizedJustification},
            'PENDIENTE'::"EstadoExcepcion",
            CURRENT_TIMESTAMP
          )
          RETURNING id
        `;
        exception = {
          id: exceptionId,
          diasExcedentes: excessDays,
          estado: 'PENDIENTE',
        };
      }
      await tx.$queryRaw`
        INSERT INTO historial_solicitud (
          id, solicitud_id, desde, hacia, actor_usuario_id, comentario
        )
        VALUES (
          ${randomUUID()}::uuid,
          ${solicitudId}::uuid,
          NULL,
          'PENDIENTE_JEFE'::"EstadoSolicitud",
          ${actorUsuarioId}::uuid,
          'Solicitud de vacaciones registrada'
        )
        RETURNING id
      `;
      await this.auditRequest(
        tx,
        actorUsuarioId,
        solicitudId,
        fechaInicio,
        fechaFin,
        businessDays,
        exception?.diasExcedentes,
      );

      return {
        id: solicitudId,
        empleadoId,
        fechaInicio,
        fechaFin,
        diasHabiles: businessDays,
        estado: 'PENDIENTE_JEFE' as const,
        jefeEmpleadoId: employee.jefe_empleado_id,
        ...(exception ? { excepcion: exception } : {}),
      };
    });
  }

  private async auditRequest(
    tx: PrismaTransactionLike,
    actorUsuarioId: string,
    solicitudId: string,
    fechaInicio: string,
    fechaFin: string,
    diasHabiles: number,
    diasExcedentes?: number,
  ): Promise<void> {
    await this.outbox.add(tx, 'AUDITORIA_REGISTRADA', {
      usuarioId: actorUsuarioId,
      accion: 'VACACION_SOLICITAR',
      modulo: 'vacaciones',
      entidad: 'SolicitudVacacion',
      entidadId: solicitudId,
      datos: {
        fechaInicio,
        fechaFin,
        diasHabiles,
        estado: 'PENDIENTE_JEFE',
        ...(diasExcedentes === undefined ? {} : { diasExcedentes }),
      },
    });
  }
}
