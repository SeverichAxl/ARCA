'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/empty-state';
import { EmployeeCard } from '@/components/personal/employee-components';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FileDownloadButton } from '@/components/shared/file-download-button';
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
import { personalFichaApi, type EmployeePayslip } from '@/lib/api/personal-ficha-api';
import { planillasApi } from '@/lib/api/planillas/planillas-api';

const PAGE_SIZE = 20;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-BO').format(new Date(value));
}

function formatPeriod(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

export function EmployeePayslipsPanel({ employeeId }: { employeeId: string }) {
  const { request } = useAuth();
  const [payslips, setPayslips] = useState<EmployeePayslip[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await personalFichaApi.listPayslips(request, employeeId, page, PAGE_SIZE);
      setPayslips(result.data);
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
      title="Boletas de pago"
      description="Boletas disponibles de planillas cerradas para el funcionario."
      icon="work"
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : error ? (
        <ErrorAlert
          error={error}
          title="No se pudieron cargar las boletas"
          onRetry={() => void reload()}
        />
      ) : payslips.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title="Sin boletas disponibles"
          description="Las boletas aparecerán cuando exista una planilla cerrada para este funcionario."
          badge={null}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table aria-label="Boletas del funcionario">
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Documento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => (
                  <TableRow key={payslip.planillaId}>
                    <TableCell className="font-medium capitalize">
                      {formatPeriod(payslip.periodo)}
                    </TableCell>
                    <TableCell>{formatDate(payslip.emitidaEn)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={payslip.estado ?? 'DISPONIBLE'}
                        label={
                          payslip.estado === 'ANULADA'
                            ? 'Anulada'
                            : payslip.estado === 'EMITIDA'
                              ? 'Emitida'
                              : 'Disponible'
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {payslip.estado === 'ANULADA' ? (
                        <span className="text-xs text-muted-foreground">
                          Documento anulado
                        </span>
                      ) : (
                        <FileDownloadButton
                          download={() =>
                            planillasApi.descargarBoletaAutorizada(
                              request,
                              payslip.planillaId,
                              employeeId,
                            )
                          }
                          defaultFileName={`boleta-${payslip.periodo}.pdf`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="caption-small text-muted-foreground">
              {total} {total === 1 ? 'boleta' : 'boletas'}
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
