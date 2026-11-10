import { HttpException, HttpStatus } from '@nestjs/common';

export interface VacationPolicy {
  maxGestionesAcumuladas: number;
  diasEscalaInicial: number;
  diasEscalaMedia: number;
  diasEscalaMayor: number;
}

export function vacationDaysForSeniority(years: number, policy: VacationPolicy): number {
  if (!Number.isInteger(years) || years < 0)
    throw new Error('La antigüedad debe ser un entero no negativo.');
  if (years < 5) return policy.diasEscalaInicial;
  if (years < 10) return policy.diasEscalaMedia;
  return policy.diasEscalaMayor;
}

export function assertManagementAvailable(
  pendingManagements: number,
  policy: VacationPolicy,
): void {
  if (pendingManagements >= policy.maxGestionesAcumuladas) {
    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        code: 'GESTION_BLOQUEADA',
        message:
          'Alcanzó el límite de gestiones acumuladas; debe regularizar la gestión más antigua.',
      },
      HttpStatus.CONFLICT,
    );
  }
}
