'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/api-error';
import { cn } from '@/lib/utils';

const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los campos marcados e intenta nuevamente.',
  CONTR_TEMPLATE_INVALIDA: 'La plantilla no cumple las reglas de contenido.',
  CONTR_VARIABLE_NO_PERMITIDA:
    'La plantilla contiene una variable no permitida. Usa solo las variables de la barra.',
  CONTR_DATOS_INCOMPLETOS: 'No se puede generar el documento con los datos disponibles.',
  CONFLICT:
    'La operación entra en conflicto con el estado actual. Puede que el nombre ya exista o que otra sesión haya modificado la plantilla.',
  NOT_FOUND: 'El recurso solicitado no existe o ya no está disponible.',
  FORBIDDEN: 'No tienes permiso para realizar esta operación.',
  AUTH_TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión nuevamente.',
  AUTH_TOKEN_INVALID: 'La autenticación no es válida. Inicia sesión nuevamente.',
  RATE_LIMITED: 'Demasiados intentos. Espera unos minutos antes de reintentar.',
  INTERNAL_ERROR: 'Ocurrió un error interno. Usa el traceId para soporte.',
};

function resolveMessage(error: unknown): { message: string; code?: string; traceId?: string } {
  if (isApiError(error)) {
    return {
      message: CODE_MESSAGES[error.code] ?? error.message,
      code: error.code,
      traceId: error.traceId,
    };
  }
  if (error instanceof Error) return { message: error.message };
  if (typeof error === 'string' && error.trim()) return { message: error };
  return { message: 'No se pudo completar la operación.' };
}

/**
 * ErrorAlert muestra un mensaje accionable y el traceId contractual.
 * No imprime el error en consola para no filtrar datos de plantillas.
 */
export function ErrorAlert({
  error,
  title = 'No se pudo completar la operación',
  onRetry,
  className,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { message, code, traceId } = resolveMessage(error);

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100 sm:flex-row sm:items-start',
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 leading-relaxed">{message}</p>
        {code || traceId ? (
          <p className="mt-2 break-all text-xs opacity-80">
            {code ? <>Código: {code}</> : null}
            {code && traceId ? ' · ' : null}
            {traceId ? <>traceId: {traceId}</> : null}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
