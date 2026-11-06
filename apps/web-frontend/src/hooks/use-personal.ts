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

export function useEmployee(employeeId: string) {
  const { request } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<EmployeeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeeResult, historyResult] = await Promise.all([
        personalApi.getEmployee(request, employeeId),
        personalApi.listHistory(request, employeeId),
      ]);
      setEmployee(employeeResult);
      setHistory(historyResult.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el expediente.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { employee, history, loading, error, reload };
}
