export const DEFAULT_MAX_DEPTH = 8;
export const DEFAULT_MAX_BYTES = 16 * 1024;

export interface MaskOptions {
  maxDepth?: number;
  maxBytes?: number;
}

const SENSITIVE_PREFIXES = [
  'documento',
  'remuneracion',
  'sueldo',
  'salario',
  'haber',
  'password',
  'contrasena',
  'token',
  'refresh',
  'secret',
  'authorization',
  'firma',
  'adjunt',
  'archivo',
  'attachment',
] as const;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (normalized === 'ci') return true;
  if (normalized.includes('hash')) return true;
  return SENSITIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function maskCi(value: unknown): string {
  if (value === null || value === undefined) return '***';
  if (typeof value === 'object') return '***';
  const text = String(value);
  return text.length > 4 ? `***${text.slice(-4)}` : '***';
}

function maskValueForKey(key: string, value: unknown): string {
  return normalizeKey(key) === 'ci' ? maskCi(value) : '***';
}

function limitSize(value: unknown, maxBytes: number): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) return value;

  const preview = Buffer.from(serialized, 'utf8')
    .subarray(0, Math.max(0, maxBytes))
    .toString('utf8');

  return { truncated: true, preview };
}

/**
 * Enmascara recursivamente datos sensibles antes de persistirlos o publicarlos.
 * No incluye bytes de archivos: cualquier Buffer/Uint8Array se reemplaza por
 * "***". Las referencias circulares y la profundidad máxima se acotan para
 * que la función nunca falle ni genere cargas infinitas.
 */
export function maskSensitive(value: unknown, options: MaskOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const stack = new WeakSet<object>();

  const walk = (input: unknown, key: string, depth: number): unknown => {
    if (key.length > 0 && isSensitiveKey(key)) {
      return maskValueForKey(key, input);
    }

    if (input === null || input === undefined) return input;
    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
      return input;
    }
    if (typeof input === 'bigint') return input.toString();
    if (typeof input === 'function' || typeof input === 'symbol') return '[Omitido]';

    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input.toISOString();
    }
    if (Buffer.isBuffer(input) || input instanceof Uint8Array) return '***';

    if (depth >= maxDepth) return '[Profundidad máxima]';

    if (typeof input === 'object') {
      if (stack.has(input)) return '[Circular]';
      stack.add(input);
      try {
        if (Array.isArray(input)) {
          return input.map((item) => walk(item, '', depth + 1));
        }
        const result: Record<string, unknown> = {};
        for (const [childKey, childValue] of Object.entries(input)) {
          result[childKey] = walk(childValue, childKey, depth + 1);
        }
        return result;
      } finally {
        stack.delete(input);
      }
    }

    return input;
  };

  return limitSize(walk(value, '', 0), maxBytes);
}
