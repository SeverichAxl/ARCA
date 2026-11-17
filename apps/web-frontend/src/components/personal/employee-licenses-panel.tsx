'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/empty-state';
import { EmployeeCard } from '@/components/personal/employee-components';
import { ErrorAlert } from '@/components/shared/error-alert';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { personalFichaApi, type EmployeeLicense } from '@/lib/api/personal-ficha-api';

const PAGE_SIZE = 20;

const LICENSE_TYPES: Record<string, string> = {
  PATERNIDAD: 'Paternidad',
  MATRIMONIO: 'Matrimonio',
  LUTO: 'Luto',
  ADOPCION: 'Adopción',
  MAMOGRAFIA_PAPANICOLAU: 'Mamografía / Papanicolaou',
  PROSTATICO: 'Examen prostático',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-BO').format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function EmployeeLicensesPanel({ employeeId }: { employeeId: string }) {
  const { request } = useAuth();
  const [licenses, setLicenses] = useState<EmployeeLicense[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await personalFichaApi.listLicenses(request, employeeId, page, PAGE_SIZE);
      setLicenses(result.data);
      setTotalPages(result.meta.totalPages);
      setTotal(result.meta.total);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [employeeId, page, request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <EmployeeCard
      title="Licencias"
      description="Licencias y permisos registrados para el funcionario."
      icon="protection"
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : error ? (
        <ErrorAlert
          error={error}
          title="No se pudieron cargar las licencias"
          onRetry={() => void reload()}
        />
      ) : licenses.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Sin licencias registradas"
          description="No hay licencias registradas para este funcionario."
          badge={null}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table aria-label="Licencias del funcionario">
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>{LICENSE_TYPES[license.tipo] ?? license.tipo}</TableCell>
                    <TableCell>{formatDate(license.fechaInicio)}</TableCell>
                    <TableCell>{formatDate(license.fechaFin)}</TableCell>
                    <TableCell>
                      <StatusBadge status={license.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="caption-small text-muted-foreground">
              {total} {total === 1 ? 'licencia' : 'licencias'}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <span className="caption-small text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </EmployeeCard>
  );
}
