'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { isApiError } from '@/lib/api/api-error';
import { contratosApi } from '@/lib/api/contratos/contratos-api';
import type {
  ContratoEmpleadoItem,
  PageResult,
  Plantilla,
  PlantillaListFilters,
  PlantillaResumen,
} from '@/lib/api/contratos/types';

const EMPTY_PAGE: PageResult<PlantillaResumen> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

const ACTIVE_TEMPLATES_FILTERS: PlantillaListFilters = {
  activa: true,
  page: 1,
  pageSize: 100,
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

/**
 * Plantillas activas para el selector de generación. No llama al backend si el
 * usuario no puede generar contratos (`enabled=false`).
 */
export function usePlantillasActivas(enabled = true) {
  const { request } = useAuth();
  const [result, setResult] = useState<PageResult<PlantillaResumen>>(EMPTY_PAGE);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setResult(EMPTY_PAGE);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setResult(await contratosApi.listPlantillas(request, ACTIVE_TEMPLATES_FILTERS));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [enabled, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

/**
 * Contratos del empleado. Un 404 del backend significa "sin contratos" o
 * "fuera del ámbito propio"; se expone como `notFound` para que la ficha
 * muestre un estado vacío y no rompa el resto del expediente.
 */
export function useContratosEmpleado(empleadoId: string, enabled = true) {
  const { request } = useAuth();
  const [contratos, setContratos] = useState<ContratoEmpleadoItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setContratos([]);
      setLoading(false);
      setError(null);
      setNotFound(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await contratosApi.listContratosEmpleado(request, empleadoId);
      setContratos(result.data);
    } catch (reason) {
      if (isApiError(reason) && reason.statusCode === 404) {
        setContratos([]);
        setNotFound(true);
      } else {
        setError(reason);
      }
    } finally {
      setLoading(false);
    }
  }, [empleadoId, enabled, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { contratos, loading, error, notFound, reload };
}
