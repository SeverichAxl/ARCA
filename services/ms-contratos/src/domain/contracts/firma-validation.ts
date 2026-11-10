export type FirmaMime = 'image/png' | 'image/jpeg';

export const MAX_FIRMA_BYTES = 5 * 1024 * 1024;
export const FIRMAS_PERMITIDAS: readonly FirmaMime[] = ['image/png', 'image/jpeg'];

export interface ArchivoFirmaEntrante {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

export class FirmaInvalidaError extends Error {
  constructor(message = 'La firma no es válida o supera el tamaño permitido.') {
    super(message);
    this.name = 'FirmaInvalidaError';
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** Detecta PNG/JPEG por magic bytes, sin confiar en la extensión del archivo. */
export function detectarMimeFirma(buffer: Buffer): FirmaMime | null {
  if (
    buffer.length >= PNG_MAGIC.length &&
    buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= JPEG_MAGIC.length &&
    buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)
  ) {
    return 'image/jpeg';
  }
  return null;
}

/**
 * Valida una firma gráfica: tamaño máximo 5 MiB, mime declarado permitido y
 * contenido real coherente con ese mime. Devuelve el mime normalizado.
 */
export function validarFirma(archivo: ArchivoFirmaEntrante): FirmaMime {
  if (!archivo || !Buffer.isBuffer(archivo.buffer) || archivo.buffer.length === 0) {
    throw new FirmaInvalidaError('La firma está vacía.');
  }
  if (archivo.buffer.length > MAX_FIRMA_BYTES) {
    throw new FirmaInvalidaError('La firma supera el tamaño máximo de 5 MiB.');
  }

  const declarado = archivo.mimetype?.toLowerCase();
  if (
    declarado !== undefined &&
    declarado !== '' &&
    !FIRMAS_PERMITIDAS.includes(declarado as FirmaMime)
  ) {
    throw new FirmaInvalidaError('La firma debe ser una imagen PNG o JPEG.');
  }

  const detectado = detectarMimeFirma(archivo.buffer);
  if (!detectado) {
    throw new FirmaInvalidaError(
      'El contenido de la firma no corresponde a una imagen PNG o JPEG.',
    );
  }

  if (declarado && declarado !== detectado) {
    throw new FirmaInvalidaError(
      'El tipo declarado de la firma no coincide con su contenido real.',
    );
  }

  return detectado;
}

export function firmaComoDataUrl(buffer: Buffer, mimeType: FirmaMime): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
