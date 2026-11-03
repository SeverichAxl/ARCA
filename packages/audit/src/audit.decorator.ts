import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'arca:audit';
export const SKIP_AUDIT_METADATA_KEY = 'arca:audit:skip';

export interface AuditOptions {
  modulo?: string;
  accion: string;
}

/**
 * Declara el módulo y la acción de auditoría de un endpoint de escritura.
 * Si no se declara, el interceptor deriva una acción a partir del método y la
 * ruta normalizada para que ninguna escritura quede sin auditar.
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_METADATA_KEY, options);

/**
 * Solo para endpoints que registran su evento de seguridad directamente en el
 * servicio (LOGIN, LOGOUT, refresh y reutilización de refresh). Evita duplicar
 * la fila de auditoría y que el body con credenciales llegue al payload.
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_METADATA_KEY, true);
