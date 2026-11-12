'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

/**
 * Tabla con paginación del servidor.
 * El servidor decide `page`, `pageSize` y `total`; la UI solo calcula páginas.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
  emptyState,
  caption,
  ariaLabel,
  className,
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  emptyState?: React.ReactNode;
  caption?: string;
  ariaLabel: string;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  if (loading) {
    return <LoadingSkeleton variant="table" rows={Math.min(pageSize, 8)} className={className} />;
  }

  if (total === 0) {
    return <>{emptyState ?? <p className="text-sm text-slate-500">No hay datos para mostrar.</p>}</>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table aria-label={ariaLabel}>
          {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50 dark:bg-slate-950">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cn(
                    'px-4 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={cn('px-4 py-3', column.className)}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          Mostrando <span className="font-medium text-slate-700 dark:text-slate-200">{firstRow}</span>
          {'–'}
          <span className="font-medium text-slate-700 dark:text-slate-200">{lastRow}</span> de{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
        </p>

        {onPageChange && total > pageSize ? (
          <nav className="flex items-center gap-2" aria-label="Paginación de resultados">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Anterior
            </Button>
            <span className="px-1 text-xs text-slate-600 dark:text-slate-300">
              Página {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
