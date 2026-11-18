'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartArea, ChartColumn } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PayrollPeriod } from '@/lib/dashboard-api';
import { useChartTheme } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';

const RANGES = [
  { months: 1, label: '1 mes', short: '1M' },
  { months: 3, label: '3 meses', short: '3M' },
  { months: 6, label: '6 meses', short: '6M' },
  { months: 12, label: '12 meses', short: '12M' },
  { months: 24, label: '24 meses', short: '24M' },
  { months: 36, label: '36 meses', short: '36M' },
] as const;

type RangeMonths = (typeof RANGES)[number]['months'];
type ChartMode = 'area' | 'bars';

const currency = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNumber = new Intl.NumberFormat('es-BO', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const compactCurrency = new Intl.NumberFormat('es-BO', {
  notation: 'compact',
  maximumFractionDigits: 1,
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

function RangeSelector({
  months,
  onChange,
}: {
  months: RangeMonths;
  onChange: (months: RangeMonths) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Rango del gráfico de costo salarial"
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/60 p-1"
    >
      {RANGES.map((range) => {
        const active = range.months === months;
        return (
          <button
            key={range.months}
            type="button"
            onClick={() => onChange(range.months)}
            aria-pressed={active}
            className={cn(
              'relative rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              active ? 'text-white' : 'text-violet-200/55 hover:text-violet-100',
            )}
          >
            {active ? (
              <motion.span
                layoutId="dashboard-range-pill"
                className="absolute inset-0 rounded-lg bg-violet-500/25 ring-1 ring-inset ring-violet-400/40"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{range.short}</span>
            <span className="sr-only"> {range.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}) {
  const options: Array<{ value: ChartMode; label: string; icon: typeof ChartArea }> = [
    { value: 'area', label: 'Área', icon: ChartArea },
    { value: 'bars', label: 'Barras', icon: ChartColumn },
  ];

  return (
    <div
      role="group"
      aria-label="Tipo de gráfico"
      className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/60 p-1"
    >
      {options.map((option) => {
        const active = mode === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              active ? 'text-white' : 'text-violet-200/55 hover:text-violet-100',
            )}
          >
            {active ? (
              <motion.span
                layoutId="dashboard-chart-mode"
                className="absolute inset-0 rounded-lg bg-violet-500/25 ring-1 ring-inset ring-violet-400/40"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon aria-hidden="true" className="relative z-10 h-3.5 w-3.5" />
            <span className="relative z-10 hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Legend({ series1, series2 }: { series1: string; series2: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-violet-200/70">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series1 }} />
        Total ganado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series2 }} />
        Aportes patronales
      </span>
    </div>
  );
}

function MonthBreakdown({ period }: { period: PayrollPeriod }) {
  const max = Math.max(period.totalGanado, period.totalAportesPatronales, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-[320px] w-full flex-col justify-center gap-6 px-1 sm:px-3"
    >
      <div>
        <p className="eyebrow text-[10px] text-violet-300/80">
          Cierre de {formatPeriod(period.periodo)}
        </p>
        <p className="mt-2 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums">
          {currency.format(period.costoTotal)}
        </p>
        <p className="mt-2 text-xs text-violet-200/60">
          Costo total del mes · {period.totalEmpleados.toLocaleString('es-BO')} empleados en planilla
        </p>
      </div>

      <div className="space-y-4">
        {[
          { label: 'Total ganado', value: period.totalGanado, color: 'from-violet-400 to-fuchsia-400' },
          { label: 'Aportes patronales', value: period.totalAportesPatronales, color: 'from-violet-600 to-violet-400' },
        ].map((row, index) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-violet-100/80">{row.label}</span>
              <span className="font-semibold text-white tabular-nums">{currency.format(row.value)}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className={cn('h-full rounded-full bg-gradient-to-r', row.color)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                transition={{ duration: 0.8, delay: 0.1 + index * 0.12, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
        <span className="text-violet-200/60">Líquido pagado</span>
        <span className="font-semibold text-white tabular-nums">{currency.format(period.totalLiquido)}</span>
      </div>
    </motion.div>
  );
}

function PayrollComposition({ period }: { period: PayrollPeriod | undefined }) {
  const chart = useChartTheme();

  if (!period) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center text-center text-sm text-violet-200/55">
        Aún no hay un cierre de planilla para mostrar la composición del costo.
      </div>
    );
  }

  const data = [
    { name: 'Total ganado', value: period.totalGanado, color: chart.series1 },
    { name: 'Aportes patronales', value: period.totalAportesPatronales, color: chart.series2 },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const percent = Math.round((data[0].value / total) * 100);

  return (
    <div>
      <div className="relative mx-auto h-[210px] w-full max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={66}
              outerRadius={92}
              paddingAngle={4}
              cornerRadius={8}
              stroke="none"
              isAnimationActive
              animationDuration={900}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: chart.surface,
                border: `1px solid ${chart.border}`,
                borderRadius: '10px',
                color: chart.text,
                boxShadow: `0 18px 40px -24px ${chart.shadow}`,
              }}
              formatter={(value) => currency.format(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="eyebrow text-[9px] text-violet-300/70">Costo total</span>
          <span className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-white tabular-nums">
            Bs {compactCurrency.format(period.costoTotal)}
          </span>
          <span className="mt-1 text-[10px] text-violet-200/50">{formatPeriod(period.periodo)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 text-violet-100/70">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-medium text-white tabular-nums">
              {currency.format(item.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2 text-xs">
          <span className="text-violet-200/55">Participación del total ganado</span>
          <span className="font-semibold text-violet-200 tabular-nums">{percent}%</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="eyebrow text-[8px] text-violet-300/60">Empleados</p>
          <p className="mt-1 font-display text-base font-semibold text-white tabular-nums">
            {period.totalEmpleados.toLocaleString('es-BO')}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="eyebrow text-[8px] text-violet-300/60">Líquido pagado</p>
          <p className="mt-1 font-display text-base font-semibold text-white tabular-nums">
            Bs {compactCurrency.format(period.totalLiquido)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PayrollPanel({
  periods,
  loading,
  error,
}: {
  periods: PayrollPeriod[];
  loading: boolean;
  error: string | null;
}) {
  const [months, setMonths] = useState<RangeMonths>(12);
  const [mode, setMode] = useState<ChartMode>('area');
  const chart = useChartTheme();

  const tooltipStyle = {
    backgroundColor: chart.surface,
    border: `1px solid ${chart.border}`,
    borderRadius: '10px',
    color: chart.text,
    boxShadow: `0 18px 40px -24px ${chart.shadow}`,
  };

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [periods],
  );
  const chartPeriods = useMemo(() => sortedPeriods.slice(-months), [months, sortedPeriods]);
  const latest = periods.length ? sortedPeriods[sortedPeriods.length - 1] : undefined;
  const latestInRange = chartPeriods.length ? chartPeriods[chartPeriods.length - 1] : undefined;

  const rangeTotal = chartPeriods.reduce((sum, period) => sum + period.costoTotal, 0);
  const average = chartPeriods.length ? rangeTotal / chartPeriods.length : 0;
  const previous = chartPeriods.length > 1 ? chartPeriods[chartPeriods.length - 2] : undefined;
  const variation =
    latestInRange && previous && previous.costoTotal > 0
      ? ((latestInRange.costoTotal - previous.costoTotal) / previous.costoTotal) * 100
      : null;

  const tickFormatter = (value: number) => compactNumber.format(value);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <motion.section
        variants={{
          hidden: { opacity: 0, y: 18 },
          show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
        }}
        aria-labelledby="payroll-chart-title"
        className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_30px_70px_-50px_rgba(0,0,0,0.95)]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
        />

        <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-violet-300">Registro de planillas cerradas</p>
            <h2
              id="payroll-chart-title"
              className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]"
            >
              Costo de nómina
            </h2>
            <p className="mt-1 text-sm text-violet-200/60">
              Total ganado y aportes patronales · importes en bolivianos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RangeSelector months={months} onChange={setMonths} />
            {months > 1 ? <ModeSelector mode={mode} onChange={setMode} /> : null}
          </div>
        </div>

        <div className="relative grid gap-3 border-b border-white/10 px-5 py-4 sm:grid-cols-3 sm:px-6">
          {[
            { label: 'Total del rango', value: currency.format(rangeTotal) },
            { label: 'Promedio mensual', value: currency.format(average) },
            {
              label: 'Variación último cierre',
              value:
                variation === null
                  ? '—'
                  : Math.abs(variation) < 0.05
                    ? '0.0%'
                    : `${variation > 0 ? '+' : '−'}${Math.abs(variation).toFixed(1)}%`,
              tone:
                variation === null
                  ? ''
                  : Math.abs(variation) < 0.05
                    ? 'text-slate-300'
                    : variation > 0
                      ? 'text-emerald-300'
                      : 'text-rose-300',
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="eyebrow text-[9px] text-violet-300/60">{stat.label}</p>
              <p
                className={cn(
                  'mt-1 truncate font-display text-base font-semibold tabular-nums text-white',
                  stat.tone,
                )}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="relative px-3 py-5 sm:px-5">
          {loading ? (
            <div className="flex h-[320px] flex-col justify-end gap-3 px-3" role="status">
              <div className="flex flex-1 items-end gap-3">
                {[42, 68, 54, 82, 61, 74, 48, 88, 58, 72, 64, 79].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 animate-pulse rounded-t-md bg-violet-500/15"
                    style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }}
                  />
                ))}
              </div>
              <span className="sr-only">Cargando cierres salariales…</span>
            </div>
          ) : error ? (
            <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-violet-200/60">
              El gráfico no está disponible hasta recuperar los datos de planillas.
            </div>
          ) : chartPeriods.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-violet-200/60">
              No hay planillas cerradas en el rango seleccionado.
            </div>
          ) : months === 1 && latestInRange ? (
            <MonthBreakdown period={latestInRange} />
          ) : (
            <>
              <div
                className="h-[320px] w-full"
                role="img"
                aria-label={`Costo de nómina de los últimos ${months} meses`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {mode === 'area' ? (
                    <AreaChart
                      key={`area-${months}`}
                      data={chartPeriods}
                      margin={{ top: 8, right: 12, bottom: 4, left: 8 }}
                    >
                      <defs>
                        <linearGradient id="payroll-earned" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="4%" stopColor={chart.series1} stopOpacity={0.5} />
                          <stop offset="96%" stopColor={chart.series1} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="payroll-contributions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="4%" stopColor={chart.series2} stopOpacity={0.55} />
                          <stop offset="96%" stopColor={chart.series2} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 6" />
                      <XAxis
                        dataKey="periodo"
                        tickFormatter={formatPeriod}
                        tick={{ fill: chart.axis, fontSize: 11 }}
                        axisLine={{ stroke: chart.axisLine }}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        tickFormatter={tickFormatter}
                        tick={{ fill: chart.axis, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                      />
                      <Tooltip
                        labelFormatter={(label) => formatPeriod(String(label))}
                        formatter={(value) => currency.format(Number(value))}
                        contentStyle={tooltipStyle}
                        cursor={{ stroke: chart.cursor, strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalGanado"
                        name="Total ganado"
                        stackId="costo"
                        stroke={chart.series1}
                        strokeWidth={2}
                        fill="url(#payroll-earned)"
                      />
                      <Area
                        type="monotone"
                        dataKey="totalAportesPatronales"
                        name="Aportes patronales"
                        stackId="costo"
                        stroke={chart.series2}
                        strokeWidth={2}
                        fill="url(#payroll-contributions)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      key={`bars-${months}`}
                      data={chartPeriods}
                      margin={{ top: 8, right: 12, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 6" />
                      <XAxis
                        dataKey="periodo"
                        tickFormatter={formatPeriod}
                        tick={{ fill: chart.axis, fontSize: 11 }}
                        axisLine={{ stroke: chart.axisLine }}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        tickFormatter={tickFormatter}
                        tick={{ fill: chart.axis, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                      />
                      <Tooltip
                        labelFormatter={(label) => formatPeriod(String(label))}
                        formatter={(value) => currency.format(Number(value))}
                        contentStyle={tooltipStyle}
                        cursor={{ fill: chart.cursorFill }}
                      />
                      <Bar
                        dataKey="totalGanado"
                        name="Total ganado"
                        stackId="costo"
                        fill={chart.series1}
                        maxBarSize={46}
                      />
                      <Bar
                        dataKey="totalAportesPatronales"
                        name="Aportes patronales"
                        stackId="costo"
                        fill={chart.series2}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={46}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <Legend series1={chart.series1} series2={chart.series2} />
                <span className="text-[10px] text-violet-300/50">
                  Mostrando {chartPeriods.length} {chartPeriods.length === 1 ? 'mes' : 'meses'}
                </span>
              </div>
            </>
          )}
        </div>

        <p className="eyebrow relative border-t border-white/10 px-5 py-3 text-[9px] text-violet-200/50 sm:px-6">
          Fuente: planillas cerradas · máximo de consulta: 36 meses
        </p>
      </motion.section>

      <motion.section
        variants={{
          hidden: { opacity: 0, y: 18 },
          show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.08, ease: 'easeOut' } },
        }}
        aria-labelledby="payroll-composition-title"
        className="relative overflow-hidden rounded-2xl border border-border bg-card/85 p-5 shadow-[0_20px_50px_-38px_rgba(0,0,0,0.95)]"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-600/10 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-[10px] text-violet-300">Último cierre</p>
            <h2
              id="payroll-composition-title"
              className="mt-2 font-display text-lg font-semibold tracking-[-0.02em] text-foreground"
            >
              Composición del costo
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Distribución de la planilla más reciente.
            </p>
          </div>
        </div>
        <div className="relative mt-4">
          {loading ? (
            <div className="flex h-[300px] items-center justify-center" role="status">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-violet-400 motion-reduce:animate-none" />
              <span className="sr-only">Cargando composición…</span>
            </div>
          ) : (
            <PayrollComposition period={latest} />
          )}
        </div>
      </motion.section>
    </div>
  );
}
