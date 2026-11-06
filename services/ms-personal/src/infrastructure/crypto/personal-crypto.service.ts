import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptAesGcm, encryptAesGcm, hmacSha256 } from 'crypto-utils';

/**
 * Cifrado de datos sensibles de ms-personal. Las llaves se leen del entorno y
 * el servicio falla cerrado si no están configuradas.
 */
@Injectable()
export class PersonalCryptoService {
  private readonly encryptionKey: Buffer;
  private readonly ciHmacKey: string;

  constructor(configService: ConfigService) {
    this.encryptionKey = this.readEncryptionKey(configService);
    this.ciHmacKey = this.readHmacKey(configService);
  }

  encrypt(value: string): string {
    return encryptAesGcm(value, this.encryptionKey);
  }

  decrypt(value: string): string {
    return decryptAesGcm(value, this.encryptionKey);
  }

  hashCi(ciNormalizada: string): string {
    return hmacSha256(ciNormalizada, this.ciHmacKey);
  }

  private readEncryptionKey(configService: ConfigService): Buffer {
    const raw = configService.get<string>('ENC_KEY_PERSONAL');
    if (!raw) {
      throw new Error('Falta ENC_KEY_PERSONAL: ms-personal no puede arrancar sin la llave AES.');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('ENC_KEY_PERSONAL debe ser una llave AES-256 de 32 bytes en base64.');
    }
    return key;
  }

  private readHmacKey(configService: ConfigService): string {
    const key = configService.get<string>('CI_HMAC_KEY');
    if (!key || key.trim().length === 0) {
      throw new Error('Falta CI_HMAC_KEY: ms-personal no puede arrancar sin la llave HMAC.');
    }
    return key;
  }
}
