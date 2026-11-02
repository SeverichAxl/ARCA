import { timingSafeEqual } from 'node:crypto';
import {
  INTERNAL_HEADER_NAMES,
  type InternalPrincipal,
  buildCanonicalString,
} from './canonical';
import { InternalAuthError } from './errors';
import { internalHmacSha256Hex } from './sign';

export type HeaderBag = Record<string, string | string[] | undefined>;

export interface VerifyInternalHeadersInput {
  secret: string;
  method: string;
  path: string;
  headers: HeaderBag;
  now?: number;
  toleranceMs?: number;
}

export const DEFAULT_TIMESTAMP_TOLERANCE_MS = 60_000;
const SIGNATURE_HEX_PATTERN = /^[a-f0-9]{64}$/i;

function getHeader(headers: HeaderBag, name: string): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) {
    return Array.isArray(direct) ? direct[0] : direct;
  }

  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return undefined;
}

function parsePermissions(raw: string): string[] {
  if (raw === '') {
    return [];
  }

  const permisos = raw.split(',');
  if (permisos.some((permiso) => permiso.length === 0 || permiso.trim() !== permiso)) {
    throw new InternalAuthError();
  }

  const ordered = [...permisos].sort();
  if (ordered.join(',') !== raw) {
    throw new InternalAuthError();
  }

  return permisos;
}

/**
 * Verifica la firma HMAC y la tolerancia temporal. No confía en ninguna
 * cabecera antes de comprobar la firma. Lanza InternalAuthError ante cualquier
 * fallo, sin revelar el motivo exacto.
 */
export function verifyInternalHeaders(input: VerifyInternalHeadersInput): InternalPrincipal {
  const now = input.now ?? Date.now();
  const toleranceMs = input.toleranceMs ?? DEFAULT_TIMESTAMP_TOLERANCE_MS;

  const userId = getHeader(input.headers, INTERNAL_HEADER_NAMES.userId);
  const empleadoIdHeader = getHeader(input.headers, INTERNAL_HEADER_NAMES.empleadoId);
  const rol = getHeader(input.headers, INTERNAL_HEADER_NAMES.rol);
  const permisosHeader = getHeader(input.headers, INTERNAL_HEADER_NAMES.permisos);
  const timestampHeader = getHeader(input.headers, INTERNAL_HEADER_NAMES.timestamp);
  const signature = getHeader(input.headers, INTERNAL_HEADER_NAMES.signature);

  if (
    userId === undefined ||
    userId.length === 0 ||
    empleadoIdHeader === undefined ||
    empleadoIdHeader.length === 0 ||
    rol === undefined ||
    rol.length === 0 ||
    permisosHeader === undefined ||
    timestampHeader === undefined ||
    signature === undefined ||
    !SIGNATURE_HEX_PATTERN.test(signature)
  ) {
    throw new InternalAuthError();
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > toleranceMs) {
    throw new InternalAuthError();
  }

  const permisos = parsePermissions(permisosHeader);

  const canonical = buildCanonicalString({
    method: input.method,
    path: input.path,
    userId,
    empleadoId: empleadoIdHeader,
    rol,
    permisos: permisosHeader,
    timestamp,
  });

  const expected = internalHmacSha256Hex(input.secret, canonical);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new InternalAuthError();
  }

  return {
    userId,
    empleadoId: empleadoIdHeader === '-' ? null : empleadoIdHeader,
    rol,
    permisos,
  };
}
