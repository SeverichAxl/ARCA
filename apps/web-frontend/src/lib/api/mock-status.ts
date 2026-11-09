/**
 * Configuración de mocks por dominio.
 *
 * `NEXT_PUBLIC_API_MOCKS` es una lista separada por comas. Si la variable no
 * está definida se simula `contratos` (valor inicial acordado para Sprint 2).
 * Una cadena vacía (o `none`/`off`/`false`/`0`, útiles en Windows PowerShell)
 * desactiva todos los mocks.
 *
 * Importante: las variables NEXT_PUBLIC_* se incorporan al bundle en build.
 * Para la demo con backend real el build debe ejecutarse con
 * `NEXT_PUBLIC_API_MOCKS=""`.
 */
export const MOCK_DOMAINS = [
  'contratos',
  'planillas',
  'dashboard',
  'calendario',
  'ficha',
  'exportaciones',
] as const;

export type MockDomain = (typeof MOCK_DOMAINS)[number];

export const DEFAULT_MOCK_DOMAINS: readonly MockDomain[] = ['contratos'];

export const MOCK_ERROR_STATUSES = [401, 403, 404, 409, 500] as const;
export type MockErrorStatus = (typeof MOCK_ERROR_STATUSES)[number];

function isMockDomain(value: string): value is MockDomain {
  return (MOCK_DOMAINS as readonly string[]).includes(value);
}

function isMockErrorStatus(value: number): value is MockErrorStatus {
  return (MOCK_ERROR_STATUSES as readonly number[]).includes(value);
}

/** Valores que desactivan explícitamente todos los mocks (útil en Windows). */
const DISABLED_MOCK_VALUES = new Set(['none', 'off', 'false', '0']);

/** Interpreta la lista de dominios. `undefined` usa el valor por defecto. */
export function parseMockDomains(raw: string | undefined): MockDomain[] {
  if (raw === undefined) return [...DEFAULT_MOCK_DOMAINS];

  const normalized = raw.trim().toLowerCase();
  // La cadena vacía desactiva todos los mocks. En Windows PowerShell asignar
  // `''` elimina la variable, por eso también se aceptan `none`, `off`,
  // `false` y `0`.
  if (!normalized || DISABLED_MOCK_VALUES.has(normalized)) return [];

  const domains = normalized
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(isMockDomain);

  return [...new Set(domains)];
}

export function getActiveMockDomains(): MockDomain[] {
  return parseMockDomains(process.env.NEXT_PUBLIC_API_MOCKS);
}

export function isDomainMocked(domain: MockDomain): boolean {
  return getActiveMockDomains().includes(domain);
}

/**
 * Errores simulados activables.
 *
 * Formatos aceptados en `NEXT_PUBLIC_API_MOCK_ERROR`:
 * - `409` aplica a todos los dominios simulados.
 * - `contratos:409,planillas:500` aplica por dominio.
 */
export function parseMockErrorConfig(
  raw: string | undefined,
): Array<{ domain: MockDomain | null; status: MockErrorStatus }> {
  if (!raw) return [];

  return raw
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .flatMap(
      (entry): Array<{ domain: MockDomain | null; status: MockErrorStatus }> => {
        const [possibleDomain, possibleStatus] = entry.split(':');
        if (possibleStatus === undefined) {
          const status = Number(possibleDomain);
          return isMockErrorStatus(status) ? [{ domain: null, status }] : [];
        }
        if (!isMockDomain(possibleDomain)) return [];
        const status = Number(possibleStatus);
        return isMockErrorStatus(status) ? [{ domain: possibleDomain, status }] : [];
      },
    );
}

export function getMockErrorFor(domain: MockDomain): MockErrorStatus | null {
  const config = parseMockErrorConfig(process.env.NEXT_PUBLIC_API_MOCK_ERROR);
  const domainEntry = config.find((entry) => entry.domain === domain);
  if (domainEntry) return domainEntry.status;
  return config.find((entry) => entry.domain === null)?.status ?? null;
}

/** Latencia determinista de 200 a 600 ms; `NEXT_PUBLIC_API_MOCK_LATENCY=0` la desactiva. */
export function getMockLatencyMs(seed: string): number {
  if (process.env.NEXT_PUBLIC_API_MOCK_LATENCY === '0') return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 401;
  }
  return 200 + hash;
}

export function evaluateDemoCheck(domains: readonly MockDomain[]): {
  ok: boolean;
  message: string;
} {
  if (domains.length === 0) {
    return { ok: true, message: 'Sin dominios simulados: listo para demo con backend real.' };
  }
  return {
    ok: false,
    message: `Hay dominios simulados activos: ${domains.join(', ')}. Defina NEXT_PUBLIC_API_MOCKS="" (o "none" en PowerShell) para la demo.`,
  };
}
