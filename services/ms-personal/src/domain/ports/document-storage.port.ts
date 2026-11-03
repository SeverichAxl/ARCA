/** Puerto de almacenamiento de documentos (firma, autorización del Ministerio de Trabajo). */
export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export type TipoRecurso = 'image' | 'raw';

export interface DocumentStoragePort {
  subir(archivo: { buffer: Buffer; tipo: TipoRecurso; carpeta: string }): Promise<{ publicId: string }>;
  urlFirmada(publicId: string, tipo: TipoRecurso, ttlSegundos: number): { url: string; expiraEn: Date };
  eliminar(publicId: string, tipo: TipoRecurso): Promise<void>;
}
