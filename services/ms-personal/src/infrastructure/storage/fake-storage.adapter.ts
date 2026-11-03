import { randomUUID } from 'node:crypto';
import type { DocumentStoragePort, TipoRecurso } from '../../domain/ports/document-storage.port';

/** Solo para pruebas y demo local sin Cloudinary (STORAGE_DRIVER=fake). */
export class FakeStorageAdapter implements DocumentStoragePort {
  readonly archivos = new Map<string, Buffer>();

  async subir(archivo: { buffer: Buffer; tipo: TipoRecurso; carpeta: string }): Promise<{ publicId: string }> {
    const publicId = `${archivo.carpeta}/${randomUUID()}`;
    this.archivos.set(publicId, archivo.buffer);
    return { publicId };
  }

  urlFirmada(publicId: string, _tipo: TipoRecurso, ttlSegundos: number): { url: string; expiraEn: Date } {
    const expiraEn = new Date(Date.now() + ttlSegundos * 1000);
    return { url: `fake://storage/${publicId}?exp=${expiraEn.getTime()}`, expiraEn };
  }

  async eliminar(publicId: string, _tipo: TipoRecurso): Promise<void> {
    this.archivos.delete(publicId);
  }
}
