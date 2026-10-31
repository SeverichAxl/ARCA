import type {
  EventEnvelope,
  EventHandler,
  PrismaTransactionLike,
} from '@arca/messaging';

interface EmployeeEventPayload {
  empleadoId: string;
  nombreCompleto: string;
  areaId: string;
  jefeEmpleadoId: string | null;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: string;
  fechaBaja: string | null;
}

interface AreaUpdatedPayload {
  areaId: string;
  nombre: string;
  padreId: string | null;
  jefeEmpleadoId: string | null;
}

const employeeStates = ['EN_PRUEBA', 'RATIFICADO', 'INACTIVO'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function employeePayload(value: unknown): EmployeeEventPayload {
  if (
    !isRecord(value) ||
    typeof value.empleadoId !== 'string' ||
    typeof value.nombreCompleto !== 'string' ||
    typeof value.areaId !== 'string' ||
    (value.jefeEmpleadoId !== null && typeof value.jefeEmpleadoId !== 'string') ||
    typeof value.estado !== 'string' ||
    !employeeStates.includes(value.estado as (typeof employeeStates)[number]) ||
    typeof value.fechaIngreso !== 'string' ||
    (value.fechaBaja !== null && typeof value.fechaBaja !== 'string')
  ) {
    throw new Error('El payload de empleado no cumple el contrato.');
  }
  return {
    empleadoId: value.empleadoId as string,
    nombreCompleto: value.nombreCompleto as string,
    areaId: value.areaId as string,
    jefeEmpleadoId: value.jefeEmpleadoId as string | null,
    estado: value.estado as EmployeeEventPayload['estado'],
    fechaIngreso: value.fechaIngreso as string,
    fechaBaja: value.fechaBaja as string | null,
  };
}

function areaPayload(value: unknown): AreaUpdatedPayload {
  if (
    !isRecord(value) ||
    typeof value.areaId !== 'string' ||
    typeof value.nombre !== 'string' ||
    (value.padreId !== null && typeof value.padreId !== 'string') ||
    (value.jefeEmpleadoId !== null && typeof value.jefeEmpleadoId !== 'string')
  ) {
    throw new Error('El payload AREA_ACTUALIZADA no cumple el contrato.');
  }
  return {
    areaId: value.areaId as string,
    nombre: value.nombre as string,
    padreId: value.padreId as string | null,
    jefeEmpleadoId: value.jefeEmpleadoId as string | null,
  };
}

export const consumePersonalEvent: EventHandler = async (
  tx: PrismaTransactionLike,
  envelope: EventEnvelope,
): Promise<void> => {
  const occurredOn = new Date(envelope.occurredOn);
  if (Number.isNaN(occurredOn.getTime())) {
    throw new Error('occurredOn no contiene una fecha ISO válida.');
  }

  if (envelope.eventName === 'AREA_ACTUALIZADA') {
    const area = areaPayload(envelope.payload);
    await tx.$queryRaw`
      UPDATE empleado_ref
      SET jefe_empleado_id = ${area.jefeEmpleadoId}::uuid,
          ultimo_evento_en = ${occurredOn},
          actualizado_en = CURRENT_TIMESTAMP
      WHERE area_id = ${area.areaId}::uuid
        AND ultimo_evento_en <= ${occurredOn}
      RETURNING empleado_id
    `;
    return;
  }

  if (
    envelope.eventName !== 'EMPLEADO_CREADO' &&
    envelope.eventName !== 'EMPLEADO_MODIFICADO' &&
    envelope.eventName !== 'EMPLEADO_DADO_DE_BAJA'
  ) {
    throw new Error(`Evento personal no soportado: ${envelope.eventName}.`);
  }

  const employee = employeePayload(envelope.payload);
  if (envelope.eventName === 'EMPLEADO_DADO_DE_BAJA' && employee.estado !== 'INACTIVO') {
    throw new Error('EMPLEADO_DADO_DE_BAJA debe llevar estado INACTIVO.');
  }

  await tx.$queryRaw`
    INSERT INTO empleado_ref (
      empleado_id, nombre_completo, area_id, jefe_empleado_id,
      estado, fecha_ingreso, fecha_baja, ultimo_evento_en, actualizado_en
    )
    VALUES (
      ${employee.empleadoId}::uuid, ${employee.nombreCompleto},
      ${employee.areaId}::uuid, ${employee.jefeEmpleadoId}::uuid,
      ${employee.estado}::"EstadoEmpleadoRef", ${employee.fechaIngreso}::date,
      ${employee.fechaBaja}::date, ${occurredOn}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (empleado_id) DO UPDATE SET
      nombre_completo = EXCLUDED.nombre_completo,
      area_id = EXCLUDED.area_id,
      jefe_empleado_id = EXCLUDED.jefe_empleado_id,
      estado = EXCLUDED.estado,
      fecha_ingreso = EXCLUDED.fecha_ingreso,
      fecha_baja = EXCLUDED.fecha_baja,
      ultimo_evento_en = EXCLUDED.ultimo_evento_en,
      actualizado_en = CURRENT_TIMESTAMP
    WHERE EXCLUDED.ultimo_evento_en >= empleado_ref.ultimo_evento_en
    RETURNING empleado_id
  `;
};
