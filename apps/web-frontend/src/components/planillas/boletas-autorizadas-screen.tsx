'use client';

import { useMemo, useState } from 'react';
import { FileText, ReceiptText } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
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
import { useBoletasAutorizadas, useDetallePlanilla } from '@/hooks/use-planillas';
import { isDomainMocked } from '@/lib/api/mock-status';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import type { PagoPlanilla, PlanillaCabecera, PlanillaListFilters } from '@/lib/api/planillas/types';
import { BoletaPagoDetail } from './boleta-pago-detail';
import { PlanillaPeriodActions } from './planilla-period-actions';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, index) =>
  String(CURRENT_YEAR - index),
);
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
const PLANILLAS_PAGE_SIZE = 12;
const EMPLEADOS_PAGE_SIZE = 25;

export function BoletasAutorizadasScreen() {
  const { session, request } = useAuth();
  const permissions = session?.user.permissions ?? [];
  const canListPlanillas = permissions.includes('planilla:read');
  const canReadAllBoletas = permissions.includes('boleta:read_all');
  const canReadOwnBoleta = permissions.includes('boleta:read_own');
  const canExportPlanillas = permissions.includes('export:data');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedPlanilla, setSelectedPlanilla] = useState<PlanillaCabecera | null>(null);
  const [selectedPago, setSelectedPago] = useState<PagoPlanilla | null>(null);
  const [employeePage, setEmployeePage] = useState(1);

  const filters = useMemo<PlanillaListFilters>(() => {
    const desde = month === 'all' ? `${year}-01` : `${year}-${month}`;
    const hasta = month === 'all' ? `${year}-12` : `${year}-${month}`;
    return { page, pageSize: PLANILLAS_PAGE_SIZE, desde, hasta };
  }, [month, page, year]);

  const planillas = useBoletasAutorizadas(canListPlanillas, filters);
  const pagos = useDetallePlanilla(
    selectedPlanilla?.id ?? null,
    employeePage,
    EMPLEADOS_PAGE_SIZE,
  );

  function handlePlanillaClosed(planilla: PlanillaCabecera) {
    setSelectedPlanilla(planilla);
    setEmployeePage(1);
    const closedYear = planilla.periodo.slice(0, 4);
    const closedMonth = planilla.periodo.slice(5, 7);
    const alreadyFiltered =
      year === closedYear && month === closedMonth && page === 1;
    setYear(closedYear);
    setMonth(closedMonth);
    setPage(1);
    if (alreadyFiltered) void planillas.reload();
  }

  const planillaColumns: Array<DataTableColumn<PlanillaCabecera>> = [
    {
      id: 'periodo',
      header: 'Periodo',
      cell: (planilla) => (
        <PeriodText
          periodo={planilla.periodo}
          className="font-medium text-slate-900 dark:text-slate-100"
        />
      ),
    },
    {
      id: 'funcionarios',
      header: 'Funcionarios',
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (planilla) => planilla.totalEmpleados,
    },
    {
      id: 'liquido',
      header: 'Total líquido',
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (planilla) => <MoneyText value={planilla.totales.liquidoPagable} />,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (planilla) => <StatusBadge status={planilla.estado} />,
    },
    {
      id: 'accion',
      header: <span className="sr-only">Acciones</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (planilla) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPlanilla(planilla);
            setEmployeePage(1);
          }}
        >
          Ver boletas
        </Button>
      ),
    },
    ...(canExportPlanillas && !isDomainMocked('planillas')
      ? [
          {
            id: 'exportar',
            header: 'Exportar',
            cell: (planilla: PlanillaCabecera) => (
              <div className="flex flex-wrap items-center gap-2">
                <FileDownloadButton
                  download={() => planillasApi.exportarPlanilla(request, planilla.id, 'csv')}
                  defaultFileName={`planilla-${planilla.periodo}.csv`}
                  label="Exportar CSV"
                />
                <FileDownloadButton
                  download={() => planillasApi.exportarPlanilla(request, planilla.id, 'xlsx')}
                  defaultFileName={`planilla-${planilla.periodo}.xlsx`}
                  label="Exportar XLSX"
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  const paymentColumns: Array<DataTableColumn<PagoPlanilla>> = [
    {
      id: 'funcionario',
      header: 'Funcionario',
      cell: (pago) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {pago.empleado.nombreCompleto}
          </p>
          {pago.empleado.ciEnmascarado ? (
            <p className="text-xs text-slate-500">{pago.empleado.ciEnmascarado}</p>
          ) : null}
        </div>
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
      id: 'acciones',
      header: <span className="sr-only">Acciones</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (pago) => {
        const canDownload =
          canReadAllBoletas ||
          (canReadOwnBoleta && pago.empleado.empleadoId === session?.user.empleadoId);
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPago(pago)}
            >
              Detalle
            </Button>
            {canDownload ? (
              <FileDownloadButton
                download={() =>
                  planillasApi.descargarBoletaAutorizada(
                    request,
                    pago.planillaId,
                    pago.empleado.empleadoId,
                  )
                }
                defaultFileName={`boleta-${pago.periodo}.pdf`}
              />
            ) : (
              <span className="text-xs text-slate-500">Sin permiso de descarga</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Boletas autorizadas"
        description="Consulta pagos de planillas cerradas y descarga documentos dentro de tu alcance."
      />

      {isDomainMocked('planillas') ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Estás viendo planillas simuladas. Estos datos no provienen de ms-planillas.
        </div>
      ) : null}

      <PlanillaPeriodActions onPlanillaClosed={handlePlanillaClosed} />

      {!canListPlanillas ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-semibold">No tienes permiso para consultar planillas cerradas</h2>
            <p className="mt-1 leading-relaxed">
              Esta vista requiere el permiso planilla:read. La descarga de boletas ajenas además
              requiere boleta:read_all y siempre se valida en el servidor.
            </p>
          </div>
        </div>
      ) : (
        <>
          <section
            aria-label="Filtrar planillas por periodo"
            className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Año
              </span>
              <select
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setPage(1);
                  setSelectedPlanilla(null);
                }}
                className="h-9 min-w-32 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {YEARS.map((option) => (
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
                onChange={(event) => {
                  setMonth(event.target.value);
                  setPage(1);
                  setSelectedPlanilla(null);
                }}
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
                setPage(1);
                setSelectedPlanilla(null);
              }}
              disabled={year === String(CURRENT_YEAR) && month === 'all'}
            >
              Limpiar filtros
            </Button>
          </section>

          {planillas.error ? (
            <ErrorAlert
              error={planillas.error}
              onRetry={() => void planillas.reload()}
              className="mb-4"
            />
          ) : null}
          <DataTable
            columns={planillaColumns}
            rows={planillas.data}
            rowKey={(planilla) => planilla.id}
            page={planillas.meta.page}
            pageSize={planillas.meta.pageSize}
            total={planillas.meta.total}
            onPageChange={setPage}
            loading={planillas.loading}
            ariaLabel="Planillas cerradas"
            emptyState={
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title="No hay planillas cerradas en este periodo"
                badge=""
                description="Las boletas definitivas solo están disponibles después del cierre de Nómina."
              />
            }
          />

          {selectedPlanilla ? (
            <section className="mt-8" aria-labelledby="boletas-planilla-seleccionada">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="boletas-planilla-seleccionada"
                    className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Boletas del periodo <PeriodText periodo={selectedPlanilla.periodo} />
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedPlanilla.totalEmpleados} funcionarios en la planilla cerrada.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPlanilla(null)}
                >
                  Cerrar listado
                </Button>
              </div>
              {pagos.error ? (
                <ErrorAlert
                  error={pagos.error}
                  onRetry={() => void pagos.reload()}
                  className="mb-4"
                />
              ) : null}
              <DataTable
                columns={paymentColumns}
                rows={pagos.data}
                rowKey={(pago) => pago.id}
                page={pagos.meta.page}
                pageSize={pagos.meta.pageSize}
                total={pagos.meta.total}
                onPageChange={setEmployeePage}
                loading={pagos.loading}
                ariaLabel="Boletas autorizadas de funcionarios"
                emptyState={
                  <EmptyState
                    icon={<ReceiptText className="h-6 w-6" />}
                    title="No hay pagos para mostrar"
                    badge=""
                    description="Esta planilla cerrada no devolvió detalles de funcionarios."
                  />
                }
              />
            </section>
          ) : null}
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
            <DialogTitle>Detalle de boleta</DialogTitle>
            <DialogDescription>
              {selectedPago ? (
                <>
                  Desglose de {selectedPago.empleado.nombreCompleto} para el periodo{' '}
                  <PeriodText periodo={selectedPago.periodo} />.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {selectedPago ? <BoletaPagoDetail pago={selectedPago} showEmployee /> : null}
          <DialogFooter>
            {selectedPago &&
            (canReadAllBoletas ||
              (canReadOwnBoleta &&
                selectedPago.empleado.empleadoId === session?.user.empleadoId)) ? (
              <FileDownloadButton
                download={() =>
                  planillasApi.descargarBoletaAutorizada(
                    request,
                    selectedPago.planillaId,
                    selectedPago.empleado.empleadoId,
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
