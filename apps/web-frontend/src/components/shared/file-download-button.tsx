'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  performFileDownload,
  resolveDownloadErrorMessage,
} from '@/lib/api/file-download';
import { cn } from '@/lib/utils';

/**
 * Botón de descarga que usa una función autenticada (normalmente `request()`)
 * y nunca coloca el token en la URL.
 *
 * - Muestra estado de carga y anuncio accesible.
 * - 403/404: "No tienes acceso a este documento" sin detalles del servidor.
 * - 401: lo maneja el refresh de `request()`; aquí solo se informa si falla.
 */
export function FileDownloadButton({
  download,
  defaultFileName,
  label = 'Descargar PDF',
  variant = 'outline',
  size = 'sm',
  className,
}: {
  download: () => Promise<Response>;
  defaultFileName: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    setDownloaded(null);
    try {
      const response = await download();
      const result = await performFileDownload(response, { defaultFileName });
      setDownloaded(result.filename);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  };

  const resolvedError = error ? resolveDownloadErrorMessage(error) : null;

  return (
    <div className={cn('inline-flex max-w-full flex-col items-start gap-1', className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => void handleDownload()}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Download aria-hidden="true" className="h-4 w-4" />
        )}
        {loading ? 'Descargando…' : label}
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {downloaded ? `Descarga iniciada: ${downloaded}` : ''}
      </span>

      {resolvedError ? (
        <p role="alert" className="max-w-[240px] text-xs leading-snug text-red-700 dark:text-red-300">
          {resolvedError.message}
          {!resolvedError.hideDetails && (resolvedError.code || resolvedError.traceId) ? (
            <span className="mt-0.5 block break-all opacity-80">
              {resolvedError.code ? `Código: ${resolvedError.code}` : null}
              {resolvedError.code && resolvedError.traceId ? ' · ' : null}
              {resolvedError.traceId ? `traceId: ${resolvedError.traceId}` : null}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
