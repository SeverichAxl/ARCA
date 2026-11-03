/**
 * Error de negocio con código contractual (docs/api/errores.md).
 * El filtro global lo traduce a { statusCode, code, message, details, traceId }.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const Errores = {
  validacion: (fields?: Record<string, string>) =>
    new DomainError('VALIDATION_ERROR', 400, 'Uno o más campos no son válidos.', fields ? { fields } : undefined),
  firmaRequerida: () => new DomainError('PERS_FIRMA_REQUERIDA', 400, 'La firma digitalizada es obligatoria.'),
  archivoInvalido: () =>
    new DomainError('PERS_ARCHIVO_INVALIDO', 400, 'El archivo no es válido o supera el tamaño permitido.'),
  prohibido: () => new DomainError('FORBIDDEN', 403, 'No tiene permiso para realizar esta operación.'),
  noEncontrado: (details?: Record<string, unknown>) =>
    new DomainError('NOT_FOUND', 404, 'El recurso solicitado no existe.', details),
  conflicto: (motivo?: string) =>
    new DomainError('CONFLICT', 409, 'La operación entra en conflicto con el estado actual.', motivo ? { motivo } : undefined),
  ciDuplicada: () => new DomainError('PERS_CI_DUPLICADA', 409, 'Ya existe un funcionario con ese CI.'),
  limiteExtranjeros: (details: Record<string, unknown>) =>
    new DomainError('PERS_LIMITE_EXTRANJEROS', 409, 'La operación superaría el límite de funcionarios extranjeros.', details),
  ratificacionAnticipada: (details: Record<string, unknown>) =>
    new DomainError('PERS_RATIFICACION_ANTICIPADA', 409, 'No se puede ratificar antes de completar el periodo de prueba.', details),
  inamovilidadActiva: (details: Record<string, unknown>) =>
    new DomainError('PERS_INAMOVILIDAD_ACTIVA', 409, 'La baja está bloqueada por inamovilidad laboral.', details),
};
