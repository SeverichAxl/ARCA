import { createHmac } from 'node:crypto';
import {
  INTERNAL_HEADER_NAMES,
  type InternalPrincipal,
  buildCanonicalString,
  serializePermissions,
} from './canonical';

export interface SignInternalHeadersInput {
  secret: string;
  method: string;
  path: string;
  principal: InternalPrincipal;
  timestamp?: number;
}

export type SignedInternalHeaders = Record<string, string>;

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Firma las cabeceras internas de identidad. `permisos` se serializa ordenado
 * y sin duplicados; la firma cubre exactly esos bytes.
 */
export function signInternalHeaders(input: SignInternalHeadersInput): SignedInternalHeaders {
  const timestamp = input.timestamp ?? Date.now();
  const permisos = serializePermissions(input.principal.permisos);

  const canonical = buildCanonicalString({
    method: input.method,
    path: input.path,
    userId: input.principal.userId,
    empleadoId: input.principal.empleadoId,
    rol: input.principal.rol,
    permisos,
    timestamp,
  });

  return {
    [INTERNAL_HEADER_NAMES.userId]: input.principal.userId,
    [INTERNAL_HEADER_NAMES.empleadoId]: input.principal.empleadoId ?? '-',
    [INTERNAL_HEADER_NAMES.rol]: input.principal.rol,
    [INTERNAL_HEADER_NAMES.permisos]: permisos,
    [INTERNAL_HEADER_NAMES.timestamp]: String(timestamp),
    [INTERNAL_HEADER_NAMES.signature]: hmacHex(input.secret, canonical),
  };
}

export { hmacHex as internalHmacSha256Hex };
