'use client';

import { useMemo, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FileDownloadButton } from '@/components/shared/file-download-button';
import { MoneyText } from '@/components/shared/money-text';
import { PeriodText } from '@/components/shared/period-text';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMisPagos } from '@/hooks/use-planillas';
import { isDomainMocked } from '@/lib/api/mock-status';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import type { PagoPlanilla } from '@/lib/api/planillas/types';
import { BoletaPagoDetail } from './boleta-pago-detail';

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function MisBoletasScreen() {
  const { session, request } = useAuth();
  const empleadoId = session?.user.empleadoId ?? null;
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('all');
  const [selectedPago, setSelectedPago] = useState<PagoPlanilla | null>(null);
  const { data, loading, error, reload } = useMisPagos(empleadoId);

  const filtered = useMemo(
    () =>
      data.filter(
        (pago) =>
          pago.periodo.startsWith(`${year}-`) &&
          (month === 'all' || pago.periodo.endsWith(`-${month}`)),
      ),
    [data, month, year],
  );
  const years = useMemo(
    () =>
      [...new Set([String(CURRENT_YEAR), ...data.map((pago) => pago.periodo.slice(0, 4))])].sort(
        (left, right) => Number(right) - Number(left),
      ),
    [data],
  );

  const columns: Array<DataTableColumn<PagoPlanilla>> = [
    {
      id: 'periodo',
      header: 'Periodo',
      cell: (pago) => (
        <PeriodText
          periodo={pago.periodo}
          className="font-medium text-slate-900 dark:text-slate-100"
        />
      ),
    },
    {
      id: 'liquido',
      header: 'Líquido pagable',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (pago) => <MoneyText value={pago.liquidoPagable} className="font-semibold" />,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (pago) => <StatusBadge status={pago.estadoPlanilla} />,
    },
    {
      id: 'acciones',
      header: <span className="sr-only">Acciones</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (pago) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPago(pago)}>
            Ver detalle
          </Button>
          <FileDownloadButton
            download={() =>
              planillasApi.descargarBoletaPropia(request, pago.periodo, empleadoId!)
            }
            defaultFileName={`boleta-${pago.periodo}.pdf`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Mis boletas"
        description="Consulta tus pagos definitivos y descarga la boleta de cada periodo cerrado."
      />

      {!empleadoId ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <h2 className="font-semibold">Tu usuario no está vinculado a un funcionario</h2>
          <p className="mt-1 leading-relaxed">
            Pide a Gestión Humana que vincule tu usuario con tu legajo para consultar tus pagos.
          </p>
        </div>
      ) : (
        <>
          {isDomainMocked('planillas') ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              Estás viendo pagos simulados. Estos importes no provienen de ms-planillas.
            </div>
          ) : null}

          <section
            aria-label="Filtrar pagos por periodo"
            className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Año
              </span>
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="h-9 min-w-32 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Mes
              </span>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 min-w-44 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Todos los meses</option>
                {MONTHS.map((label, index) => (
                  <option key={label} value={String(index + 1).padStart(2, '0')}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setYear(String(CURRENT_YEAR));
                setMonth('all');
              }}
              disabled={year === String(CURRENT_YEAR) && month === 'all'}
            >
              Limpiar filtros
            </Button>
          </section>

          {error ? <ErrorAlert error={error} onRetry={() => void reload()} className="mb-4" /> : null}

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(pago) => pago.id}
            page={1}
            pageSize={Math.max(filtered.length, 1)}
            total={filtered.length}
            loading={loading}
            ariaLabel="Pagos propios por periodo"
            emptyState={
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title={data.length ? 'No hay pagos en este periodo' : 'Aún no tienes pagos cerrados'}
                badge=""
                description={
                  data.length
                    ? 'Prueba con otro año o mes.'
                    : 'Las boletas estarán disponibles cuando Nómina cierre una planilla para tu legajo.'
                }
              />
            }
          />
        </>
      )}

      <Dialog
        open={selectedPago !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPago(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de pago</DialogTitle>
            <DialogDescription>
              {selectedPago ? (
                <>Desglose del periodo <PeriodText periodo={selectedPago.periodo} />.</>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {selectedPago ? <BoletaPagoDetail pago={selectedPago} /> : null}
          <DialogFooter className="gap-2">
            {selectedPago && empleadoId ? (
              <FileDownloadButton
                download={() =>
                  planillasApi.descargarBoletaPropia(
                    request,
                    selectedPago.periodo,
                    empleadoId,
                  )
                }
                defaultFileName={`boleta-${selectedPago.periodo}.pdf`}
              />
            ) : null}
            <Button type="button" variant="outline" onClick={() => setSelectedPago(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
