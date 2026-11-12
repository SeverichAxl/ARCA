import { isApiError, responseToApiError } from '@/lib/api/api-error';

/**
 * Descarga de archivos autenticados.
 *
 * El `request()` de la sesión devuelve un `Response` sin interpretarlo, así que
 * sirve tanto para JSON como para binarios. Este módulo convierte una respuesta
 * ya autorizada en una descarga del navegador y deja el `object URL` revocado.
 */

export interface DownloadEnvironment {
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  triggerDownload: (url: string, filename: string) => void;
}

export interface DownloadResult {
  filename: string;
}

function decodeRfc5987Value(value: string): string {
  const unquoted = value.trim().replace(/^"(.*)"$/, '$1');
  const withoutCharset = unquoted.replace(/^[^']*'[^']*'/, '');
  try {
    return decodeURIComponent(withoutCharset);
  } catch {
    return withoutCharset;
  }
}

/**
 * Lee `Content-Disposition`. Soporta `filename*=UTF-8''...` y `filename="..."`.
 * Devuelve `null` si no hay un nombre utilizable.
 */
export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (extended?.[1]) {
    const decoded = decodeRfc5987Value(extended[1]);
    if (decoded.trim()) return decoded.trim();
  }

  const plain = /filename\s*=\s*("([^"]*)"|'([^']*)'|([^;]+))/i.exec(header);
  const candidate = plain?.[2] ?? plain?.[3] ?? plain?.[4];
  if (candidate?.trim()) return candidate.trim();

  return null;
}

/** Evita rutas y caracteres de control en el nombre que entrega el servidor. */
export function sanitizeDownloadFilename(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();

  return cleaned || fallback;
}

function defaultEnvironment(): DownloadEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    triggerDownload: (url, filename) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  };
}

/**
 * Convierte una respuesta 2xx en descarga. Lanza `ApiError` si la respuesta no
 * es exitosa (el llamador decide el mensaje). Siempre revoca el object URL.
 */
export async function performFileDownload(
  response: Response,
  options: {
    defaultFileName: string;
    environment?: Partial<DownloadEnvironment>;
  },
): Promise<DownloadResult> {
  if (!response.ok) throw await responseToApiError(response);

  const blob = await response.blob();
  const fromHeader = parseContentDispositionFilename(
    response.headers.get('content-disposition'),
  );
  const filename = sanitizeDownloadFilename(
    fromHeader ?? options.defaultFileName,
    options.defaultFileName,
  );

  const environment: DownloadEnvironment = {
    ...defaultEnvironment(),
    ...options.environment,
  };

  const objectUrl = environment.createObjectUrl(blob);
  try {
    environment.triggerDownload(objectUrl, filename);
  } finally {
    environment.revokeObjectUrl(objectUrl);
  }

  return { filename };
}

const DOWNLOAD_ERROR_MESSAGES: Record<string, string> = {
  AUTH_TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión nuevamente.',
  AUTH_TOKEN_INVALID: 'Tu sesión no es válida. Inicia sesión nuevamente.',
  INTERNAL_ERROR: 'No se pudo descargar el documento. Intenta nuevamente.',
};

export interface DownloadErrorMessage {
  message: string;
  code?: string;
  traceId?: string;
  hideDetails: boolean;
}

/**
 * 403 y 404 significan "no es tuyo / no existe" y se responden sin detalles del
 * servidor para no filtrar información sobre documentos ajenos.
 */
export function resolveDownloadErrorMessage(error: unknown): DownloadErrorMessage {
  if (isApiError(error)) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      return { message: 'No tienes acceso a este documento', hideDetails: true };
    }
    if (error.statusCode === 401) {
      return {
        message: DOWNLOAD_ERROR_MESSAGES.AUTH_TOKEN_EXPIRED ?? 'Tu sesión expiró.',
        code: error.code,
        traceId: error.traceId,
        hideDetails: false,
      };
    }
    return {
      message:
        DOWNLOAD_ERROR_MESSAGES[error.code] ??
        error.message ??
        'No se pudo descargar el documento.',
      code: error.code,
      traceId: error.traceId,
      hideDetails: false,
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return { message: error.message, hideDetails: false };
  }
  if (typeof error === 'string' && error.trim()) {
    return { message: error, hideDetails: false };
  }
  return { message: 'No se pudo descargar el documento.', hideDetails: false };
}
