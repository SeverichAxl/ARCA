export class ImporteInvalidoError extends Error {
  constructor(value: unknown) {
    super(`Importe inválido: ${String(value)}. Se esperaba un decimal con hasta 2 decimales.`);
    this.name = 'ImporteInvalidoError';
  }
}

/**
 * Convierte un decimal (string o número) a centavos enteros.
 * No usa float para el valor de negocio: el string se parsea manualmente.
 */
export function parseMoneyToCents(value: string | number): bigint {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new ImporteInvalidoError(value);

  const integer = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return integer * 100n + BigInt(fraction);
}

/** Formatea centavos enteros como string decimal con 2 decimales, sin float. */
export function formatCents(cents: bigint): string {
  if (cents < 0n) throw new ImporteInvalidoError(cents.toString());
  const integer = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${integer}.${fraction}`;
}

/**
 * División exacta de un entero entre un denominador positivo con redondeo
 * half-up (0.005 sube). Los importes del finiquito son siempre positivos.
 */
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('El denominador debe ser positivo.');
  if (numerator < 0n) throw new ImporteInvalidoError(numerator.toString());
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Normaliza un importe de entrada al string canónico con 2 decimales. */
export function normalizeMoney(value: string | number): string {
  return formatCents(parseMoneyToCents(value));
}
