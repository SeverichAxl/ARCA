import { cn } from '@/lib/utils';

type BadgeTone = 'success' | 'neutral' | 'warning' | 'info' | 'danger';

const TONES: Record<BadgeTone, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  neutral:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
};

const STATUS_TONES: Record<string, { tone: BadgeTone; label: string }> = {
  activa: { tone: 'success', label: 'Activa' },
  inactiva: { tone: 'neutral', label: 'Inactiva' },
  BORRADOR: { tone: 'warning', label: 'Borrador' },
  GENERADO: { tone: 'info', label: 'Generado' },
  EMITIDO: { tone: 'success', label: 'Emitido' },
  ANULADO: { tone: 'danger', label: 'Anulado' },
};

function humanize(value: string): string {
  const normalized = value.replace(/_/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Estado con color y texto. Nunca se comunica solo por color (WCAG 2.1 AA).
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const definition = STATUS_TONES[status] ?? STATUS_TONES[status.toUpperCase()];
  const tone = definition?.tone ?? 'neutral';
  const text = label ?? definition?.label ?? humanize(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
