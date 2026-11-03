export class CiInvalidaError extends Error {
  constructor(value: string) {
    super(`CI inválida: ${value}.`);
    this.name = 'CiInvalidaError';
  }
}

/**
 * Normaliza una CI: trim, mayúsculas y sin espacios ni guiones.
 * La misma función se usa en el alta y en la búsqueda por igualdad exacta.
 */
export function normalizarCi(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^[0-9A-Z]{5,15}$/.test(normalized)) {
    throw new CiInvalidaError(value);
  }
  return normalized;
}

export function esCiNormalizada(value: string): boolean {
  return /^[0-9A-Z]{5,15}$/.test(value);
}

/** Devuelve la CI enmascarada, conservando como máximo los últimos 4 caracteres. */
export function maskCi(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 4) return '***';
  return `***${normalized.slice(-4)}`;
}
