import {
  BadGatewayException,
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { catchError, type Observable, throwError } from 'rxjs';
import { ImporteInvalidoError, PorcentajeInvalidoError } from '../../domain/common/money';
import { LiquidoNegativoError, NovedadInconsistenteError } from '../../domain/nomina/calculo';
import {
  ParametrosIncompletosError,
  ParametrosInvalidosError,
} from '../../domain/nomina/parametros';
import { FechaInvalidaError, PeriodoInvalidoError } from '../../domain/nomina/periodo';
import {
  PeriodoFuturoError,
  PersonalNoDisponibleError,
  PlanillaCerradaError,
  PlanillaInmutableError,
  PlanillaNoEncontradaError,
  PlanillaSinEmpleadosError,
} from '../../domain/planillas/planilla.models';
import { RangoInvalidoError } from './planillas.service';

const VALIDATION_MESSAGE = 'Uno o más campos no son válidos.';

export function mapDomainError(error: unknown): HttpException | undefined {
  if (error instanceof HttpException) return error;

  if (error instanceof PeriodoInvalidoError) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MESSAGE,
      details: { fields: { periodo: 'Debe tener formato YYYY-MM.' } },
    });
  }
  if (error instanceof FechaInvalidaError) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MESSAGE,
      details: { fields: { fecha: 'Debe tener formato YYYY-MM-DD.' } },
    });
  }
  if (error instanceof ImporteInvalidoError || error instanceof PorcentajeInvalidoError) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MESSAGE,
      details: { fields: { [error.campo ?? 'importe']: 'Importe no válido.' } },
    });
  }
  if (error instanceof RangoInvalidoError) {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MESSAGE,
      details: { fields: { rango: error.message } },
    });
  }
  if (error instanceof PlanillaNoEncontradaError) {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' });
  }
  if (error instanceof PlanillaCerradaError) {
    return new ConflictException({
      code: 'PLAN_CERRADA',
      message: 'La planilla del periodo ya está cerrada y no admite cambios.',
      details: { periodo: error.periodo },
    });
  }
  if (error instanceof PlanillaInmutableError) {
    return new ConflictException({
      code: 'PLAN_INMUTABLE',
      message: 'Los registros de una planilla cerrada son inmutables.',
    });
  }
  if (error instanceof PeriodoFuturoError) {
    return new UnprocessableEntityException({
      code: 'PLAN_PERIODO_FUTURO',
      message: 'No se puede calcular un periodo que todavía no inició.',
      details: { periodo: error.periodo },
    });
  }
  if (error instanceof PlanillaSinEmpleadosError) {
    return new UnprocessableEntityException({
      code: 'PLAN_SIN_EMPLEADOS',
      message: 'No hay funcionarios activos para el periodo.',
    });
  }
  if (error instanceof ParametrosIncompletosError) {
    return new UnprocessableEntityException({
      code: 'PLAN_PARAMETROS_INCOMPLETOS',
      message: 'Faltan parámetros legales vigentes para el periodo.',
      details: { faltantes: error.faltantes, fechaCorte: error.fechaCorte },
    });
  }
  if (error instanceof ParametrosInvalidosError) {
    return new UnprocessableEntityException({
      code: 'PLAN_PARAMETROS_INVALIDOS',
      message: 'Los parámetros legales vigentes no son coherentes.',
      details: { motivo: error.message },
    });
  }
  if (error instanceof LiquidoNegativoError) {
    return new UnprocessableEntityException({
      code: 'PLAN_LIQUIDO_NEGATIVO',
      message: 'Los descuentos de un funcionario superan su total ganado.',
      details: { empleadoId: error.empleadoId },
    });
  }
  if (error instanceof NovedadInconsistenteError) {
    return new UnprocessableEntityException({
      code: 'PLAN_NOVEDAD_INCONSISTENTE',
      message: 'La novedad registrada no es coherente con los datos del funcionario.',
      details: { empleadoId: error.empleadoId },
    });
  }
  if (error instanceof PersonalNoDisponibleError) {
    return new BadGatewayException({
      code: 'PLAN_PERSONAL_NO_DISPONIBLE',
      message: 'No se pudo obtener la nómina desde el servicio de personal.',
    });
  }
  return undefined;
}

@Injectable()
export class DomainErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(catchError((error: unknown) => throwError(() => mapDomainError(error) ?? error)));
  }
}
