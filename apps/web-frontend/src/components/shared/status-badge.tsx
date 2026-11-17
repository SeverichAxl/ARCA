import { cn } from '@/lib/utils';

type BadgeTone = 'success' | 'neutral' | 'warning' | 'info' | 'danger';

const TONES: Record<BadgeTone, string> = {
  success:
    'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
  neutral:
    'border-border bg-muted text-muted-foreground',
  warning:
    'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]',
  info:
    'border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]',
  danger:
    'border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]',
};

const STATUS_TONES: Record<string, { tone: BadgeTone; label: string }> = {
  activa: { tone: 'success', label: 'Activa' },
  inactiva: { tone: 'neutral', label: 'Inactiva' },
  BORRADOR: { tone: 'warning', label: 'Borrador' },
  GENERADO: { tone: 'info', label: 'Generado' },
  EMITIDO: { tone: 'success', label: 'Emitido' },
  EMITIDA: { tone: 'success', label: 'Emitida' },
  ANULADO: { tone: 'danger', label: 'Anulado' },
  ANULADA: { tone: 'danger', label: 'Anulada' },
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
        'inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
