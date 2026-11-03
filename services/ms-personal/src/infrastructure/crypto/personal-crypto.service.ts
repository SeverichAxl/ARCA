import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptAesGcm, encryptAesGcm, hmacSha256 } from 'crypto-utils';

@Injectable()
export class PersonalCryptoService {
  private readonly llave: Buffer;
  private readonly llaveCi: string;

  constructor(config: ConfigService) {
    this.llave = Buffer.from(config.get<string>('ENC_KEY_PERSONAL') ?? '', 'base64');
    if (this.llave.length !== 32) {
      throw new Error('ENC_KEY_PERSONAL debe ser una llave de 32 bytes codificada en base64.');
    }
    this.llaveCi = config.get<string>('CI_HMAC_KEY') ?? '';
    if (!this.llaveCi || this.llaveCi.startsWith('change_me')) {
      throw new Error('CI_HMAC_KEY no está configurada.');
    }
  }

  cifrar(texto: string): string {
    return encryptAesGcm(texto, this.llave);
  }

  descifrar(cifrado: string): string {
    return decryptAesGcm(cifrado, this.llave);
  }

  cifrarMonto(monto: number): string {
    return this.cifrar(monto.toFixed(2));
  }

  descifrarMonto(cifrado: string): number {
    return Number(this.descifrar(cifrado));
  }

  /** CI normalizada: mayúsculas, sin espacios ni puntos (ej. "1234567-1B"). */
  normalizarCi(ci: string): string {
    return ci.trim().toUpperCase().replace(/[\s.]/g, '');
  }

  hashCi(ci: string): string {
    return hmacSha256(this.normalizarCi(ci), this.llaveCi);
  }

  enmascararCi(ciCifrado: string): string {
    return `***${this.descifrar(ciCifrado).slice(-4)}`;
  }
}
