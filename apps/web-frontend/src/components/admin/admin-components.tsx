import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { UserStatus } from '@/lib/admin-api';

export function AdminPageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="caption-small mb-2 font-semibold uppercase tracking-wider text-secondary">
            {eyebrow}
          </p>
        )}
        <h1 className="heading-h1">{title}</h1>
        <p className="body-default mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="caption-small text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-card-foreground">{value}</p>
      {description && <p className="caption-small mt-1 text-muted-foreground">{description}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVO: 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
    INACTIVO: 'bg-muted text-muted-foreground',
    BLOQUEADO: 'bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]',
  };
  const labels: Record<UserStatus, string> = {
    ACTIVO: 'Activo',
    INACTIVO: 'Inactivo',
    BLOQUEADO: 'Bloqueado manual',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 caption-small font-medium ${styles[status]}`}>
      {status === 'ACTIVO' && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {labels[status]}
    </span>
  );
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * 20 + 1;
  const last = Math.min(page * 20, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="caption-small text-muted-foreground">
        Mostrando {first}–{last} de {total} registros
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="caption-small min-w-20 text-center text-muted-foreground">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-[hsl(var(--danger)/0.25)] bg-[hsl(var(--danger-bg))] px-4 py-3 body-default text-[hsl(var(--danger))]"
    >
      {message}
    </div>
  );
}
