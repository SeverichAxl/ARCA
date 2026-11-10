'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { contratosApi } from '@/lib/api/contratos/contratos-api';
import type {
  PageResult,
  Plantilla,
  PlantillaListFilters,
  PlantillaResumen,
} from '@/lib/api/contratos/types';

const EMPTY_PAGE: PageResult<PlantillaResumen> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

export function usePlantillas(filters: PlantillaListFilters) {
  const { request } = useAuth();
  const [result, setResult] = useState<PageResult<PlantillaResumen>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await contratosApi.listPlantillas(request, filters));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [filters, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

export function usePlantilla(id?: string) {
  const { request } = useAuth();
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setPlantilla(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPlantilla(await contratosApi.getPlantilla(request, id));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [id, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { plantilla, loading, error, reload };
}
