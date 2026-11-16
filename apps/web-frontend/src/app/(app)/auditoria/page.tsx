'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AdminPageTitle,
  ErrorBanner,
  PaginationControls,
} from '@/components/admin/admin-components';
import { useAuth } from '@/components/auth/auth-provider';
import { adminApi, type AuditEntry, type AdminUser, type PageMeta } from '@/lib/admin-api';
import { AUTH_MODE } from '@/lib/auth';

const PAGE_SIZE = 20;
const INITIAL_META: PageMeta = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };
const MODULES = [
  ['auth', 'Usuarios y seguridad'],
  ['personal', 'Personal'],
  ['vacaciones', 'Vacaciones'],
  ['contratos', 'Contratos'],
  ['planillas', 'Planillas'],
  ['transversal', 'Transversal'],
] as const;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function usuarioDetalle(entry: AuditEntry, mockUsers: AdminUser[]): string {
  const esSistema = entry.usuarioId === null;
  return entry.usuarioNombre ?? (esSistema ? 'Sistema' : (entry.usuarioId ?? ''));
}

function prettyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2) ?? 'Sin detalle de payload.';
  } catch {
    return 'No se pudo representar el payload.';
  }
}

function AuditResultBadge({ value }: { value: string }) {
  const positive = /(EXITO|SUCCESS|OK|CREADO|ACTUALIZADO)/i.test(value);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 caption-small font-medium ${
        positive
          ? 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]'
          : 'border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]'
      }`}
    >
      {value}
    </span>
  );
}

function AuditDetailItem({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="eyebrow text-[10px] text-muted-foreground">{label}</dt>
      <dd className={`mt-1.5 body-default text-card-foreground ${mono ? 'mono-hash' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function AuditEntryRow({
  entry,
  nombre,
  isExpanded,
  onToggle,
}: {
  entry: AuditEntry;
  nombre: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow key={entry.id}>
        <TableCell className="whitespace-nowrap px-4 caption-small text-muted-foreground">
          {formatDate(entry.ocurridoEn)}
        </TableCell>
        <TableCell className="body-default text-card-foreground">
          <span className="block font-medium">{nombre}</span>
        </TableCell>
        <TableCell className="caption-small text-muted-foreground">
          {entry.ipOrigen ?? '—'}
        </TableCell>
        <TableCell>
          <span className="rounded-full bg-accent px-2.5 py-1 caption-small font-medium text-accent-foreground">
            {entry.modulo}
          </span>
        </TableCell>
        <TableCell className="max-w-sm">
          <span className="block truncate mono-hash text-card-foreground" title={entry.accion}>
            {entry.metodo ? `${entry.metodo} ` : ''}
            {entry.recurso ?? entry.accion}
          </span>
          <span className="caption-small text-muted-foreground">{entry.accion}</span>
        </TableCell>
        <TableCell className="text-right w-12">
          <button
            type="button"
            aria-label={
              isExpanded ? `Ocultar detalle de ${nombre}` : `Mostrar detalle de ${nombre}`
            }
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card text-foreground hover:bg-muted transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isExpanded ? 'Ocultar detalle de entrada' : 'Mostrar detalle de entrada'}
            </span>
          </button>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow key={`${entry.id}-detalle`} className="border-b border-border bg-muted/20">
          <TableCell colSpan={6} className="p-2">
            <div className="overflow-hidden rounded-lg border border-border border-l-2 border-l-primary/50 bg-card shadow-[0_14px_34px_-28px_rgba(0,0,0,0.95)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/40 px-4 py-3">
                <span className="inline-flex items-center gap-2 body-medium text-card-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Detalle del evento
                </span>
                <span className="mono-hash caption-small text-muted-foreground">{entry.eventId}</span>
              </div>
              <dl className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <AuditDetailItem label="Usuario" value={nombre} />
                <AuditDetailItem
                  label="Módulo"
                  value={
                    <span className="rounded-full bg-accent px-2.5 py-1 caption-small font-medium text-accent-foreground">
                      {entry.modulo}
                    </span>
                  }
                />
                <AuditDetailItem label="Resultado" value={<AuditResultBadge value={entry.resultado} />} />
                <AuditDetailItem label="IP de origen" value={entry.ipOrigen ?? '—'} mono />
                <AuditDetailItem
                  label="Acción"
                  value={entry.accion}
                  className="sm:col-span-2"
                />
                <AuditDetailItem
                  label="Recurso"
                  value={entry.metodo ? `${entry.metodo} ${entry.recurso ?? '—'}` : (entry.recurso ?? '—')}
                  mono
                  className="sm:col-span-2 break-all"
                />
              </dl>
              <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                <p className="eyebrow text-[10px] text-muted-foreground">
                  Payload (antes / después)
                </p>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border/80 bg-background/70 p-3 mono-hash text-xs leading-5 text-foreground/90">
                  {prettyPayload(entry.payload)}
                </pre>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditPage() {
  const { request } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [mockUsers, setMockUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState(INITIAL_META);
  const [userIdInput, setUserIdInput] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [moduleInput, setModuleInput] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [untilInput, setUntilInput] = useState('');
  const [untilFilter, setUntilFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.listAudit(request, {
        usuarioId: userIdFilter,
        modulo: moduleFilter,
        desde: fromFilter,
        hasta: untilFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setEntries(result.data);
      setMeta(result.meta);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cargar el registro de auditoría.',
      );
    } finally {
      setLoading(false);
    }
  }, [fromFilter, moduleFilter, page, request, untilFilter, userIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (AUTH_MODE !== 'mock') return;
    void adminApi
      .listUsers(request, {
        q: '',
        estado: '',
        rol: '',
        page: 1,
        pageSize: 100,
      })
      .then((result) => setMockUsers(result.data))
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : 'No se pudieron cargar usuarios de prueba.',
        );
      });
  }, [request]);

  const modulesInResults = useMemo(() => new Set(entries.map((entry) => entry.modulo)), [entries]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fromInput && untilInput && fromInput > untilInput) {
      setError('El rango de fechas no es válido: la fecha inicial debe ser anterior a la final.');
      return;
    }
    setPage(1);
    setUserIdFilter(userIdInput.trim());
    setModuleFilter(moduleInput);
    setFromFilter(fromInput);
    setUntilFilter(untilInput);
  };

  const clearFilters = () => {
    setUserIdInput('');
    setUserIdFilter('');
    setModuleInput('');
    setModuleFilter('');
    setFromInput('');
    setFromFilter('');
    setUntilInput('');
    setUntilFilter('');
    setPage(1);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageTitle
        eyebrow="Solo lectura"
        title="Registro de auditoría"
        description="Consulta el historial inmutable de actividad del sistema."
        action={
          <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 caption-small text-muted-foreground">
            <LockKeyhole className="h-4 w-4 text-secondary" />
            Vista AUDITOR
          </div>
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: se muestran eventos de ejemplo; el historial no permite edición ni eliminación.
        </div>
      )}
      {error && <ErrorBanner message={error} />}

      <form
        onSubmit={applyFilters}
        className="mb-4 grid gap-4 rounded-lg border border-border bg-card p-4 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_auto_auto]"
      >
        <label className="block space-y-1.5">
          <span className="caption-small font-medium text-muted-foreground">
            {AUTH_MODE === 'mock' ? 'Usuario' : 'Usuario (ID)'}
          </span>
          {AUTH_MODE === 'mock' ? (
            <select
              value={userIdInput}
              onChange={(event) => setUserIdInput(event.target.value)}
              aria-label="Filtrar por usuario"
              className="h-10 w-full rounded-md border border-input bg-card px-3 body-default"
            >
              <option value="">Todos los usuarios</option>
              {mockUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={userIdInput}
              onChange={(event) => setUserIdInput(event.target.value)}
              placeholder="UUID del usuario"
              aria-label="Filtrar por usuario"
            />
          )}
        </label>
        <label className="block space-y-1.5">
          <span className="caption-small font-medium text-muted-foreground">Módulo</span>
          <select
            value={moduleInput}
            onChange={(event) => setModuleInput(event.target.value)}
            aria-label="Filtrar por módulo"
            className="h-10 w-full rounded-md border border-input bg-card px-3 body-default"
          >
            <option value="">Todos los módulos</option>
            {MODULES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {[...modulesInResults]
              .filter((module) => !MODULES.some(([moduleValue]) => module === moduleValue))
              .map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="caption-small font-medium text-muted-foreground">Desde</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={fromInput}
              onChange={(event) => setFromInput(event.target.value)}
              className="pl-9"
              aria-label="Fecha inicial"
            />
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="caption-small font-medium text-muted-foreground">Hasta</span>
          <span className="relative block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={untilInput}
              onChange={(event) => setUntilInput(event.target.value)}
              className="pl-9"
              aria-label="Fecha final"
            />
          </span>
        </label>
        <div className="flex items-end">
          <Button type="submit" className="w-full xl:w-auto">
            Aplicar filtros
          </Button>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Limpiar
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableHead className="whitespace-nowrap px-4">Fecha y hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>IP de origen</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="text-right w-12">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  Cargando eventos de auditoría…
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  No hay eventos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const nombre = usuarioDetalle(entry, mockUsers);
                const isExpanded = expandedId === entry.id;
                return (
                  <AuditEntryRow
                    key={entry.id}
                    entry={entry}
                    nombre={nombre}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : entry.id)}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </section>

      <p className="caption-small mt-3 text-muted-foreground">
        Mostrando {entries.length} de {meta.total} registros. El registro es de solo lectura y
        conserva el payload enmascarado recibido del servidor.
      </p>
    </div>
  );
}
