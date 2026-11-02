import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  completedServiceYears,
  isVacationEligible,
  parsePositiveIntegerConfiguration,
} from './vacation-eligibility';

interface EmployeeBalanceRecord {
  empleado_id: string;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fecha_ingreso: Date;
}

interface VacationBalanceRecord {
  gestion: number;
  dias_asignados: number;
  dias_tomados: number;
}

@Injectable()
export class VacationBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getForEmployee(empleadoId: string) {
    if (!isUUID(empleadoId)) {
      throw new NotFoundException('No se encontró el funcionario.');
    }

    return this.prisma.$transaction(async (tx) => {
      const [employee] = await tx.$queryRaw<EmployeeBalanceRecord[]>`
        SELECT empleado_id, estado, fecha_ingreso
        FROM empleado_ref
        WHERE empleado_id = ${empleadoId}::uuid
      `;
      if (!employee) {
        throw new NotFoundException('No se encontró el funcionario.');
      }

      const today = new Date();
      const eligible = isVacationEligible(employee.estado, employee.fecha_ingreso, today);

      if (eligible) {
        const [configuration] = await tx.$queryRaw<Array<{ valor: string }>>`
          SELECT valor
          FROM configuracion_vacaciones
          WHERE clave = 'DIAS_POR_GESTION'
        `;
        if (!configuration) {
          throw new Error('No existe la configuración DIAS_POR_GESTION.');
        }

        const daysPerManagement = parsePositiveIntegerConfiguration(
          'DIAS_POR_GESTION',
          configuration.valor,
        );
        const completedYears = completedServiceYears(employee.fecha_ingreso, today);
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
      }

      const balances = await tx.$queryRaw<VacationBalanceRecord[]>`
        SELECT gestion, dias_asignados, dias_tomados
        FROM saldo_vacaciones
        WHERE empleado_id = ${empleadoId}::uuid
        ORDER BY gestion
      `;
      let advertencias: string[] = [];
      if (eligible) {
        const [maxGestionesConfiguration] = await tx.$queryRaw<Array<{ valor: string }>>`
          SELECT valor
          FROM configuracion_vacaciones
          WHERE clave = 'MAX_GESTIONES_ACUMULADAS'
        `;
        if (!maxGestionesConfiguration) {
          throw new Error('No existe la configuración MAX_GESTIONES_ACUMULADAS.');
        }

        const maxGestiones = parsePositiveIntegerConfiguration(
          'MAX_GESTIONES_ACUMULADAS',
          maxGestionesConfiguration.valor,
        );
        const pendingManagements = balances.filter(
          (balance) => balance.dias_asignados - balance.dias_tomados > 0,
        ).length;
        if (pendingManagements >= maxGestiones) {
          advertencias = ['VAC_GESTION_BLOQUEADA'];
        }
      }

      return {
        empleadoId,
        elegible: eligible,
        advertencias,
        gestiones: balances.map((balance) => ({
          gestion: balance.gestion,
          diasAsignados: balance.dias_asignados,
          diasTomados: balance.dias_tomados,
          diasPendientes: balance.dias_asignados - balance.dias_tomados,
        })),
      };
    });
  }
}
