import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'node:crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`La llave debe ser un Buffer de ${KEY_LENGTH_BYTES} bytes (AES-256).`);
  }
}

/**
 * Cifra un texto con AES-256-GCM usando un IV aleatorio de 12 bytes.
 * Formato de salida: "ivB64.tagB64.cipherB64".
 */
export function encryptAesGcm(plaintext: string, key: Buffer): string {
  assertKey(key);

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    '.',
  );
}

/**
 * Descifra un payload con formato "ivB64.tagB64.cipherB64".
 * Lanza un error si el formato, la llave o la etiqueta de autenticación no son válidos.
 */
export function decryptAesGcm(payload: string, key: Buffer): string {
  assertKey(key);

  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de payload inválido. Se esperaba "ivB64.tagB64.cipherB64".');
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('IV o etiqueta de autenticación con longitud inválida.');
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Calcula HMAC-SHA256 y retorna el resultado en hexadecimal.
 */
export function hmacSha256(valor: string | Buffer, llave: string | Buffer): string {
  return createHmac('sha256', llave).update(valor).digest('hex');
}

/**
 * Calcula SHA-256 y retorna el resultado en hexadecimal.
 */
export function sha256Hex(valor: string | Buffer): string {
  return createHash('sha256').update(valor).digest('hex');
}
