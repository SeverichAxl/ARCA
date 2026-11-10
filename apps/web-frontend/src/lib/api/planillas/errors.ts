import { isApiError } from '@/lib/api/api-error';

export const BOLETA_ACCESS_DENIED_MESSAGE = 'No tienes acceso a este documento';

export interface BoletaErrorMessage {
  message: string;
  code?: string;
  traceId?: string;
  hideDetails: boolean;
}

/**
 * El contrato responde 404 para una boleta ajena (preferido) y 403 si el
 * gateway/servicio deniega el permiso. Ambos casos se muestran igual, sin
 * detalles del servidor.
 */
export function resolveBoletaErrorMessage(error: unknown): BoletaErrorMessage {
  if (isApiError(error)) {
    if (
      error.statusCode === 403 ||
      error.statusCode === 404 ||
      error.code === 'FORBIDDEN' ||
      error.code === 'NOT_FOUND'
    ) {
      return { message: BOLETA_ACCESS_DENIED_MESSAGE, hideDetails: true };
    }

    if (error.statusCode === 401) {
      return {
        message: 'Tu sesión expiró. Inicia sesión nuevamente.',
        code: error.code,
        traceId: error.traceId,
        hideDetails: false,
      };
    }

    return {
      message: error.message || 'No se pudo consultar la boleta.',
      code: error.code,
      traceId: error.traceId,
      hideDetails: false,
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return { message: error.message, hideDetails: false };
  }
  return { message: 'No se pudo consultar la boleta.', hideDetails: false };
}
