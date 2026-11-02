export const MAX_GATEWAY_PATH_LENGTH = 2048;

export type PathValidationResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

/**
 * Normaliza la ruta sobre la que se decide y sobre la que se hace proxy.
 * Rechaza las técnicas de evasión documentadas en TSK-DEV2-103. No decodifica
 * la ruta: cualquier `%` se considera intento de codificación y se rechaza.
 */
export function normalizeAndValidatePath(rawUrl: string): PathValidationResult {
  const [rawPath] = rawUrl.split('?');
  const path = rawPath ?? '';

  if (path.length === 0 || path.length > MAX_GATEWAY_PATH_LENGTH) {
    return { ok: false, reason: 'longitud_invalida' };
  }

  if (!path.startsWith('/')) {
    return { ok: false, reason: 'ruta_relativa' };
  }

  if (path.includes('\0') || hasControlCharacter(path)) {
    return { ok: false, reason: 'byte_nulo_o_control' };
  }

  if (path.includes('\\')) {
    return { ok: false, reason: 'barra_invertida' };
  }

  if (path.includes('..')) {
    return { ok: false, reason: 'traversal' };
  }

  if (path.includes('//')) {
    return { ok: false, reason: 'doble_barra' };
  }

  if (path.includes('%')) {
    return { ok: false, reason: 'ruta_codificada' };
  }

  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;

  if (normalized.length === 0) {
    return { ok: false, reason: 'ruta_vacia' };
  }

  return { ok: true, path: normalized };
}
