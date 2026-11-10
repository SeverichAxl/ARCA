'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ReceiptText,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorAlert } from '@/components/shared/error-alert';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { MoneyText } from '@/components/shared/money-text';
import { PeriodText } from '@/components/shared/period-text';
import { FileDownloadButton } from '@/components/shared/file-download-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { useBoletaDetalle, useMisBoletas } from '@/hooks/use-planillas';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import { resolveBoletaErrorMessage } from '@/lib/api/planillas/errors';
import { isDomainMocked } from '@/lib/api/mock-status';
import { copyTextToClipboard } from '@/lib/clipboard';
import {
  formatDateTimeInBolivia,
  formatDateInBolivia,
  formatPeriodo,
  MESES_ES,
} from '@/lib/format/period';
import type {
  Boleta,
  BoletaDesglose,
  BoletaDetalle,
  BoletaListFilters,
} from '@/lib/api/planillas/types';

const PAGE_SIZE = 10;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTH_OPTIONS = MESES_ES.map((label, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label,
}));

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className={strong ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}>
        {label}
      </dt>
      <dd>
        <MoneyText value={value} className={strong ? 'font-semibold' : undefined} />
      </dd>
    </div>
  );
}

function DesglosePanel({ desglose }: { desglose: BoletaDesglose }) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="boleta-haberes">
        <h3 id="boleta-haberes" className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Haberes
        </h3>
        <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3 dark:divide-slate-700 dark:border-slate-700">
          <DetailRow label="Haber básico" value={desglose.haberBasico} />
          <DetailRow label="Bono de antigüedad" value={desglose.bonoAntiguedad} />
          <DetailRow label="Horas extra" value={desglose.horasExtra} />
          <DetailRow label="Otros ingresos" value={desglose.otrosIngresos} />
          <DetailRow label="Total ganado" value={desglose.totalGanado} strong />
        </dl>
      </section>

      <section aria-labelledby="boleta-descuentos">
        <h3
          id="boleta-descuentos"
          className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          Descuentos
        </h3>
        <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3 dark:divide-slate-700 dark:border-slate-700">
          <DetailRow label="Aportes de ley" value={desglose.aporteLaboral} />
          <DetailRow label="ANS" value={desglose.ans} />
          <DetailRow label="RC-IVA" value={desglose.rcIva} />
          <DetailRow label="Otros descuentos" value={desglose.otrosDescuentos} />
          <DetailRow label="Total descuentos" value={desglose.totalDescuentos} strong />
        </dl>
      </section>

      <section className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Líquido pagable
          </span>
          <MoneyText
            value={desglose.liquidoPagable}
            className="text-base font-semibold text-blue-900 dark:text-blue-100"
          />
        </div>
      </section>

      <section aria-labelledby="boleta-informativos">
        <h3
          id="boleta-informativos"
          className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          Informativos
        </h3>
        <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3 dark:divide-slate-700 dark:border-slate-700">
          <DetailRow label="Aporte patronal (empleador)" value={desglose.aportePatronal} />
        </dl>
        {desglose.subsidiosInformativos.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {desglose.subsidiosInformativos.map((subsidio) => (
              <li key={subsidio.concepto} className="flex items-center justify-between gap-3">
                <span>{subsidio.concepto}</span>
                <MoneyText value={subsidio.monto} />
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Los subsidios y el aporte patronal son informativos: no modifican el líquido pagable.
        </p>
      </section>
    </div>
  );
}

function BoletaDetallePanel({
  boleta,
  hashCopied,
  copyError,
  onCopyHash,
}: {
  boleta: BoletaDetalle;
  hashCopied: boolean;
  copyError: boolean;
  onCopyHash: () => void;
}) {
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Periodo</dt>
          <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            <PeriodText periodo={boleta.periodo} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</dt>
          <dd className="mt-0.5">
            <StatusBadge status={boleta.estado ?? 'EMITIDA'} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Líquido pagable
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">
            <MoneyText value={boleta.liquidoPagable} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Fecha de emisión
          </dt>
          <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
            {formatDateTimeInBolivia(boleta.emitidaEn)}
          </dd>
        </div>
      </dl>

      {boleta.desglose ? (
        <DesglosePanel desglose={boleta.desglose} />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          El contrato de backend no publica el desglose completo en la boleta; se muestran los
          metadatos disponibles.
        </p>
      )}

      <section aria-labelledby="boleta-hash">
        <h3 id="boleta-hash" className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Hash SHA-256
        </h3>
        <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {boleta.hashSha256}
        </code>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopyHash}>
            {hashCopied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {hashCopied ? 'Hash copiado' : 'Copiar hash'}
          </Button>
          {hashCopied ? (
            <span role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
              Hash copiado al portapapeles.
            </span>
          ) : null}
          {copyError ? (
            <span role="alert" className="text-xs text-red-700 dark:text-red-300">
              No se pudo copiar. Selecciona el hash manualmente.
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DetailError({ error }: { error: unknown }) {
  const resolved = resolveBoletaErrorMessage(error);
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{resolved.message}</p>
        {!resolved.hideDetails && (resolved.code || resolved.traceId) ? (
          <p className="mt-1 break-all text-xs opacity-80">
            {resolved.code ? `Código: ${resolved.code}` : null}
            {resolved.code && resolved.traceId ? ' · ' : null}
            {resolved.traceId ? `traceId: ${resolved.traceId}` : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MobilePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      aria-label="Paginación de boletas"
      className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300"
    >
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
      <span>
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
  );
}

export function MisBoletasScreen() {
  const { session, request } = useAuth();
  const empleadoId = session?.user.empleadoId ?? null;

  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hashCopied, setHashCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const filters = useMemo<BoletaListFilters>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      periodo: month === 'all' ? undefined : `${year}-${month}`,
    }),
    [month, page, year],
  );

  const { data, meta, loading, error, reload } = useMisBoletas(empleadoId, filters);
  const detail = useBoletaDetalle(selectedId, empleadoId);

  const resetDetailState = () => {
    setSelectedId(null);
    setHashCopied(false);
    setCopyError(false);
  };

  const openDetail = (id: string) => {
    setHashCopied(false);
    setCopyError(false);
    setSelectedId(id);
  };

  const copyHash = async () => {
    const hash = detail.boleta?.hashSha256;
    if (!hash) return;
    setHashCopied(false);
    setCopyError(false);
    const copied = await copyTextToClipboard(hash);
    if (copied) setHashCopied(true);
    else setCopyError(true);
  };

  if (!empleadoId) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Mis boletas"
          description="Consulta y descarga tus boletas de pago por periodo."
        />
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Tu usuario no está vinculado a un funcionario
            </h2>
            <p className="mt-1 leading-relaxed">
              Pide a Gestión Humana que vincule tu usuario con tu legajo para consultar tus
              boletas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const columns: Array<DataTableColumn<Boleta>> = [
    {
      id: 'periodo',
      header: 'Periodo',
      cell: (row) => (
        <PeriodText
          periodo={row.periodo}
          className="font-medium text-slate-900 dark:text-slate-100"
        />
      ),
    },
    {
      id: 'liquido',
      header: 'Líquido pagable',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (row) => <MoneyText value={row.liquidoPagable} className="font-semibold" />,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: (row) => <StatusBadge status={row.estado ?? 'EMITIDA'} />,
    },
    {
      id: 'emitida',
      header: 'Fecha de emisión',
      cell: (row) => (
        <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
          {formatDateInBolivia(row.emitidaEn)}
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openDetail(row.id)}
            aria-label={`Ver detalle de la boleta de ${formatPeriodo(row.periodo)}`}
          >
            Ver detalle
          </Button>
          <FileDownloadButton
            download={() => planillasApi.descargarBoletaPdf(request, row.id, empleadoId)}
            defaultFileName={`boleta-${row.periodo}.pdf`}
            className="items-end"
          />
        </div>
      ),
    },
  ];

  const hasFilters = month !== 'all';

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Mis boletas"
        description="Consulta y descarga tus boletas de pago por periodo."
      />

      {isDomainMocked('planillas') ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Estás viendo boletas simuladas de planillas. No uses estos importes para decisiones
          reales.
        </div>
      ) : null}

      <section
        aria-labelledby="filtros-boletas"
        className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="filtros-boletas" className="sr-only">
          Filtros de boletas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_240px_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Año
            </span>
            <select
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {YEARS.map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Periodo
            </span>
            <select
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todos los periodos</option>
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setYear(String(CURRENT_YEAR));
                setMonth('all');
                setPage(1);
              }}
              disabled={!hasFilters && year === String(CURRENT_YEAR)}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          El año acota los periodos disponibles; el mes define el periodo consultado.
        </p>
      </section>

      {error ? (
        <ErrorAlert error={error} onRetry={() => void reload()} className="mb-4" />
      ) : null}

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title="Aún no tienes boletas emitidas"
          description={
            hasFilters
              ? 'No hay boletas emitidas para el periodo seleccionado.'
              : 'Cuando nómina emita tus boletas, aparecerán aquí para consulta y descarga.'
          }
          badge={null}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={data}
              rowKey={(row) => row.id}
              page={meta.page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={setPage}
              ariaLabel="Listado de mis boletas de pago"
              caption="Boletas de pago del funcionario autenticado"
            />
          </div>

          <div className="space-y-3 md:hidden">
            <ul className="space-y-3" aria-label="Mis boletas de pago">
              {data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <PeriodText
                        periodo={row.periodo}
                        className="font-semibold text-slate-900 dark:text-slate-100"
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Emitida: {formatDateInBolivia(row.emitidaEn)}
                      </p>
                    </div>
                    <StatusBadge status={row.estado ?? 'EMITIDA'} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Líquido pagable
                    </span>
                    <MoneyText
                      value={row.liquidoPagable}
                      className="text-base font-semibold text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(row.id)}
                      aria-label={`Ver detalle de la boleta de ${formatPeriodo(row.periodo)}`}
                    >
                      Ver detalle
                    </Button>
                    <FileDownloadButton
                      download={() =>
                        planillasApi.descargarBoletaPdf(request, row.id, empleadoId)
                      }
                      defaultFileName={`boleta-${row.periodo}.pdf`}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <MobilePagination
              page={meta.page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) resetDetailState();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de boleta</DialogTitle>
            <DialogDescription>
              {detail.boleta ? (
                <>
                  Boleta del periodo <PeriodText periodo={detail.boleta.periodo} />.
                </>
              ) : (
                'Consulta los datos de la boleta seleccionada.'
              )}
            </DialogDescription>
          </DialogHeader>

          {detail.loading ? (
            <LoadingSkeleton variant="form" />
          ) : detail.error ? (
            <DetailError error={detail.error} />
          ) : detail.boleta ? (
            <BoletaDetallePanel
              boleta={detail.boleta}
              hashCopied={hashCopied}
              copyError={copyError}
              onCopyHash={() => void copyHash()}
            />
          ) : null}

          <DialogFooter className="gap-2">
            {detail.boleta ? (
              <FileDownloadButton
                download={() =>
                  planillasApi.descargarBoletaPdf(request, detail.boleta!.id, empleadoId)
                }
                defaultFileName={`boleta-${detail.boleta.periodo}.pdf`}
              />
            ) : null}
            <Button type="button" variant="outline" onClick={resetDetailState}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
