import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { DocumentStoragePort, TipoRecurso } from '../../domain/ports/document-storage.port';

/**
 * Archivos privados (type "authenticated"): solo se acceden con URL firmada de corta duración.
 * En BD se guarda el public_id, nunca la URL.
 */
@Injectable()
export class CloudinaryStorageAdapter implements DocumentStoragePort {
  private readonly carpetaBase: string;

  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    this.carpetaBase = config.get<string>('CLOUDINARY_FOLDER') ?? 'arca/documentos';
  }

  subir(archivo: { buffer: Buffer; tipo: TipoRecurso; carpeta: string }): Promise<{ publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: archivo.tipo,
          type: 'authenticated',
          folder: `${this.carpetaBase}/${archivo.carpeta}`,
          unique_filename: true,
          overwrite: false,
        },
        (error, resultado) => {
          if (error || !resultado) {
            reject(error ?? new Error('Cloudinary no devolvió resultado.'));
            return;
          }
          resolve({ publicId: resultado.public_id });
        },
      );
      stream.end(archivo.buffer);
    });
  }

  urlFirmada(publicId: string, tipo: TipoRecurso, ttlSegundos: number): { url: string; expiraEn: Date } {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSegundos;
    const url = cloudinary.utils.private_download_url(publicId, '', {
      resource_type: tipo,
      type: 'authenticated',
      expires_at: expiresAt,
    });
    return { url, expiraEn: new Date(expiresAt * 1000) };
  }

  async eliminar(publicId: string, tipo: TipoRecurso): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: tipo, type: 'authenticated', invalidate: true });
  }
}
