import {
  BadGatewayException,
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
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
  EstadoInvalidoError,
  PeriodoDuplicadoError,
  PeriodoFuturoError,
  PersonalNoDisponibleError,
  PlanillaInmutableError,
  PlanillaNoEncontradaError,
  PlanillaSinEmpleadosError,
} from '../../domain/planillas/planilla.models';

const VALIDATION_MESSAGE = 'Uno o más campos no son válidos.';

function validacion(fields: Record<string, string>): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: VALIDATION_MESSAGE,
    details: { fields },
  });
}

/**
 * Traduce errores de dominio a los códigos del contrato (docs/api/errores.md).
 * Va como interceptor de controlador para que el interceptor global de
 * auditoría reciba ya la HttpException con su código.
 */
export function mapDomainError(error: unknown): HttpException | undefined {
  if (error instanceof HttpException) return error;

  if (error instanceof PeriodoInvalidoError) {
    return validacion({ periodo: 'Debe tener formato YYYY-MM.' });
  }
  if (error instanceof FechaInvalidaError) {
    return validacion({ fecha: 'Debe tener formato YYYY-MM-DD.' });
  }
  if (error instanceof ImporteInvalidoError || error instanceof PorcentajeInvalidoError) {
    return validacion({ [error.campo ?? 'importe']: 'Importe no válido.' });
  }
  if (error instanceof PlanillaNoEncontradaError) {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'El recurso solicitado no existe.',
    });
  }
  if (error instanceof PeriodoDuplicadoError) {
    return new ConflictException({
      code: 'PLANILLA_PERIODO_DUPLICADO',
      message: 'Ya existe una planilla para ese periodo.',
      details: { periodo: error.periodo },
    });
  }
  if (error instanceof EstadoInvalidoError) {
    return new ConflictException({
      code: 'PLANILLA_ESTADO_INVALIDO',
      message: 'La planilla no admite esta transición.',
      details: { periodo: error.periodo, estado: error.estado, operacion: error.operacion },
    });
  }
  if (error instanceof PlanillaInmutableError) {
    return new ConflictException({
      code: 'PLANILLA_ESTADO_INVALIDO',
      message: 'La planilla no admite esta transición.',
      details: { estado: 'CERRADA' },
    });
  }
  if (error instanceof ParametrosIncompletosError) {
    return new UnprocessableEntityException({
      code: 'PLANILLA_PARAMETROS_VIGENTES_FALTANTES',
      message: 'No están configurados todos los parámetros requeridos.',
      details: { faltantes: error.faltantes, fechaCorte: error.fechaCorte },
    });
  }
  if (error instanceof ParametrosInvalidosError) {
    return new UnprocessableEntityException({
      code: 'PLANILLA_PARAMETROS_VIGENTES_FALTANTES',
      message: 'No están configurados todos los parámetros requeridos.',
      details: { motivo: error.message },
    });
  }
  if (error instanceof PeriodoFuturoError) {
    return new UnprocessableEntityException({
      code: 'PLANILLA_PERIODO_FUTURO',
      message: 'No se puede procesar un periodo que todavía no inició.',
      details: { periodo: error.periodo },
    });
  }
  if (error instanceof PersonalNoDisponibleError) {
    return new BadGatewayException({
      code: 'PLANILLA_PERSONAL_NO_DISPONIBLE',
      message: 'No se pudo obtener la nómina desde el servicio de personal.',
    });
  }
  if (
    error instanceof PlanillaSinEmpleadosError ||
    error instanceof LiquidoNegativoError ||
    error instanceof NovedadInconsistenteError
  ) {
    return new InternalServerErrorException({
      code: 'PLANILLA_CALCULO_ERROR',
      message: 'No se pudo calcular la planilla.',
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
