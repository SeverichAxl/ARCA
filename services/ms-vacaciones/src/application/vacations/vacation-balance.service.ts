import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { isVacationEligible } from './vacation-eligibility';
import { synchronizeVacationBalances } from './vacation-balance.sync';

@Injectable()
export class VacationBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnBalance(empleadoId: string | null) {
    if (!empleadoId) {
      throw new ForbiddenException('El usuario autenticado no tiene un funcionario asociado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.empleadoRef.findUnique({ where: { empleadoId } });
      if (!employee) {
        throw new NotFoundException('No se encontró el funcionario autenticado.');
      }

      const asOf = new Date();
      await synchronizeVacationBalances(
        tx,
        {
          empleadoId: employee.empleadoId,
          estado: employee.estado,
          fechaIngreso: employee.fechaIngreso,
        },
        asOf,
      );

      const balances = await tx.saldoVacaciones.findMany({
        where: { empleadoId },
        orderBy: { gestion: 'asc' },
        select: {
          gestion: true,
          diasAsignados: true,
          diasTomados: true,
        },
      });
      const gestiones = balances.map((balance) => ({
        ...balance,
        diasPendientes: balance.diasAsignados - balance.diasTomados,
      }));
      const gestionesPendientes = gestiones.filter(
        ({ diasPendientes }) => diasPendientes > 0,
      ).length;

      return {
        empleadoId,
        elegible: isVacationEligible(employee, asOf),
        gestiones,
        advertencias: gestionesPendientes >= 2 ? ['GESTION_BLOQUEADA'] : [],
      };
    });
  }
}
