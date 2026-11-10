export const CONTRATO_STORAGE_PORT = Symbol('CONTRATO_STORAGE_PORT');

/**
 * `documento` es el PDF del contrato (Cloudinary `raw`); `firma` es una imagen
 * gráfica (Cloudinary `image`). Nunca se sobreescribe un objeto: cada carga
 * genera un `public_id` nuevo.
 */
export type ContratoArchivoTipo = 'documento' | 'firma';

export interface UploadContratoFileInput {
  buffer: Buffer;
  mimeType: string;
  kind: ContratoArchivoTipo;
  contratoId: string;
  /** UUID opcional para trazabilidad; el adaptador siempre genera uno nuevo. */
  logicalId?: string;
}

export interface StoredContratoFile {
  /** Identificador aleatorio del proveedor. Inmutable por carga. */
  publicId: string;
  /** Versión interna del proveedor (Cloudinary `version`). */
  providerVersion: string | null;
  mimeType: string;
  bytes: number;
}

export interface SignedContratoUrl {
  url: string;
  expiresInSeconds: number;
}

export interface ContratoStoragePort {
  /** Sube un objeto nuevo; jamás reemplaza un `publicId` existente. */
  upload(input: UploadContratoFileInput): Promise<StoredContratoFile>;
  /** URL firmada de vida corta para descarga controlada. */
  signedUrl(
    publicId: string,
    kind: ContratoArchivoTipo,
    format?: string,
  ): Promise<SignedContratoUrl>;
  /** Descarga server-side (para reincrustar firmas previas en una nueva versión). */
  download(publicId: string, kind: ContratoArchivoTipo, format?: string): Promise<Buffer>;
  /** Borrado de mejor esfuerzo cuando falla la transacción posterior. */
  delete(publicId: string, kind: ContratoArchivoTipo): Promise<void>;
}
