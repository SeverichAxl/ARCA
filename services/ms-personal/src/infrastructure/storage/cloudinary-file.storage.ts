import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type {
  ArchivoLogico,
  FileStoragePort,
  UploadFileInput,
} from '../../domain/employees/file-storage.port';

const SIGNED_URL_TTL_SECONDS = 300;

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

/**
 * Adaptador Cloudinary sin SDK: usa la API REST de carga y URLs firmadas.
 * Los archivos se suben como `authenticated` y en BD solo se guarda el
 * public_id devuelto por Cloudinary.
 *
 * Limitación: la expiración efectiva de la URL depende de las políticas del
 * plan de Cloudinary; debe verificarse con credenciales reales.
 */
@Injectable()
export class CloudinaryFileStorage implements FileStoragePort {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folder: string;

  constructor(configService: ConfigService) {
    this.cloudName = this.required(configService, 'CLOUDINARY_CLOUD_NAME');
    this.apiKey = this.required(configService, 'CLOUDINARY_API_KEY');
    this.apiSecret = this.required(configService, 'CLOUDINARY_API_SECRET');
    this.folder = configService.get<string>('CLOUDINARY_FOLDER') ?? 'arca/documentos';
  }

  async upload(input: UploadFileInput): Promise<string> {
    const publicId = randomUUID();
    const resourceType = input.kind === 'autorizacion' ? 'raw' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      folder: this.folder,
      public_id: publicId,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    const signature = this.sign(params);

    const form = new FormData();
    form.append('file', new Blob([input.buffer]), input.originalName);
    form.append('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) form.append(key, value);
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary rechazó la carga (${response.status}).`);
    }
    const body = (await response.json()) as { public_id?: string };
    if (!body.public_id) throw new Error('Cloudinary no devolvió public_id.');
    return body.public_id;
  }

  async delete(publicId: string, kind: ArchivoLogico): Promise<void> {
    const resourceType = kind === 'autorizacion' ? 'raw' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      public_id: publicId,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    const signature = this.sign(params);

    const form = new FormData();
    form.append('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) form.append(key, value);
    form.append('signature', signature);

    await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: form },
    );
  }

  async signedUrl(publicId: string, kind: ArchivoLogico): Promise<string> {
    const resourceType = kind === 'autorizacion' ? 'raw' : 'image';
    const suffix = kind === 'autorizacion' ? '.pdf' : '';
    const path = `/${this.cloudName}/${resourceType}/authenticated/${publicId}${suffix}`;
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const signature = sha1(`${path}${this.apiSecret}`);
    return `https://res.cloudinary.com${path}?expires_at=${expiresAt}&signature=${signature}`;
  }

  private sign(params: Record<string, string>): string {
    const serialized = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return sha1(`${serialized}${this.apiSecret}`);
  }

  private required(configService: ConfigService, key: string): string {
    const value = configService.get<string>(key);
    if (!value) throw new Error(`Falta ${key}: no se puede usar STORAGE_DRIVER=cloudinary.`);
    return value;
  }
}
