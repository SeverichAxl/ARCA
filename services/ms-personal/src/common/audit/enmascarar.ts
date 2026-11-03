import type { JsonValue } from '@arca/messaging';

const CLAVES_OCULTAS = /^(ciCifrado|ciHash|remuneracion|password|token|sueldo|finiquito)/i;

/**
 * Enmascarado recursivo antes de guardar en Outbox:
 * CI -> "***1234"; remuneracion*, password*, token*, sueldo*, finiquito* -> "***".
 */
export function enmascarar(valor: unknown, clave = ''): JsonValue {
  if (clave && CLAVES_OCULTAS.test(clave)) return '***';
  if (clave.toLowerCase() === 'ci' && typeof valor === 'string') return `***${valor.slice(-4)}`;
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map((v) => enmascarar(v));
  if (typeof valor === 'object') {
    const resultado: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v !== undefined) resultado[k] = enmascarar(v, k);
    }
    return resultado;
  }
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  return String(valor);
}
