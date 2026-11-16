import {
  Catch,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

interface ErrorBody {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Catch(HttpException)
export class ContractHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception.getStatus();
    const rawBody = exception.getResponse();
    const body =
      typeof rawBody === 'object' && rawBody !== null
        ? (rawBody as ErrorBody)
        : {};
    const headerTraceId = request.headers['x-request-id'];
    const traceId = Array.isArray(headerTraceId)
      ? headerTraceId[0]
      : headerTraceId;
    const errorCode =
      typeof body.code === 'string'
        ? body.code
        : statusCode === 404
          ? 'NOT_FOUND'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode < 500
              ? 'VALIDATION_ERROR'
              : 'INTERNAL_ERROR';

    response.status(statusCode).json({
      statusCode,
      code: errorCode,
      message: typeof body.message === 'string' ? body.message : exception.message,
      ...(typeof body.details === 'object' && body.details !== null
        ? { details: body.details }
        : {}),
      traceId:
        typeof traceId === 'string' && traceId.length > 0 && traceId.length <= 128
          ? traceId
          : randomUUID(),
    });
  }
}
