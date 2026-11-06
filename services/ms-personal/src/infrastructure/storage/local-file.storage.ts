import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ArchivoLogico,
  FileStoragePort,
  UploadFileInput,
} from '../../domain/employees/file-storage.port';
import { detectarTipoArchivo } from '../../domain/employees/file-validation';

const SIGNED_URL_TTL_SECONDS = 300;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Adaptador local fuera de rutas públicas. El archivo se guarda con un UUID
 * aleatorio y se sirve por una URL firmada de 5 minutos.
 */
@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly directory: string;
  private readonly signingKey: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    this.directory =
      configService.get<string>('STORAGE_LOCAL_DIR') ??
      join(process.cwd(), 'storage', 'personal');
    const signingKey =
      configService.get<string>('STORAGE_SIGNING_KEY') ??
      configService.get<string>('CI_HMAC_KEY');
    if (!signingKey) {
      throw new Error('Falta STORAGE_SIGNING_KEY o CI_HMAC_KEY para firmar URLs locales.');
    }
    this.signingKey = signingKey;
    const base =
      configService.get<string>('STORAGE_PUBLIC_BASE_URL') ??
      configService.get<string>('PERSONAL_PUBLIC_URL') ??
      `http://127.0.0.1:${configService.get<string>('PORT') ?? '4002'}`;
    this.publicBaseUrl = base.replace(/\/$/, '');
  }

  async upload(input: UploadFileInput): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const publicId = randomUUID();
    await writeFile(join(this.directory, publicId), input.buffer, { flag: 'wx' });
    return publicId;
  }

  async delete(publicId: string, _kind: ArchivoLogico): Promise<void> {
    if (!UUID_PATTERN.test(publicId)) return;
    try {
      await unlink(join(this.directory, publicId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('No se pudo borrar un archivo local tras un fallo de transacción.');
      }
    }
  }

  async signedUrl(publicId: string, _kind: ArchivoLogico): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const signature = this.sign(publicId, expires);
    return `${this.publicBaseUrl}/files/${publicId}?expires=${expires}&signature=${signature}`;
  }

  /** Lee un archivo local solo si la firma y la expiración son válidas. */
  async readSigned(
    publicId: string,
    expires: string,
    signature: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!UUID_PATTERN.test(publicId)) return null;
    const expiresNumber = Number(expires);
    const now = Math.floor(Date.now() / 1000);
    if (
      !Number.isInteger(expiresNumber) ||
      expiresNumber <= now ||
      expiresNumber > now + SIGNED_URL_TTL_SECONDS
    ) {
      return null;
    }

    const expected = this.sign(publicId, expiresNumber);
    const received = Buffer.from(signature ?? '', 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      received.length !== expectedBuffer.length ||
      !timingSafeEqual(received, expectedBuffer)
    ) {
      return null;
    }

    try {
      const buffer = await readFile(join(this.directory, publicId));
      const tipo = detectarTipoArchivo(buffer);
      const contentType =
        tipo === 'pdf'
          ? 'application/pdf'
          : tipo === 'png'
            ? 'image/png'
            : tipo === 'jpeg'
              ? 'image/jpeg'
              : 'application/octet-stream';
      return { buffer, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private sign(publicId: string, expires: number): string {
    return createHmac('sha256', this.signingKey)
      .update(`${publicId}:${expires}`)
      .digest('hex');
  }
}
