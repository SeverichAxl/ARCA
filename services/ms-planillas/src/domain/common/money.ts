/**
 * Aritmética monetaria exacta para nómina.
 *
 * Los importes se expresan como `bigint` en centavos y los porcentajes como
 * `bigint` escalados a 10^4. El redondeo half-up se aplica por concepto.
 */
export class ImporteInvalidoError extends Error {
  constructor(
    readonly valor: unknown,
    readonly campo?: string,
  ) {
    super(
      `Importe inválido${campo ? ` en ${campo}` : ''}: ${String(valor)}. ` +
        'Se esperaba un decimal no negativo con hasta 2 decimales.',
    );
    this.name = 'ImporteInvalidoError';
  }
}

export class PorcentajeInvalidoError extends Error {
  constructor(
    readonly valor: unknown,
    readonly campo?: string,
  ) {
    super(
      `Porcentaje inválido${campo ? ` en ${campo}` : ''}: ${String(valor)}. ` +
        'Se esperaba un decimal entre 0 y 100 con hasta 4 decimales.',
    );
    this.name = 'PorcentajeInvalidoError';
  }
}

export const PORCENTAJE_ESCALA = 10_000n;
const PORCENTAJE_DIVISOR = 100n * PORCENTAJE_ESCALA;
const DECIMAL_PATTERN = /^(\d{1,13})(?:\.(\d+))?$/;

function asText(value: string | number | { toString(): string }): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ImporteInvalidoError(value);
    return value.toString();
  }
  return value.toString().trim();
}

/** Convierte un decimal a centavos y acepta solo ceros extra a la derecha. */
export function toCents(value: string | number | { toString(): string }, campo?: string): bigint {
  const text = asText(value);
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) throw new ImporteInvalidoError(value, campo);
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (fraction.length > 2) throw new ImporteInvalidoError(value, campo);
  return BigInt(match[1]) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/** Convierte un porcentaje decimal a su forma escalada 10^4. */
export function toPorcentaje(
  value: string | number | { toString(): string },
  campo?: string,
): bigint {
  const text = asText(value);
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) throw new PorcentajeInvalidoError(value, campo);
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (fraction.length > 4) throw new PorcentajeInvalidoError(value, campo);
  const scaled = BigInt(match[1]) * PORCENTAJE_ESCALA + BigInt(fraction.padEnd(4, '0'));
  if (scaled > 100n * PORCENTAJE_ESCALA) throw new PorcentajeInvalidoError(value, campo);
  return scaled;
}

export function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${integer}.${fraction}`;
}

export function formatPorcentaje(scaled: bigint): string {
  const integer = scaled / PORCENTAJE_ESCALA;
  const fraction = (scaled % PORCENTAJE_ESCALA).toString().padStart(4, '0');
  return `${integer}.${fraction}`;
}

/** División entera no negativa con redondeo half-up (0.005 sube). */
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('El denominador debe ser positivo.');
  if (numerator < 0n) throw new ImporteInvalidoError(numerator.toString());
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function aplicarPorcentaje(cents: bigint, porcentaje: bigint): bigint {
  return divideHalfUp(cents * porcentaje, PORCENTAJE_DIVISOR);
}

export function porcentajeExacto(cents: bigint, porcentaje: bigint): bigint {
  return cents * porcentaje;
}

export function redondearExacto(numerador: bigint): bigint {
  return divideHalfUp(numerador, PORCENTAJE_DIVISOR);
}

export const max0 = (value: bigint): bigint => (value > 0n ? value : 0n);
export const minBig = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const sumCents = (values: readonly bigint[]): bigint =>
  values.reduce((total, value) => total + value, 0n);
