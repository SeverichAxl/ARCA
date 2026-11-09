import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type {
  ContratoArchivoTipo,
  ContratoStoragePort,
  SignedContratoUrl,
  StoredContratoFile,
  UploadContratoFileInput,
} from '../../domain/contracts/contrato-storage.port';

const DEFAULT_TTL_SECONDS = 300;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 300;

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

interface CloudinaryUploadResponse {
  public_id?: string;
  version?: number | string;
  bytes?: number;
  format?: string;
  resource_type?: string;
}

/**
 * Adaptador Cloudinary sin SDK basado en la API REST.
 *
 * - El PDF se sube como `raw/authenticated`; las firmas como
 *   `image/authenticated`.
 * - Cada carga usa un `public_id` aleatorio nuevo: no existe operación de
 *   reemplazo, por lo que las versiones históricas quedan inmutables.
 * - La descarga se entrega con una URL firmada de vida corta (máximo 5 min).
 */
@Injectable()
export class CloudinaryContratoStorage implements ContratoStoragePort {
  private readonly logger = new Logger(CloudinaryContratoStorage.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folder: string;
  private readonly ttlSeconds: number;

  constructor(configService: ConfigService) {
    this.cloudName = this.required(configService, 'CLOUDINARY_CLOUD_NAME');
    this.apiKey = this.required(configService, 'CLOUDINARY_API_KEY');
    this.apiSecret = this.required(configService, 'CLOUDINARY_API_SECRET');
    const baseFolder =
      configService.get<string>('CLOUDINARY_FOLDER') ?? 'arca/documentos';
    this.folder =
      configService.get<string>('CONTRATOS_CLOUDINARY_FOLDER') ??
      `${baseFolder}/contratos`;
    this.ttlSeconds = this.resolveTtl(configService);
  }

  async upload(input: UploadContratoFileInput): Promise<StoredContratoFile> {
    const publicId = randomUUID();
    const resourceType = this.resourceType(input.kind);
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      folder: `${this.folder}/${input.contratoId}/${input.kind}`,
      public_id: publicId,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    const signature = this.sign(params);

    const form = new FormData();
    const filename =
      input.kind === 'documento' ? `contrato-${publicId}.pdf` : `firma-${publicId}`;
    form.append('file', new Blob([input.buffer]), filename);
    form.append('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) form.append(key, value);
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Cloudinary rechazó la carga (${response.status}): ${detail.slice(0, 200)}`,
      );
      throw new Error(`Cloudinary rechazó la carga (${response.status}).`);
    }

    const body = (await response.json()) as CloudinaryUploadResponse;
    if (!body.public_id) throw new Error('Cloudinary no devolvió public_id.');

    return {
      publicId: body.public_id,
      providerVersion:
        body.version === undefined || body.version === null
          ? null
          : String(body.version),
      mimeType:
        input.kind === 'documento' ? 'application/pdf' : input.mimeType,
      bytes: body.bytes ?? input.buffer.length,
    };
  }

  async signedUrl(
    publicId: string,
    kind: ContratoArchivoTipo,
    format?: string,
  ): Promise<SignedContratoUrl> {
    const now = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      timestamp: String(now),
      public_id: publicId,
      type: 'authenticated',
      expires_at: String(now + this.ttlSeconds),
    };
    if (format) params.format = format;

    const signature = this.sign(params);
    const query = new URLSearchParams({
      ...params,
      signature,
      api_key: this.apiKey,
    });
    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/${this.resourceType(kind)}/download?${query}`;

    return {
      url,
      expiresInSeconds: this.ttlSeconds,
    };
  }

  async download(
    publicId: string,
    kind: ContratoArchivoTipo,
    format?: string,
  ): Promise<Buffer> {
    const { url } = await this.signedUrl(publicId, kind, format);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo de Cloudinary (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(publicId: string, kind: ContratoArchivoTipo): Promise<void> {
    const resourceType = this.resourceType(kind);
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

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: form },
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudo borrar ${publicId}: ${message}`);
      return null;
    });
    if (response && !response.ok) {
      this.logger.warn(
        `Cloudinary no pudo borrar ${publicId} (${response.status}).`,
      );
    }
  }

  private resourceType(kind: ContratoArchivoTipo): 'raw' | 'image' {
    return kind === 'documento' ? 'raw' : 'image';
  }

  private sign(params: Record<string, string>): string {
    const serialized = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return sha1(`${serialized}${this.apiSecret}`);
  }

  private resolveTtl(configService: ConfigService): number {
    const raw = Number(configService.get<string>('CONTRATO_DOWNLOAD_TTL_SECONDS'));
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
    return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(raw)));
  }

  private required(configService: ConfigService, key: string): string {
    const value = configService.get<string>(key);
    if (!value) throw new Error(`Falta ${key}: no se puede usar Cloudinary.`);
    return value;
  }
}
