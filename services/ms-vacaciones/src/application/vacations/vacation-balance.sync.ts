import { randomUUID } from 'node:crypto';
import type { PrismaTransactionLike } from '@arca/messaging';
import { completedYearsOfService } from './vacation-eligibility';
import {
  assertManagementAvailable,
  vacationDaysForSeniority,
  type VacationPolicy,
} from '../configuration/vacation-policy';

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
    WHERE clave IN (
      'MAX_GESTIONES_ACUMULADAS', 'ESCALA_0_A_4', 'ESCALA_5_A_9', 'ESCALA_10_MAS'
    )
  `;
  const configuration = new Map(settings.map(({ clave, valor }) => [clave, Number(valor)]));
  const policy: VacationPolicy = {
    maxGestionesAcumuladas: configuration.get('MAX_GESTIONES_ACUMULADAS') ?? 0,
    diasEscalaInicial: configuration.get('ESCALA_0_A_4') ?? 0,
    diasEscalaMedia: configuration.get('ESCALA_5_A_9') ?? 0,
    diasEscalaMayor: configuration.get('ESCALA_10_MAS') ?? 0,
  };
  if (Object.values(policy).some((value) => !Number.isInteger(value) || value < 1)) {
    throw new Error('La política de vacaciones configurada es inválida.');
  }

  const pending = await tx.$queryRaw<Array<{ cantidad: number }>>`
    SELECT COUNT(*)::int AS cantidad
    FROM saldo_vacaciones
    WHERE empleado_id = ${employee.empleadoId}::uuid
      AND congelado = false
      AND dias_asignados + dias_excepcion > dias_tomados
  `;
  let pendingManagements = pending[0]?.cantidad ?? 0;

  if (pendingManagements >= policy.maxGestionesAcumuladas) {
    assertManagementAvailable(pendingManagements, policy);
  }

  for (let management = 1; management <= completedYears; management += 1) {
    if (pendingManagements >= policy.maxGestionesAcumuladas) {
      break;
    }
    const configuredDays = vacationDaysForSeniority(management - 1, policy);
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
