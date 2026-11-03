import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { DomainError, Errores } from '../../domain/errors/domain.error';

const POR_ESTADO: Record<number, [string, string]> = {
  400: ['VALIDATION_ERROR', 'Uno o más campos no son válidos.'],
  401: ['AUTH_TOKEN_INVALID', 'La autenticación no es válida.'],
  403: ['FORBIDDEN', 'No tiene permiso para realizar esta operación.'],
  404: ['NOT_FOUND', 'El recurso solicitado no existe.'],
  409: ['CONFLICT', 'La operación entra en conflicto con el estado actual.'],
};

/** Formato de error común. Nunca expone stack ni datos personales. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = request.headers['x-request-id'];
    const traceId = (Array.isArray(requestId) ? requestId[0] : requestId) ?? randomUUID();

    let error: DomainError;
    if (exception instanceof DomainError) {
      error = exception;
    } else if (
      exception instanceof PayloadTooLargeException ||
      (exception instanceof Error &&
        'code' in exception &&
        exception.code === 'LIMIT_FILE_SIZE')
    ) {
      error = Errores.archivoInvalido();
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const [code, message] = POR_ESTADO[status] ?? ['INTERNAL_ERROR', exception.message];
      const cuerpo = exception.getResponse();
      const detalle =
        status === 400 && typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo
          ? { errores: (cuerpo as { message: unknown }).message }
          : undefined;
      error = new DomainError(code, status, message, detalle);
    } else {
      this.logger.error(`[${traceId}] ${exception instanceof Error ? exception.stack ?? exception.message : String(exception)}`);
      error = new DomainError('INTERNAL_ERROR', 500, 'Ocurrió un error interno. Use el traceId para soporte.');
    }

    response.status(error.status).json({
      statusCode: error.status,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      traceId,
    });
  }
}
