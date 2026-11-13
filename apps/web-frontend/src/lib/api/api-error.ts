/**
 * Error normalizado de la capa de API.
 *
 * El backend siempre responde con
 * `{ statusCode, code, message, details?, traceId }` (ver docs/api/errores.md).
 * La UI consume este tipo en lugar de inspeccionar respuestas HTTP.
 */
export interface ApiErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
  traceId?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly traceId: string;
  readonly details?: unknown;

  constructor(input: {
    statusCode: number;
    code: string;
    message: string;
    traceId: string;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.traceId = input.traceId;
    this.details = input.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Uno o más campos no son válidos.',
  401: 'La autenticación no es válida.',
  403: 'No tiene permiso para realizar esta operación.',
  404: 'El recurso solicitado no existe.',
  409: 'La operación entra en conflicto con el estado actual.',
  422: 'La operación no cumple las reglas de negocio.',
  429: 'Demasiados intentos. Intente nuevamente más tarde.',
  500: 'Ocurrió un error interno. Use el traceId para soporte.',
};

const FALLBACK_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_TOKEN_INVALID',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

function readMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.join(' ');
  }
  return undefined;
}

/**
 * Convierte una respuesta HTTP no exitosa en `ApiError`.
 * Nunca registra el body en consola porque puede contener datos personales.
 */
export async function responseToApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  const statusCode = payload?.statusCode ?? response.status;
  const code = payload?.code ?? FALLBACK_CODES[statusCode] ?? 'INTERNAL_ERROR';
  const message =
    readMessage(payload?.message) ??
    FALLBACK_MESSAGES[statusCode] ??
    `La solicitud falló (${statusCode}).`;

  return new ApiError({
    statusCode,
    code,
    message,
    traceId: payload?.traceId ?? 'sin-trace-id',
    details: payload?.details,
  });
}

/** Lee JSON y lanza `ApiError` si la respuesta no es 2xx. */
export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseToApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
