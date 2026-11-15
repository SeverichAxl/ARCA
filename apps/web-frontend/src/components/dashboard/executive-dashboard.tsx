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
    <article className="group relative overflow-hidden rounded-[6px] border border-border bg-card p-5 shadow-[0_18px_45px_-40px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-[0_18px_40px_-24px_rgba(124,58,237,0.45)]">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[2px] ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-[10px] text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted text-muted-foreground transition-colors group-hover:border-violet-400/50 group-hover:text-violet-300">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-5 font-display text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
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
            <p className="eyebrow text-[10px] text-violet-300">
              ARCA / Gestión humana
            </p>
            <h1 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.03em] text-foreground">
              Dashboard ejecutivo
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Personal, protección laboral y costo salarial a partir de los cierres reales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading || session?.mode !== 'api'}
            className="inline-flex min-h-10 items-center gap-2 rounded-[4px] border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:border-violet-400/60 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar datos
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-[4px] border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] px-4 py-3 text-sm text-[hsl(var(--warning))] sm:flex-row sm:items-start"
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
            accent="bg-violet-500"
          />
          <MetricCard
            label="Costo salarial"
            value={loading ? '…' : latestPayroll ? currency.format(latestPayroll.costoTotal) : '—'}
            detail={latestPayroll ? `Último cierre · ${formatPeriod(latestPayroll.periodo)}` : 'Sin planillas cerradas en el rango'}
            icon={CircleDollarSign}
            accent="bg-fuchsia-500"
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
            accent="bg-emerald-500"
          />
        </section>

        <section className="relative overflow-hidden rounded-[6px] border border-[#2a1a4a] bg-[#0d0719] text-white shadow-[0_30px_70px_-50px_rgba(0,0,0,0.95)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
          />
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
            <div>
              <p className="eyebrow text-[10px] text-violet-300">
                Registro de planillas cerradas
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
                Costo de nómina
              </h2>
              <p className="mt-1 text-sm text-violet-200/60">
                Total ganado y aportes patronales · importes en bolivianos
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-violet-200/80">
              Periodo
              <select
                aria-label="Rango del gráfico de costo salarial"
                value={months}
                onChange={(event) => setMonths(Number(event.target.value) as (typeof MONTH_OPTIONS)[number])}
                className="min-h-9 rounded-[4px] border border-[#3b2a60] bg-[#170f2b] px-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#170f2b] text-white">
                    Últimos {option} meses
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="px-3 py-5 sm:px-6">
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-violet-200/60" role="status">
                Cargando cierres salariales…
              </div>
            ) : error ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-violet-200/60">
                El gráfico no está disponible hasta recuperar los datos de planillas.
              </div>
            ) : payrollPeriods.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center text-sm text-violet-200/60">
                No hay planillas cerradas en el rango seleccionado.
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payrollPeriods} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                    <CartesianGrid vertical={false} stroke="#2a1b48" />
                    <XAxis
                      dataKey="periodo"
                      tickFormatter={formatPeriod}
                      tick={{ fill: '#9a8dbb', fontSize: 11 }}
                      axisLine={{ stroke: '#3a2a5c' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value: number) => new Intl.NumberFormat('es-BO', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(value)}
                      tick={{ fill: '#9a8dbb', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      labelFormatter={(label) => formatPeriod(String(label))}
                      formatter={(value) => currency.format(Number(value))}
                      contentStyle={{
                        backgroundColor: '#120b22',
                        border: '1px solid #3b2a60',
                        borderRadius: '4px',
                        color: '#f4f1ff',
                      }}
                      cursor={{ fill: 'rgba(167, 139, 250, 0.08)' }}
                    />
                    <Legend wrapperStyle={{ color: '#c9bfe0', fontSize: '12px' }} />
                    <Bar
                      dataKey="totalGanado"
                      name="Total ganado"
                      stackId="costo"
                      fill="#c084fc"
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="totalAportesPatronales"
                      name="Aportes patronales"
                      stackId="costo"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <p className="eyebrow border-t border-white/10 px-5 py-3 text-[9px] text-violet-200/60 sm:px-7">
            Fuente: planillas cerradas · máximo de consulta: 36 meses
          </p>
        </section>

        <DashboardQuickLinks />
      </div>
    </PageTransition>
  );
}
