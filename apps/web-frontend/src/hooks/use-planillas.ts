'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import type {
  PageResult,
  PagoPlanilla,
  PlanillaCabecera,
  PlanillaListFilters,
} from '@/lib/api/planillas/types';

const EMPTY_PAGOS: PageResult<PagoPlanilla> = {
  data: [],
  meta: { page: 1, pageSize: 200, total: 0, totalPages: 0 },
};

const EMPTY_PLANILLAS: PageResult<PlanillaCabecera> = {
  data: [],
  meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
};

export function useMisPagos(empleadoId: string | null) {
  const { request } = useAuth();
  const [result, setResult] = useState(EMPTY_PAGOS);
  const [loading, setLoading] = useState(Boolean(empleadoId));
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!empleadoId) {
      setResult(EMPTY_PAGOS);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setResult(await planillasApi.listMisPagos(request, empleadoId));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [empleadoId, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

export function useBoletasAutorizadas(
  enabled: boolean,
  filters: PlanillaListFilters,
) {
  const { request } = useAuth();
  const [result, setResult] = useState(EMPTY_PLANILLAS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setResult(EMPTY_PLANILLAS);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await planillasApi.listClosedPlanillas(request, filters));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [enabled, filters, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

export function useDetallePlanilla(
  planillaId: string | null,
  page: number,
  pageSize: number,
) {
  const { request } = useAuth();
  const [result, setResult] = useState<PageResult<PagoPlanilla>>(EMPTY_PAGOS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!planillaId) {
      setResult(EMPTY_PAGOS);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(
        await planillasApi.listPlanillaDetalle(request, planillaId, page, pageSize),
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, planillaId, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}
