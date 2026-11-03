/**
 * Utilidades de fecha pura (sin hora) para el dominio de personal.
 *
 * Una fecha laboral se representa como `YYYY-MM-DD` y se interpreta siempre a
 * medianoche UTC. No se usa la zona horaria del proceso para estos valores.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export class InvalidDateOnlyError extends Error {
  constructor(value: string) {
    super(`Fecha inválida: ${value}. Se esperaba YYYY-MM-DD.`);
    this.name = 'InvalidDateOnlyError';
  }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseDateOnly(value: string): DateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new InvalidDateOnlyError(value);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) throw new InvalidDateOnlyError(value);
  if (day < 1 || day > lastDayOfMonth(year, month)) throw new InvalidDateOnlyError(value);

  return { year, month, day };
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function formatDateParts(parts: DateParts): string {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toUtcDate(value: string): Date {
  const parts = parseDateOnly(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function fromUtcDate(value: Date): string {
  return formatDateParts({
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  });
}

export function compareDateOnly(left: string, right: string): number {
  return toUtcDate(left).getTime() - toUtcDate(right).getTime();
}

export function addDays(value: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('addDays requiere un número entero de días.');
  return fromUtcDate(new Date(toUtcDate(value).getTime() + days * MS_PER_DAY));
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / MS_PER_DAY);
}

/** Días de antigüedad contando la fecha de ingreso y la fecha de baja. */
export function daysBetweenInclusive(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

export function addMonthsClamped(value: string, months: number): string {
  if (!Number.isInteger(months)) {
    throw new Error('addMonthsClamped requiere un número entero de meses.');
  }
  const source = parseDateOnly(value);
  const absoluteMonth = source.year * 12 + (source.month - 1) + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  const day = Math.min(source.day, lastDayOfMonth(year, month));
  return formatDateParts({ year, month, day });
}

/** Suma años con la convención 29/02 + 1 año = 28/02. */
export function addYearsClamped(value: string, years: number): string {
  return addMonthsClamped(value, years * 12);
}

export interface CalendarDifference {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
}

/**
 * Diferencia calendario entre dos fechas, donde `endExclusive` no se cuenta.
 * Ej.: 2020-03-01 a 2026-12-01 = 6 años, 9 meses, 0 días.
 *
 * Se ancla siempre a la fecha inicial para evitar derivas por meses de
 * distinta longitud (31/01 + 1 mes = 29/02 o 28/02).
 */
export function calendarDifference(
  start: string,
  endExclusive: string,
): CalendarDifference {
  if (compareDateOnly(endExclusive, start) < 0) {
    throw new Error('La fecha final no puede ser anterior a la inicial.');
  }

  const startParts = parseDateOnly(start);
  const endParts = parseDateOnly(endExclusive);
  let totalMonths =
    (endParts.year - startParts.year) * 12 + (endParts.month - startParts.month);

  let cursor = addMonthsClamped(start, totalMonths);
  if (compareDateOnly(cursor, endExclusive) > 0) {
    totalMonths -= 1;
    cursor = addMonthsClamped(start, totalMonths);
  }

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: daysBetween(cursor, endExclusive),
    totalMonths,
  };
}

export function maxDateOnly(left: string, right: string): string {
  return compareDateOnly(left, right) >= 0 ? left : right;
}

export function firstDayOfYear(value: string): string {
  return `${parseDateOnly(value).year}-01-01`;
}

/**
 * Fecha de "hoy" en una zona IANA. Se usa un reloj inyectable en los casos de
 * uso para que las pruebas no dependan del día real.
 */
export function todayInZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`No se pudo obtener la fecha en la zona ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}
