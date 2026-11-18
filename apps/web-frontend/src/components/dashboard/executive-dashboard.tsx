'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { MetricCard } from '@/components/dashboard/dashboard-metrics';
import { PayrollPanel } from '@/components/dashboard/payroll-panel';
import { PageTransition } from '@/components/fade-in';
import { getExecutiveDashboard, type ExecutiveDashboardData, type PayrollPeriod } from '@/lib/dashboard-api';

const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

const periodLabel = new Intl.DateTimeFormat('es-BO', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

function formatPeriod(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return periodLabel.format(new Date(Date.UTC(year, month - 1, 1)));
}

function percentChange(
  periods: PayrollPeriod[],
  key: 'costoTotal' | 'totalEmpleados',
): number | null {
  if (periods.length < 2) return null;
  const last = periods[periods.length - 1][key];
  const previous = periods[periods.length - 2][key];
  if (!previous) return null;
  return ((last - previous) / previous) * 100;
}

export function ExecutiveDashboard() {
  const { request, session } = useAuth();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (session?.mode !== 'api') {
      setData(null);
      setError(
        'El dashboard ejecutivo requiere datos reales del API; no se muestran datos de demostración.',
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setData(await getExecutiveDashboard(request));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar las métricas ejecutivas.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [request, session?.mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const periods = useMemo(
    () => [...(data?.payrollPeriods ?? [])].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [data?.payrollPeriods],
  );
  const latestPayroll = periods.length ? periods[periods.length - 1] : undefined;
  const costTrend = useMemo(() => percentChange(periods, 'costoTotal'), [periods]);
  const staffTrend = useMemo(() => percentChange(periods, 'totalEmpleados'), [periods]);
  const recentPeriods = useMemo(() => periods.slice(-8), [periods]);

  return (
    <PageTransition>
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
        className="mx-auto w-full max-w-[1680px] space-y-4"
      >
        <motion.header
          variants={{
            hidden: { opacity: 0, y: 12 },
            show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
          }}
          className="flex flex-wrap items-end justify-between gap-4 pb-1"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow text-[10px] text-violet-300">ARCA / Gestión humana</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {session?.mode === 'api' ? 'Datos en vivo' : 'Modo mock'}
              </span>
            </div>
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
            className="group relative isolate inline-flex min-h-10 items-center gap-2 overflow-hidden rounded-xl border border-border bg-card/80 px-3.5 text-sm font-medium text-foreground transition-[border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-400/60 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  'radial-gradient(140px circle at 50% 50%, hsl(var(--violet-400) / 0.18), transparent 72%)',
              }}
            />
            <RefreshCw
              aria-hidden="true"
              className={`relative z-10 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="relative z-10">Actualizar datos</span>
          </button>
        </motion.header>

        {error && (
          <motion.div
            role="alert"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] px-4 py-3 text-sm text-[hsl(var(--warning))] sm:flex-row sm:items-start"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo completar la carga del dashboard.</p>
              <p className="mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        <section
          aria-label="Indicadores ejecutivos"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Empleados activos"
            value={data ? data.activeEmployees : null}
            format={(value) => integer.format(Math.round(value))}
            detail="En prueba y ratificados · servicio de personal"
            icon={Users}
            accent="violet"
            trend={staffTrend}
            tag="Activos"
            points={recentPeriods.map((period) => period.totalEmpleados)}
            loading={loading}
          />
          <MetricCard
            label="Costo salarial"
            value={latestPayroll ? latestPayroll.costoTotal : null}
            format={(value) => currency.format(value)}
            detail={
              latestPayroll
                ? `Último cierre · ${formatPeriod(latestPayroll.periodo)}`
                : 'Sin planillas cerradas en el rango'
            }
            icon={CircleDollarSign}
            accent="fuchsia"
            trend={costTrend}
            tag="Cierre"
            points={recentPeriods.map((period) => period.costoTotal)}
            loading={loading}
          />
          <MetricCard
            label="Vacaciones activas"
            value={null}
            format={(value) => integer.format(Math.round(value))}
            detail="El API actual no expone un agregado de vacaciones aprobadas vigentes."
            icon={CalendarDays}
            accent="amber"
            trend={null}
            tag="Sin dato"
            points={null}
            loading={false}
          />
          <MetricCard
            label="Inamovilidades activas"
            value={data ? data.activeJobProtections : null}
            format={(value) => integer.format(Math.round(value))}
            detail="Conteo filtrado por vigencia · servicio de personal"
            icon={ShieldCheck}
            accent="emerald"
            trend={null}
            tag="Vigentes"
            points={null}
            loading={loading}
          />
        </section>

        <PayrollPanel
          periods={data?.payrollPeriods ?? []}
          loading={loading}
          error={error}
        />

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
          }}
          className="flex items-center gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] px-4 py-3 text-[11px] text-muted-foreground"
        >
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <p>
            Los indicadores se recalculan con cada planilla cerrada. El rango del gráfico no altera
            los totales consolidados del encabezado.
          </p>
        </motion.div>


      </motion.div>
    </PageTransition>
  );
}
