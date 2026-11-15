'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

export type MetricAccent = 'violet' | 'fuchsia' | 'amber' | 'emerald';

const ACCENTS: Record<
  MetricAccent,
  { icon: string; glow: string; line: string; edge: string; badge: string }
> = {
  violet: {
    icon: 'border-violet-400/25 bg-violet-500/15 text-violet-200 shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]',
    glow: 'from-violet-500/20',
    line: '#a78bfa',
    edge: 'via-violet-400/70',
    badge: 'border-violet-400/25 bg-violet-500/10 text-violet-200',
  },
  fuchsia: {
    icon: 'border-fuchsia-400/25 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_0_24px_-10px_rgba(217,70,239,0.9)]',
    glow: 'from-fuchsia-500/20',
    line: '#e879f9',
    edge: 'via-fuchsia-400/70',
    badge: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200',
  },
  amber: {
    icon: 'border-amber-400/25 bg-amber-500/15 text-amber-200 shadow-[0_0_24px_-10px_rgba(245,158,11,0.9)]',
    glow: 'from-amber-500/20',
    line: '#fbbf24',
    edge: 'via-amber-400/70',
    badge: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  },
  emerald: {
    icon: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200 shadow-[0_0_24px_-10px_rgba(16,185,129,0.9)]',
    glow: 'from-emerald-500/20',
    line: '#34d399',
    edge: 'via-emerald-400/70',
    badge: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  },
};

function Sparkline({
  points,
  color,
  gradientId,
}: {
  points: number[] | null;
  color: string;
  gradientId: string;
}) {
  if (!points || points.length < 2) {
    return (
      <div className="flex h-11 items-center" aria-hidden="true">
        <span className="h-px w-full bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.28)_0_6px,transparent_6px_12px)]" />
      </div>
    );
  }

  const width = 160;
  const height = 44;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const isFlat = max - min < 0.0001;
  const span = isFlat ? 1 : max - min;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((point, index) => [
    pad + index * step,
    isFlat
      ? height / 2
      : height - pad - ((point - min) / span) * (height - pad * 2),
  ] as const);
  const line = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(2)},${height} L${coords[0][0].toFixed(2)},${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {isFlat ? (
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      ) : (
        <>
          <motion.path
            d={area}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        </>
      )}
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

function TrendChip({ trend }: { trend: number }) {
  const isFlat = Math.abs(trend) < 0.05;
  const positive = trend > 0;
  const Icon = isFlat ? Minus : positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums',
        isFlat
          ? 'border-slate-400/20 bg-slate-400/10 text-slate-300'
          : positive
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
            : 'border-rose-400/25 bg-rose-400/10 text-rose-300',
      )}
      title={
        isFlat ? 'Sin variación respecto al cierre anterior' : 'Variación respecto al cierre anterior'
      }
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  value,
  format,
  detail,
  icon: Icon,
  accent,
  trend,
  tag,
  points,
  loading,
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
  detail: string;
  icon: typeof TrendingUp;
  accent: MetricAccent;
  trend: number | null;
  tag: string;
  points: number[] | null;
  loading: boolean;
}) {
  const styles = ACCENTS[accent];
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const animated = useCountUp(value ?? 0, { enabled: value !== null && !loading });
  const display = loading ? '…' : value === null ? '—' : format(animated);

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
      }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 shadow-[0_20px_50px_-38px_rgba(0,0,0,0.95)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300 hover:border-violet-400/35 hover:shadow-[0_28px_60px_-32px_rgba(124,58,237,0.45)]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          styles.edge,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
          styles.glow,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            styles.icon,
          )}
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        {trend !== null ? (
          <TrendChip trend={trend} />
        ) : (
          <span
            className={cn(
              'eyebrow rounded-full border px-2 py-1 text-[9px]',
              styles.badge,
            )}
          >
            {tag}
          </span>
        )}
      </div>

      <p className="eyebrow relative mt-5 text-[10px] text-muted-foreground">{label}</p>
      <p className="relative mt-1.5 font-display text-[1.85rem] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
        {display}
      </p>
      <p className="relative mt-2.5 min-h-[2rem] text-xs leading-5 text-muted-foreground">
        {detail}
      </p>

      <div className="relative mt-3">
        <Sparkline points={points} color={styles.line} gradientId={gradientId} />
      </div>
    </motion.article>
  );
}
