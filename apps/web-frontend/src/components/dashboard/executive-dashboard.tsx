'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardQuickLinks } from '@/components/dashboard/dashboard-quick-links';
import { PageTransition } from '@/components/fade-in';
import { getExecutiveDashboard, type ExecutiveDashboardData } from '@/lib/dashboard-api';

const MONTH_OPTIONS = [12, 24, 36] as const;

const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const periodLabel = new Intl.DateTimeFormat('es-BO', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

function formatPeriod(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return periodLabel.format(new Date(Date.UTC(year, month - 1, 1)));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function ExecutiveDashboard() {
  const { request, session } = useAuth();
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<(typeof MONTH_OPTIONS)[number]>(12);

  const reload = useCallback(async () => {
    if (session?.mode !== 'api') {
      setData(null);
      setError('El dashboard ejecutivo requiere datos reales del API; no se muestran datos de demostración.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setData(await getExecutiveDashboard(request));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las métricas ejecutivas.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [request, session?.mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const payrollPeriods = useMemo(
    () => data?.payrollPeriods.slice(-months) ?? [],
    [data?.payrollPeriods, months],
  );
  const latestPayroll = payrollPeriods.at(-1);

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              ARCA / Gestión humana
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Dashboard ejecutivo
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Personal, protección laboral y costo salarial a partir de los cierres reales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading || session?.mode !== 'api'}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar datos
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-start"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo completar la carga del dashboard.</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        <section
          aria-label="Indicadores ejecutivos"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Empleados activos"
            value={loading ? '…' : data ? data.activeEmployees.toLocaleString('es-BO') : '—'}
            detail="En prueba y ratificados · servicio de personal"
            icon={Users}
            accent="bg-blue-600"
          />
          <MetricCard
            label="Costo salarial"
            value={loading ? '…' : latestPayroll ? currency.format(latestPayroll.costoTotal) : '—'}
            detail={latestPayroll ? `Último cierre · ${formatPeriod(latestPayroll.periodo)}` : 'Sin planillas cerradas en el rango'}
            icon={CircleDollarSign}
            accent="bg-cyan-600"
          />
          <MetricCard
            label="Vacaciones activas"
            value="No disponible"
            detail="El API actual no expone un agregado de vacaciones aprobadas vigentes."
            icon={CalendarDays}
            accent="bg-amber-500"
          />
          <MetricCard
            label="Inamovilidades activas"
            value={loading ? '…' : data ? data.activeJobProtections.toLocaleString('es-BO') : '—'}
            detail="Conteo filtrado por vigencia · servicio de personal"
            icon={ShieldCheck}
            accent="bg-violet-600"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
                Registro de planillas cerradas
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Costo de nómina</h2>
              <p className="mt-1 text-sm text-slate-400">
                Total ganado y aportes patronales · importes en bolivianos
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              Periodo
              <select
                aria-label="Rango del gráfico de costo salarial"
                value={months}
                onChange={(event) => setMonths(Number(event.target.value) as (typeof MONTH_OPTIONS)[number])}
                className="min-h-9 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Últimos {option} meses
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="px-3 py-5 sm:px-6">
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-slate-400" role="status">
                Cargando cierres salariales…
              </div>
            ) : error ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-slate-400">
                El gráfico no está disponible hasta recuperar los datos de planillas.
              </div>
            ) : payrollPeriods.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-slate-400">
                No hay planillas cerradas en el rango seleccionado.
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payrollPeriods} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                    <CartesianGrid vertical={false} stroke="#253247" />
                    <XAxis
                      dataKey="periodo"
                      tickFormatter={formatPeriod}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value: number) => new Intl.NumberFormat('es-BO', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(value)}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      labelFormatter={(label) => formatPeriod(String(label))}
                      formatter={(value) => currency.format(Number(value))}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                      }}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    />
                    <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
                    <Bar
                      dataKey="totalGanado"
                      name="Total ganado"
                      stackId="costo"
                      fill="#38bdf8"
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="totalAportesPatronales"
                      name="Aportes patronales"
                      stackId="costo"
                      fill="#818cf8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <p className="border-t border-white/10 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:px-7">
            Fuente: planillas cerradas · máximo de consulta: 36 meses
          </p>
        </section>

        <DashboardQuickLinks />
      </div>
    </PageTransition>
  );
}
