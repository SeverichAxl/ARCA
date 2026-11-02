import type { Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}

export function buildErrorBody(
  statusCode: number,
  code: string,
  message: string,
  traceId: string,
  details?: Record<string, unknown>,
): ApiErrorBody {
  return details
    ? { statusCode, code, message, details, traceId }
    : { statusCode, code, message, traceId };
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  traceId: string,
  details?: Record<string, unknown>,
): void {
  if (response.headersSent) {
    return;
  }

  response.status(statusCode).json(buildErrorBody(statusCode, code, message, traceId, details));
}
