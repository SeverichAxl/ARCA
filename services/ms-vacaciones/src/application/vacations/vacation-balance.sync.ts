import { randomUUID } from 'node:crypto';
import type { PrismaTransactionLike } from '@arca/messaging';
import { completedYearsOfService } from './vacation-eligibility';

interface EmployeeForBalanceSync {
  empleadoId: string;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: Date | string;
}

export async function synchronizeVacationBalances(
  tx: PrismaTransactionLike,
  employee: EmployeeForBalanceSync,
  asOf = new Date(),
): Promise<void> {
  if (employee.estado !== 'RATIFICADO') {
    return;
  }

  const completedYears = completedYearsOfService(employee.fechaIngreso, asOf);
  if (completedYears < 1) {
    return;
  }

  const settings = await tx.$queryRaw<Array<{ clave: string; valor: string }>>`
    SELECT clave, valor
    FROM configuracion_vacaciones
    WHERE clave IN ('DIAS_POR_GESTION', 'MAX_GESTIONES_ACUMULADAS')
  `;
  const configuration = new Map(settings.map(({ clave, valor }) => [clave, Number(valor)]));
  const daysPerManagement = configuration.get('DIAS_POR_GESTION');
  const maximumPendingManagements = configuration.get('MAX_GESTIONES_ACUMULADAS');
  if (
    !Number.isInteger(daysPerManagement) ||
    (daysPerManagement ?? 0) < 1 ||
    !Number.isInteger(maximumPendingManagements) ||
    (maximumPendingManagements ?? 0) < 1
  ) {
    throw new Error(
      'La configuración de días por gestión o máximo de gestiones acumuladas es inválida.',
    );
  }
  const configuredDays = daysPerManagement ?? 0;
  const configuredMaximum = maximumPendingManagements ?? 0;

  const pending = await tx.$queryRaw<Array<{ cantidad: number }>>`
    SELECT COUNT(*)::int AS cantidad
    FROM saldo_vacaciones
    WHERE empleado_id = ${employee.empleadoId}::uuid
      AND congelado = false
      AND dias_asignados + dias_excepcion > dias_tomados
  `;
  let pendingManagements = pending[0]?.cantidad ?? 0;

  for (let management = 1; management <= completedYears; management += 1) {
    if (pendingManagements >= configuredMaximum) {
      break;
    }
    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO saldo_vacaciones (
        id, empleado_id, gestion, dias_asignados, dias_tomados, congelado
      )
      VALUES (
        ${randomUUID()}::uuid, ${employee.empleadoId}::uuid,
        ${management}, ${configuredDays}, 0, false
      )
      ON CONFLICT (empleado_id, gestion) DO NOTHING
      RETURNING id
    `;
    pendingManagements += inserted.length;
  }
}
