export interface ForeignLimitInput {
  activos: number;
  extranjerosActivos: number;
  limitePct: string | number;
  nuevoEsExtranjero: boolean;
}

export class LimiteConfigInvalidoError extends Error {
  constructor(value: string | number) {
    super(`Límite de extranjeros inválido: ${String(value)}.`);
    this.name = 'LimiteConfigInvalidoError';
  }
}

/** Convierte un porcentaje a diezmilésimas para comparar sin float. */
export function porcentajeABasePoints(value: string | number): bigint {
  const text = typeof value === 'number' ? String(value) : value.trim();
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new LimiteConfigInvalidoError(value);

  const integer = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  const basePoints = integer * 100n + fraction;
  if (basePoints > 10000n) throw new LimiteConfigInvalidoError(value);
  return basePoints;
}

/**
 * Regla del Art. 3 LGT: al dar de alta a un extranjero,
 * (extranjeros activos + 1) / (activos + 1) <= LIMITE_EXTRANJEROS_PCT.
 * Activo = estado distinto de INACTIVO.
 */
export function excedeLimiteExtranjeros(input: ForeignLimitInput): boolean {
  if (!input.nuevoEsExtranjero) return false;
  if (input.activos < 0 || input.extranjerosActivos < 0) {
    throw new Error('Los conteos de personal no pueden ser negativos.');
  }

  const limite = porcentajeABasePoints(input.limitePct);
  const extranjeros = BigInt(input.extranjerosActivos + 1);
  const total = BigInt(input.activos + 1);
  return extranjeros * 10000n > limite * total;
}
