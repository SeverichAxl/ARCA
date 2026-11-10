'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  personalApi,
  type Employee,
  type EmployeeCatalogs,
  type EmployeeFilters,
  type EmployeeHistoryEntry,
  type PageResult,
} from '@/lib/personal-api';

const EMPTY_FILTERS: EmployeeFilters = {
  nombre: '',
  ci: '',
  areaId: '',
  cargoId: '',
  estado: '',
  inamovilidad: '',
  page: 1,
  pageSize: 20,
};

export function useEmployeeList(filters: EmployeeFilters = EMPTY_FILTERS) {
  const { request } = useAuth();
  const [result, setResult] = useState<PageResult<Employee>>({
    data: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await personalApi.listEmployees(request, filters));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el personal.');
    } finally {
      setLoading(false);
    }
  }, [filters, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...result, loading, error, reload };
}

export function useEmployeeCatalogs() {
  const { request, session } = useAuth();
  const [catalogs, setCatalogs] = useState<EmployeeCatalogs>({ areas: [], cargos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.permissions.includes('catalogo:manage')) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    personalApi
      .listCatalogs(request)
      .then((result) => {
        if (active) setCatalogs(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, session]);

  return { ...catalogs, loading, error };
}

/**
 * Carga el expediente en dos peticiones independientes.
 *
 * El empleado y su historial tienen estados separados para que un fallo del
 * historial no oculte los datos personales/laborales de la ficha consolidada.
 */
export function useEmployee(employeeId: string) {
  const { request } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<EmployeeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const reloadEmployee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployee(await personalApi.getEmployee(request, employeeId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el expediente.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, request]);

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const result = await personalApi.listHistory(request, employeeId);
      setHistory(result.data);
    } catch (reason) {
      setHistoryError(
        reason instanceof Error ? reason.message : 'No se pudo cargar el historial laboral.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [employeeId, request]);

  useEffect(() => {
    void reloadEmployee();
  }, [reloadEmployee]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const reload = useCallback(async () => {
    await Promise.all([reloadEmployee(), reloadHistory()]);
  }, [reloadEmployee, reloadHistory]);

  return {
    employee,
    history,
    loading,
    error,
    historyLoading,
    historyError,
    reload,
    reloadHistory,
  };
}
