import { ApiError, readJson, responseToApiError } from '@/lib/api/api-error';
import { isDomainMocked } from '@/lib/api/mock-status';
import * as planillasMock from '@/lib/api/mocks/planillas.mock';
import type {
  Boleta,
  BoletaDetalle,
  BoletaListFilters,
  DescargaBoleta,
  PageResult,
} from './types';

/** Misma firma que `useAuth().request`: ruta sin `/api` y sesión ya adjunta. */
export type Requester = (path: string, options?: RequestInit) => Promise<Response>;

function buildBoletasQuery(filters: BoletaListFilters): string {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.periodo) params.set('periodo', filters.periodo);
  if (filters.planillaId) params.set('planillaId', filters.planillaId);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function downloadUnavailable(): ApiError {
  return new ApiError({
    statusCode: 502,
    code: 'BOLETA_NO_DISPONIBLE',
    message: 'La boleta no está disponible para descarga.',
    traceId: 'sin-trace-id',
  });
}

export const planillasApi = {
  /**
   * Lista las boletas del funcionario autenticado.
   *
   * `empleadoId` sale de la sesión y solo lo usa el mock para simular el
   * scope propio. NO se envía como query: el contrato indica que `read_own`
   * siempre aplica el empleadoId del token. La pantalla no permite consultar
   * a otra persona.
   */
  async listMisBoletas(
    request: Requester,
    filters: BoletaListFilters = {},
    empleadoId: string,
  ): Promise<PageResult<Boleta>> {
    if (isDomainMocked('planillas')) {
      return planillasMock.listMisBoletas(filters, empleadoId);
    }

    return readJson<PageResult<Boleta>>(
      await request(`/planillas/boletas${buildBoletasQuery(filters)}`),
    );
  },

  /** Detalle propio. El backend real devuelve metadatos + hash. */
  async getBoleta(
    request: Requester,
    id: string,
    empleadoId: string,
  ): Promise<BoletaDetalle> {
    if (isDomainMocked('planillas')) return planillasMock.getBoleta(id, empleadoId);

    return readJson<BoletaDetalle>(
      await request(`/planillas/boletas/${encodeURIComponent(id)}`),
    );
  },

  /**
   * Descarga el PDF usando el cliente autenticado (sin token en la URL).
   *
   * El contrato v1 responde JSON `{ url, expiresInSeconds, hashSha256 }` con
   * una URL firmada de 60 s; la URL se obtiene con `request()` y luego se
   * descarga el binario. Si el backend llegara a responder el PDF directo
   * (Content-Type PDF), también se soporta sin cambios.
   */
  async descargarBoletaPdf(
    request: Requester,
    id: string,
    empleadoId: string,
  ): Promise<Response> {
    if (isDomainMocked('planillas')) {
      return planillasMock.descargarBoleta(id, empleadoId);
    }

    const response = await request(
      `/planillas/boletas/${encodeURIComponent(id)}/descarga`,
    );
    if (!response.ok) throw await responseToApiError(response);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return response;

    const payload = (await response.json()) as DescargaBoleta;
    if (!payload?.url) throw downloadUnavailable();

    // URL firmada temporal: no lleva Authorization ni cookies.
    const pdfResponse = await fetch(payload.url, { credentials: 'omit' });
    if (!pdfResponse.ok) throw await responseToApiError(pdfResponse);
    return pdfResponse;
  },
};
