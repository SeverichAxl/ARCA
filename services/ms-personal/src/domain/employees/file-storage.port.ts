export const FILE_STORAGE_PORT = Symbol('FILE_STORAGE_PORT');

export type ArchivoLogico = 'firma' | 'autorizacion' | 'respaldo';

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  kind: ArchivoLogico;
}

export interface FileStoragePort {
  /** Sube el archivo y devuelve solo el public_id aleatorio (nunca el nombre original). */
  upload(input: UploadFileInput): Promise<string>;
  /** Borrado de mejor esfuerzo tras una transacción fallida. */
  delete(publicId: string, kind: ArchivoLogico): Promise<void>;
  /** URL firmada de vida corta (máximo 5 minutos). */
  signedUrl(publicId: string, kind: ArchivoLogico): Promise<string>;
}
