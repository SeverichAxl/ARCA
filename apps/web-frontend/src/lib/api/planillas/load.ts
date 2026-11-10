import { planillasApi } from './planillas-api';
import type { BoletaListFilters, Boleta, PageResult } from './types';

/** Misma firma que `useAuth().request`: ruta sin `/api` y sesión ya adjunta. */
export type Requester = (path: string, options?: RequestInit) => Promise<Response>;

export const EMPTY_BOLETAS_PAGE: PageResult<Boleta> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
};

export interface MisBoletasLoaderDeps {
  request: Requester;
  /** Sale siempre de la sesión. `null` = usuario no vinculado a funcionario. */
  empleadoId: string | null;
  filters: BoletaListFilters;
  api?: {
    listMisBoletas: (
      request: Requester,
      filters: BoletaListFilters,
      empleadoId: string,
    ) => Promise<PageResult<Boleta>>;
  };
}

/**
 * Carga "mis boletas" solo si hay funcionario vinculado.
 *
 * Con `empleadoId === null` devuelve una página vacía sin tocar el backend.
 * Esto es lo que usa la pantalla: ADMIN_GENERAL (o cualquier usuario sin
 * vínculo) ve el mensaje informativo y no dispara ninguna solicitud.
 */
export async function loadMisBoletasPage({
  request,
  empleadoId,
  filters,
  api,
}: MisBoletasLoaderDeps): Promise<PageResult<Boleta>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  if (!empleadoId) {
    return { data: [], meta: { page, pageSize, total: 0 } };
  }

  const loader = api ?? planillasApi;
  return loader.listMisBoletas(request, filters, empleadoId);
}
