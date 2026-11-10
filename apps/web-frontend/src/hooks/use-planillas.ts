'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import { loadMisBoletasPage } from '@/lib/api/planillas/load';
import type {
  Boleta,
  BoletaDetalle,
  BoletaListFilters,
  PageResult,
} from '@/lib/api/planillas/types';

const EMPTY_PAGE: PageResult<Boleta> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
};

/**
 * Boletas propias. Mantiene la convención del proyecto: `useState`/`useEffect`
 * (sin TanStack Query). Con `empleadoId === null` no se llama al backend.
 */
export function useMisBoletas(
  empleadoId: string | null,
  filters: BoletaListFilters,
) {
  const { request } = useAuth();
  const [result, setResult] = useState<PageResult<Boleta>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(Boolean(empleadoId));
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!empleadoId) {
      setResult({
        data: [],
        meta: {
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
          total: 0,
        },
      });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setResult(
        await loadMisBoletasPage({ request, empleadoId, filters }),
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [empleadoId, filters, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

/** Detalle de una boleta propia. Se activa al abrir el diálogo. */
export function useBoletaDetalle(
  boletaId: string | null,
  empleadoId: string | null,
) {
  const { request } = useAuth();
  const [boleta, setBoleta] = useState<BoletaDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!boletaId || !empleadoId) {
      setBoleta(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setBoleta(await planillasApi.getBoleta(request, boletaId, empleadoId));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [boletaId, empleadoId, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { boleta, loading, error, reload };
}
