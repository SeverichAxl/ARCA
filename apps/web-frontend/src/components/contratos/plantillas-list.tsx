'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Archive,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorAlert } from '@/components/shared/error-alert';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth/auth-provider';
import { usePlantillas } from '@/hooks/use-contratos';
import { contratosApi } from '@/lib/api/contratos/contratos-api';
import { formatDateTime } from '@/lib/api/contratos/format';
import type {
  PlantillaListFilters,
  PlantillaResumen,
} from '@/lib/api/contratos/types';
import { isDomainMocked } from '@/lib/api/mock-status';

const PAGE_SIZE = 20;

type ActivaFilter = 'all' | 'true' | 'false';

export function PlantillasList() {
  const { request, session } = useAuth();
  const canManage =
    session?.user.permissions.includes('contrato:template_manage') ?? false;

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [activaFilter, setActivaFilter] = useState<ActivaFilter>('all');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    row: PlantillaResumen;
    action: 'archive' | 'reactivate';
  } | null>(null);

  const filters = useMemo<PlantillaListFilters>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      q: query || undefined,
      activa: activaFilter === 'all' ? undefined : activaFilter === 'true',
    }),
    [activaFilter, page, query],
  );

  const { data, meta, loading, error, reload } = usePlantillas(filters);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setActivaFilter('all');
    setPage(1);
  };

  const duplicate = async (row: PlantillaResumen) => {
    setBusyId(row.id);
    setActionError(null);
    setNotice(null);
    try {
      await contratosApi.duplicatePlantilla(request, row.id);
      setNotice(`Se creó una copia de "${row.nombre}".`);
      await reload();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setBusyId(null);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    setBusyId(confirm.row.id);
    setActionError(null);
    setNotice(null);
    try {
      if (confirm.action === 'archive') {
        await contratosApi.archivePlantilla(request, confirm.row.id);
        setNotice(`La plantilla "${confirm.row.nombre}" quedó archivada.`);
      } else {
        await contratosApi.reactivatePlantilla(request, confirm.row.id);
        setNotice(`La plantilla "${confirm.row.nombre}" volvió a estar activa.`);
      }
      setConfirm(null);
      await reload();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setBusyId(null);
    }
  };

  const columns: Array<DataTableColumn<PlantillaResumen>> = [
    {
      id: 'nombre',
      header: 'Plantilla',
      cell: (row) => (
        <div className="min-w-[220px]">
          <Link
            href={`/contratos/plantillas/${row.id}`}
            className="font-medium text-slate-900 underline-offset-4 hover:text-blue-700 hover:underline dark:text-slate-100"
          >
            {row.nombre}
          </Link>
          {row.descripcion ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.descripcion}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (row) => <StatusBadge status={row.activa ? 'activa' : 'inactiva'} />,
    },
    {
      id: 'version',
      header: 'Versión',
      cell: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          v{row.versionActual}
        </span>
      ),
    },
    {
      id: 'actualizado',
      header: 'Actualizada',
      cell: (row) => (
        <span className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          {formatDateTime(row.actualizadoEn)}
        </span>
      ),
    },
    {
      id: 'acciones',
      header: <span className="sr-only">Acciones</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`/contratos/plantillas/${row.id}`}
              aria-label={`Abrir plantilla ${row.nombre}`}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {canManage ? 'Abrir' : 'Ver'}
            </Link>
          </Button>

          {canManage ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void duplicate(row)}
                disabled={busyId === row.id}
                aria-label={`Duplicar plantilla ${row.nombre}`}
              >
                {busyId === row.id ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
                Duplicar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirm({
                    row,
                    action: row.activa ? 'archive' : 'reactivate',
                  })
                }
                disabled={busyId === row.id}
                aria-label={
                  row.activa
                    ? `Archivar plantilla ${row.nombre}`
                    : `Reactivar plantilla ${row.nombre}`
                }
              >
                {row.activa ? (
                  <Archive aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                )}
                {row.activa ? 'Archivar' : 'Reactivar'}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(query) || activaFilter !== 'all';

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Plantillas de contrato"
        description="Administra los modelos WYSIWYG y las variables que el backend sustituye al generar contratos."
      >
        <PermissionGate anyOf={['contrato:template_manage']}>
          <Button asChild className="h-10 gap-2">
            <Link href="/contratos/plantillas/nueva">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Nueva plantilla
            </Link>
          </Button>
        </PermissionGate>
      </PageHeader>

      {isDomainMocked('contratos') ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Estás viendo datos simulados de contratos. Los cambios se conservan solo durante esta
          sesión del navegador.
        </div>
      ) : null}

      <form
        onSubmit={applySearch}
        className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-[minmax(220px,1fr)_180px_auto_auto]"
      >
        <label className="relative block">
          <span className="sr-only">Buscar plantillas por nombre</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nombre"
            className="pl-9"
            maxLength={120}
          />
        </label>

        <label className="block">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={activaFilter}
            onChange={(event) => {
              setActivaFilter(event.target.value as ActivaFilter);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">Todos los estados</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </label>

        <Button type="submit">Buscar</Button>
        <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasFilters}>
          Limpiar
        </Button>
      </form>

      {error ? <ErrorAlert error={error} onRetry={() => void reload()} className="mb-4" /> : null}
      {actionError ? <ErrorAlert error={actionError} className="mb-4" /> : null}
      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        onPageChange={setPage}
        loading={loading}
        ariaLabel="Listado de plantillas de contrato"
        caption="Plantillas de contrato disponibles"
        emptyState={
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={hasFilters ? 'No se encontraron plantillas' : 'Todavía no hay plantillas'}
            description={
              hasFilters
                ? 'Prueba con otro nombre o cambia el filtro de estado.'
                : 'Crea la primera plantilla para reutilizar cláusulas y variables en los contratos.'
            }
            badge={null}
            action={
              canManage && !hasFilters ? (
                <Button asChild>
                  <Link href="/contratos/plantillas/nueva">
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Crear plantilla
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.action === 'archive' ? 'Archivar plantilla' : 'Reactivar plantilla'}
        description={
          confirm?.action === 'archive' ? (
            <>
              La plantilla <strong>{confirm?.row.nombre}</strong> dejará de estar disponible para
              nuevos contratos. Las versiones históricas se conservan.
            </>
          ) : (
            <>
              La plantilla <strong>{confirm?.row.nombre}</strong> volverá a estar disponible para
              generar contratos.
            </>
          )
        }
        confirmLabel={confirm?.action === 'archive' ? 'Archivar' : 'Reactivar'}
        onConfirm={() => void confirmAction()}
        loading={busyId !== null}
        destructive={confirm?.action === 'archive'}
      />
    </div>
  );
}
