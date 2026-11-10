'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useEmployeeCatalogs } from '@/hooks/use-personal';
import {
  EMPLOYEE_SEARCH_PAGE_SIZE,
  employeesApi,
  type ContractEmployee,
  type ContractEmployeeFilters,
} from '@/lib/api/contratos/employees-api';
import { cn } from '@/lib/utils';

export interface PreviewEmployee {
  id: string;
  nombreCompleto: string;
  ci: string;
  fechaIngreso: string;
  estado: string;
  diasPrueba?: number;
  remuneracion?: number;
  areaNombre?: string;
  cargoNombre?: string;
}

const EMPTY_META = { page: 1, pageSize: EMPLOYEE_SEARCH_PAGE_SIZE, total: 0, totalPages: 0 };

const ESTADO_LABELS: Record<string, string> = {
  EN_PRUEBA: 'En prueba',
  RATIFICADO: 'Ratificado',
  INACTIVO: 'Inactivo',
};

export function EmployeeCombobox({
  value,
  onChange,
  disabled = false,
}: {
  value: PreviewEmployee | null;
  onChange: (employee: PreviewEmployee | null) => void;
  disabled?: boolean;
}) {
  const { request, session } = useAuth();
  const canRead = session?.user.permissions.includes('personal:read') ?? false;
  const { areas, cargos } = useEmployeeCatalogs();

  const [name, setName] = useState('');
  const [ci, setCi] = useState('');
  const debouncedName = useDebouncedValue(name, 300);
  const debouncedCi = useDebouncedValue(ci, 300);

  const [results, setResults] = useState<ContractEmployee[]>([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestIdRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const areaNames = useMemo(
    () => new Map(areas.map((area) => [area.id, area.nombre])),
    [areas],
  );
  const cargoNames = useMemo(
    () => new Map(cargos.map((cargo) => [cargo.id, cargo.nombre])),
    [cargos],
  );

  const toSelection = useCallback(
    (employee: ContractEmployee): PreviewEmployee => ({
      id: employee.id,
      nombreCompleto: `${employee.nombres} ${employee.apellidos}`.trim(),
      ci: employee.ci,
      fechaIngreso: employee.fechaIngreso,
      estado: employee.estado,
      ...(typeof employee.diasPrueba === 'number'
        ? { diasPrueba: employee.diasPrueba }
        : {}),
      ...(typeof employee.remuneracion === 'number'
        ? { remuneracion: employee.remuneracion }
        : {}),
      ...(areaNames.get(employee.areaId)
        ? { areaNombre: areaNames.get(employee.areaId) }
        : {}),
      ...(cargoNames.get(employee.cargoId)
        ? { cargoNombre: cargoNames.get(employee.cargoId) }
        : {}),
    }),
    [areaNames, cargoNames],
  );

  useEffect(() => {
    loadMoreControllerRef.current?.abort();

    if (!canRead) {
      setResults([]);
      setError(null);
      setLoading(false);
      setMeta(EMPTY_META);
      setPage(1);
      return;
    }

    const nombre = debouncedName.trim();
    const documento = debouncedCi.trim();
    if (!nombre && !documento) {
      setResults([]);
      setError(null);
      setLoading(false);
      setMeta(EMPTY_META);
      setPage(1);
      return;
    }

    const controller = new AbortController();
    const currentRequest = requestIdRef.current + 1;
    requestIdRef.current = currentRequest;
    setLoading(true);
    setError(null);

    const filters: ContractEmployeeFilters = {
      nombre,
      ci: documento,
      page: 1,
      pageSize: EMPLOYEE_SEARCH_PAGE_SIZE,
    };

    employeesApi
      .list(request, filters, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted || requestIdRef.current !== currentRequest) return;
        setResults(result.data);
        setMeta(result.meta);
        setPage(1);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || requestIdRef.current !== currentRequest) return;
        setResults([]);
        setError(reason);
      })
      .finally(() => {
        if (requestIdRef.current === currentRequest) setLoading(false);
      });

    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [canRead, debouncedCi, debouncedName, request]);

  const loadMore = async () => {
    if (!canRead || loading || loadingMore) return;
    const nextPage = page + 1;
    if (meta.totalPages > 0 && nextPage > meta.totalPages) return;

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await employeesApi.list(
        request,
        {
          nombre: debouncedName,
          ci: debouncedCi,
          page: nextPage,
          pageSize: EMPLOYEE_SEARCH_PAGE_SIZE,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setResults((current) => {
        const known = new Set(current.map((employee) => employee.id));
        return [...current, ...result.data.filter((employee) => !known.has(employee.id))];
      });
      setMeta(result.meta);
      setPage(nextPage);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  const selectEmployee = (employee: ContractEmployee) => {
    onChange(toSelection(employee));
    setName('');
    setCi('');
    setResults([]);
    setMeta(EMPTY_META);
    setPage(1);
    setError(null);
  };

  const clearSelection = () => {
    onChange(null);
    setName('');
    setCi('');
    setResults([]);
    setMeta(EMPTY_META);
    setPage(1);
    setError(null);
  };

  const hasQuery = Boolean(name.trim() || ci.trim());
  const canLoadMore = meta.totalPages > page;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Funcionario
          </p>
          <p className="text-xs text-slate-500">
            Busca por nombre o escribe la CI exacta. No se muestran CI ni remuneración.
          </p>
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={disabled}
            aria-label="Quitar funcionario seleccionado"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Quitar
          </Button>
        ) : null}
      </div>

      {!canRead ? (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
        >
          La selección de funcionarios requiere el permiso{' '}
          <code className="font-mono">personal:read</code>. Puedes revisar el contenido con
          marcadores locales, pero no generar la vista previa con datos reales.
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="contrato-employee-name" className="text-xs">
                Nombre o apellidos
              </Label>
              <div className="relative mt-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="contrato-employee-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Ana Rojas"
                  maxLength={100}
                  className="pl-9"
                  disabled={disabled}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="contrato-employee-ci" className="text-xs">
                CI exacta
              </Label>
              <Input
                id="contrato-employee-ci"
                value={ci}
                onChange={(event) => setCi(event.target.value)}
                placeholder="Ej. 12345678 LP"
                maxLength={30}
                className="mt-1"
                disabled={disabled}
                autoComplete="off"
              />
            </div>
          </div>

          {loading ? (
            <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Buscando funcionarios…
            </p>
          ) : null}

          {error ? <ErrorAlert error={error} title="No se pudo buscar funcionarios" /> : null}

          {!loading && !error && hasQuery && results.length === 0 ? (
            <p role="status" className="text-xs text-slate-500">
              No se encontraron funcionarios con esos criterios.
            </p>
          ) : null}

          {!hasQuery && !value ? (
            <p className="text-xs text-slate-500">
              Escribe al menos un nombre o la CI exacta para buscar.
            </p>
          ) : null}

          {results.length > 0 ? (
            <ul
              role="listbox"
              aria-label="Funcionarios encontrados"
              className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {results.map((employee) => {
                const area = areaNames.get(employee.areaId);
                const cargo = cargoNames.get(employee.cargoId);
                const selected = value?.id === employee.id;
                return (
                  <li key={employee.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => selectEmployee(employee)}
                      disabled={disabled}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800',
                        selected && 'bg-blue-50 dark:bg-blue-950/40',
                      )}
                    >
                      <UserRound
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900 dark:text-slate-100">
                          {employee.nombres} {employee.apellidos}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {ESTADO_LABELS[employee.estado] ?? employee.estado}
                          {area && cargo
                            ? ` · ${area} · ${cargo}`
                            : ' · Área y cargo no disponibles'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canLoadMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : null}
              Cargar más ({results.length} de {meta.total})
            </Button>
          ) : null}

          {value ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
            >
              <p className="font-semibold">Funcionario seleccionado: {value.nombreCompleto}</p>
              <p>
                {value.areaNombre && value.cargoNombre
                  ? `${value.areaNombre} · ${value.cargoNombre}`
                  : 'Área y cargo no disponibles: el backend devuelve solo los identificadores.'}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
