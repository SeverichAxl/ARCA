/**
 * Utilidades de periodo y fecha.
 *
 * - `YYYY-MM` se muestra como `Octubre 2026`.
 * - `YYYY-MM-DD` se muestra como `dd/mm/aaaa` SIN construir un `Date` local
 *   (evita el desfase de zona horaria de medianoche UTC).
 */

export const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

export function isPeriodo(value: string): boolean {
  return PERIOD_PATTERN.test(value);
}

/** `"2026-10"` -> `"Octubre 2026"`. */
export function formatPeriodo(value: string | null | undefined): string {
  if (!value) return '—';
  const match = PERIOD_PATTERN.exec(value.trim());
  if (!match) return value;
  const [, year, month] = match;
  return `${MESES_ES[Number(month) - 1]} ${year}`;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // `Date.UTC(year, month, 0)` devuelve el último día del mes anterior.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * `"2026-03-01"` -> `"01/03/2026"`. También acepta un ISO con hora, pero
 * toma la parte de fecha tal como llega (sin reinterpretarla en otra zona).
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return value;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!isValidDateParts(year, month, day)) return value;

  return `${rawDay}/${rawMonth}/${rawYear}`;
}

/** Fecha de un ISO date-time en hora de Bolivia (`America/La_Paz`). */
export function formatDateInBolivia(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateOnly(value);
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  }).format(date);
}

/** Fecha y hora de un ISO date-time en hora de Bolivia. */
export function formatDateTimeInBolivia(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateOnly(value);
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  }).format(date);
}
