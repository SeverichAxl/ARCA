export const EVENTS_EXCHANGE = 'arca.events';
export const EVENT_VERSION = 1;
export const DEFAULT_RETRY_TTL_MS = 10_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BATCH_SIZE = 50;

const ROUTING_KEYS: Record<string, string> = {
  EMPLEADO_CREADO: 'personal.empleado.creado',
  EMPLEADO_MODIFICADO: 'personal.empleado.modificado',
  EMPLEADO_DADO_DE_BAJA: 'personal.empleado.baja',
  AREA_ACTUALIZADA: 'personal.area.actualizada',
  AUDITORIA_REGISTRADA: 'auditoria.registrada',
};

export function routingKeyFor(eventName: string): string {
  const routingKey = ROUTING_KEYS[eventName];
  if (!routingKey) {
    throw new Error(`No hay routing key registrada para el evento ${eventName}.`);
  }
  return routingKey;
}

export function retryDestination(
  retryCount: number,
  maxAttempts: number,
  retryQueue: string,
  deadLetterQueue: string,
): { destination: string; nextRetryCount: number } {
  const nextRetryCount = retryCount + 1;
  return {
    destination: nextRetryCount >= maxAttempts ? deadLetterQueue : retryQueue,
    nextRetryCount,
  };
}

export function getRetryCount(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return 0;
}
