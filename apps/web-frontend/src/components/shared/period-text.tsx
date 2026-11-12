import { formatPeriodo } from '@/lib/format/period';

/** Periodo de planilla (`YYYY-MM`) legible en español. */
export function PeriodText({
  periodo,
  className,
}: {
  periodo: string | null | undefined;
  className?: string;
}) {
  return (
    <time dateTime={periodo ?? undefined} className={className}>
      {formatPeriodo(periodo)}
    </time>
  );
}
