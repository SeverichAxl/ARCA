import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format/money';

/**
 * Importe monetario formateado desde el string decimal del backend.
 * No convierte a `number`: no hay pérdida de precisión ni redondeos de float.
 */
export function MoneyText({
  value,
  currency = 'Bs',
  className,
}: {
  value: string | null | undefined;
  currency?: string;
  className?: string;
}) {
  const formatted = formatMoney(value, currency);

  return (
    <span className={cn('tabular-nums', className)} title={formatted}>
      {formatted}
    </span>
  );
}
