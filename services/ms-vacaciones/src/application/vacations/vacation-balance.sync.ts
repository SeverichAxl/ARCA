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

  const settings = await tx.$queryRaw<Array<{ valor: string }>>`
    SELECT valor
    FROM configuracion_vacaciones
    WHERE clave = 'DIAS_POR_GESTION'
    LIMIT 1
  `;
  const daysPerManagement = Number(settings[0]?.valor);
  if (!Number.isInteger(daysPerManagement) || daysPerManagement < 1) {
    throw new Error(
      'La configuración DIAS_POR_GESTION no existe o no contiene un entero positivo.',
    );
  }

  for (let management = 1; management <= completedYears; management += 1) {
    await tx.$queryRaw`
      INSERT INTO saldo_vacaciones (
        id, empleado_id, gestion, dias_asignados, dias_tomados, congelado
      )
      VALUES (
        ${randomUUID()}::uuid, ${employee.empleadoId}::uuid,
        ${management}, ${daysPerManagement}, 0, false
      )
      ON CONFLICT (empleado_id, gestion) DO NOTHING
      RETURNING id
    `;
  }
}
