/**
 * Formato monetario sin pasar por `number`/`float`.
 *
 * El backend de planillas serializa importes como strings decimales
 * (`"8995.00"`). Para no perder precisión, aquí separamos signo, parte entera
 * y fracción como texto y solo usamos `BigInt` para redondear a centavos.
 */

export interface ParsedDecimal {
  negative: boolean;
  whole: string;
  fraction: string;
}

const DECIMAL_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;

/** Devuelve `null` si el valor no es un decimal válido. */
export function parseDecimalString(value: string): ParsedDecimal | null {
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return null;

  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [rawWhole = '0', fraction = ''] = unsigned.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';

  return { negative, whole, fraction };
}

function roundToCents(whole: string, fraction: string): { whole: string; fraction: string } {
  if (fraction.length <= 2) {
    return { whole, fraction: fraction.padEnd(2, '0') };
  }

  let cents = BigInt(`${whole}${fraction.slice(0, 2)}`);
  // Redondeo half-up usando el tercer decimal como texto.
  if (fraction.charCodeAt(2) >= '5'.charCodeAt(0)) cents += 1n;

  const digits = cents.toString().padStart(3, '0');
  return {
    whole: digits.slice(0, -2),
    fraction: digits.slice(-2),
  };
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Convierte centavos enteros a string decimal (`125050` -> `"1250.50"`).
 * Útil para mocks y cálculos que deben mantenerse en enteros.
 */
export function centsToDecimalString(cents: number | bigint): string {
  const value = typeof cents === 'bigint' ? cents : BigInt(cents);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = (absolute / 100n).toString();
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Formatea un decimal del backend a `es-BO` con dos decimales.
 * Ejemplos: `"8995.00"` -> `"Bs 8.995,00"`, `"-1500.5"` -> `"Bs -1.500,50"`.
 * Valores inválidos o ausentes se muestran como `—`.
 */
export function formatMoney(
  value: string | null | undefined,
  currency = 'Bs',
): string {
  if (value === null || value === undefined) return '—';

  const parsed = parseDecimalString(value);
  if (!parsed) return '—';

  const rounded = roundToCents(parsed.whole, parsed.fraction);
  const isZero = /^0+$/.test(rounded.whole) && rounded.fraction === '00';
  const sign = parsed.negative && !isZero ? '-' : '';
  const amount = `${sign}${groupThousands(rounded.whole)},${rounded.fraction}`;

  return currency ? `${currency} ${amount}` : amount;
}
