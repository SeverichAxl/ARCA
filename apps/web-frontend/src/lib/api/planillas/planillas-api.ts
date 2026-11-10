import { readJson } from '@/lib/api/api-error';
import { isDomainMocked } from '@/lib/api/mock-status';
import * as planillasMock from '@/lib/api/mocks/planillas.mock';
import type {
  PageResult,
  PagoPlanilla,
  PlanillaCabecera,
  PlanillaListFilters,
} from './types';

/** Misma firma que `useAuth().request`: ruta sin `/api` y sesión ya adjunta. */
export type Requester = (path: string, options?: RequestInit) => Promise<Response>;

function paginationQuery(page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return params.toString();
}

function planillasQuery(filters: PlanillaListFilters): string {
  const params = new URLSearchParams();
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 12));
  params.set('estado', 'CERRADA');
  if (filters.desde) params.set('desde', filters.desde);
  if (filters.hasta) params.set('hasta', filters.hasta);
  return params.toString();
}

export const planillasApi = {
  /** Pagos propios: el backend deriva empleadoId exclusivamente del token. */
  async listMisPagos(
    request: Requester,
    empleadoId: string,
  ): Promise<PageResult<PagoPlanilla>> {
    if (isDomainMocked('planillas')) return planillasMock.listMisPagos(empleadoId);

    const pageSize = 200;
    const firstPage = await readJson<PageResult<PagoPlanilla>>(
      await request(`/planillas/mis-pagos?${paginationQuery(1, pageSize)}`),
    );
    const pages = [firstPage];
    const totalPages = firstPage.meta.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page += 1) {
      pages.push(
        await readJson<PageResult<PagoPlanilla>>(
          await request(`/planillas/mis-pagos?${paginationQuery(page, pageSize)}`),
        ),
      );
    }

    return {
      data: pages.flatMap((result) => result.data),
      meta: { ...firstPage.meta, page: 1, pageSize, totalPages },
    };
  },

  async listClosedPlanillas(
    request: Requester,
    filters: PlanillaListFilters,
  ): Promise<PageResult<PlanillaCabecera>> {
    if (isDomainMocked('planillas')) return planillasMock.listClosedPlanillas(filters);
    return readJson<PageResult<PlanillaCabecera>>(
      await request(`/planillas?${planillasQuery(filters)}`),
    );
  },

  async listPlanillaDetalle(
    request: Requester,
    planillaId: string,
    page: number,
    pageSize: number,
  ): Promise<PageResult<PagoPlanilla>> {
    if (isDomainMocked('planillas')) {
      return planillasMock.listPlanillaDetalle(planillaId, page, pageSize);
    }
    return readJson<PageResult<PagoPlanilla>>(
      await request(
        `/planillas/${encodeURIComponent(planillaId)}/detalle?${paginationQuery(page, pageSize)}`,
      ),
    );
  },

  /** El endpoint propio acepta solo periodo; nunca se envía un empleadoId. */
  async descargarBoletaPropia(
    request: Requester,
    periodo: string,
    empleadoId: string,
  ): Promise<Response> {
    if (isDomainMocked('planillas')) {
      return planillasMock.descargarBoletaPropia(periodo, empleadoId);
    }
    return request(`/planillas/boletas/mias/${encodeURIComponent(periodo)}/pdf`);
  },

  /** La API valida permiso global o que empleadoId coincida con el token. */
  async descargarBoletaAutorizada(
    request: Requester,
    planillaId: string,
    empleadoId: string,
  ): Promise<Response> {
    if (isDomainMocked('planillas')) {
      return planillasMock.descargarBoletaAutorizada(planillaId, empleadoId);
    }
    return request(
      `/planillas/boletas/${encodeURIComponent(planillaId)}/empleados/${encodeURIComponent(empleadoId)}/pdf`,
    );
  },
};
