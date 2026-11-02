export const INTERNAL_AUTH_ERROR_CODE = 'AUTH_INTERNAL_SIGNATURE_INVALID';

export class InternalAuthError extends Error {
  readonly code = INTERNAL_AUTH_ERROR_CODE;

  constructor(message = 'La solicitud interna no pudo autenticarse.') {
    super(message);
    this.name = 'InternalAuthError';
  }
}
