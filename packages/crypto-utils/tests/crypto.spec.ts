import { randomBytes } from 'node:crypto';
import { decryptAesGcm, encryptAesGcm, hmacSha256, sha256Hex } from '../src';

describe('crypto-utils', () => {
  const key = randomBytes(32);

  describe('AES-256-GCM', () => {
    it('cifra y descifra un texto correctamente', () => {
      const plaintext = 'Número de cédula: 1234567890';

      const encrypted = encryptAesGcm(plaintext, key);
      const decrypted = decryptAesGcm(encrypted, key);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toContain(plaintext);
    });

    it('genera un IV aleatorio distinto en cada cifrado', () => {
      const first = encryptAesGcm('mismo texto', key);
      const second = encryptAesGcm('mismo texto', key);

      expect(first).not.toBe(second);
      expect(first.split('.')).toHaveLength(3);
      expect(second.split('.')).toHaveLength(3);
    });

    it('usa el formato ivB64.tagB64.cipherB64 con partes base64 válidas', () => {
      const [iv, tag, cipher] = encryptAesGcm('dato sensible', key).split('.');

      expect(Buffer.from(iv, 'base64')).toHaveLength(12);
      expect(Buffer.from(tag, 'base64')).toHaveLength(16);
      expect(Buffer.from(cipher, 'base64').toString('utf8')).not.toBe('dato sensible');
    });

    it('falla al descifrar con una llave incorrecta', () => {
      const encrypted = encryptAesGcm('dato sensible', key);

      expect(() => decryptAesGcm(encrypted, randomBytes(32))).toThrow();
    });

    it('rechaza llaves que no tengan 32 bytes', () => {
      expect(() => encryptAesGcm('texto', randomBytes(16))).toThrow(/32 bytes/);
      expect(() => decryptAesGcm('a.b.c', randomBytes(31))).toThrow(/32 bytes/);
    });

    it('rechaza payloads con formato inválido', () => {
      expect(() => decryptAesGcm('no-es-un-payload', key)).toThrow(/Formato/);
    });
  });

  describe('hmacSha256', () => {
    it('es determinista para la misma entrada y llave', () => {
      const first = hmacSha256('valor', 'llave');
      const second = hmacSha256('valor', 'llave');

      expect(first).toBe(second);
      expect(first).toMatch(/^[0-9a-f]{64}$/);
    });

    it('cambia cuando cambia la llave', () => {
      expect(hmacSha256('valor', 'llave-a')).not.toBe(hmacSha256('valor', 'llave-b'));
    });

    it('acepta Buffers como entrada', () => {
      expect(hmacSha256(Buffer.from('valor'), Buffer.from('llave'))).toBe(
        hmacSha256('valor', 'llave'),
      );
    });
  });

  describe('sha256Hex', () => {
    it('calcula el hash hexadecimal esperado', () => {
      expect(sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('retorna 64 caracteres hexadecimales', () => {
      expect(sha256Hex('cualquier valor')).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
