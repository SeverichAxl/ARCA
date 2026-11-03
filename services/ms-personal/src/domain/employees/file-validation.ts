export type ArchivoTipo = 'png' | 'jpeg' | 'pdf';

export const MAX_FIRMA_BYTES = 5 * 1024 * 1024;
export const MAX_AUTORIZACION_BYTES = 10 * 1024 * 1024;
export const MAX_RESPALDO_BYTES = 10 * 1024 * 1024;

export interface ArchivoEntrante {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

export class ArchivoInvalidoError extends Error {
  constructor(message = 'El archivo no es válido o supera el tamaño permitido.') {
    super(message);
    this.name = 'ArchivoInvalidoError';
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

export function detectarTipoArchivo(buffer: Buffer): ArchivoTipo | null {
  if (buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return 'png';
  }
  if (
    buffer.length >= JPEG_MAGIC.length &&
    buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)
  ) {
    return 'jpeg';
  }
  if (buffer.length >= PDF_MAGIC.length && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return 'pdf';
  }
  return null;
}

function validarBase(archivo: ArchivoEntrante, maxBytes: number, tipos: ArchivoTipo[]): ArchivoTipo {
  if (!archivo || !Buffer.isBuffer(archivo.buffer) || archivo.buffer.length === 0) {
    throw new ArchivoInvalidoError('El archivo está vacío.');
  }
  if (archivo.buffer.length > maxBytes) {
    throw new ArchivoInvalidoError('El archivo supera el tamaño permitido.');
  }

  const tipo = detectarTipoArchivo(archivo.buffer);
  if (!tipo || !tipos.includes(tipo)) {
    throw new ArchivoInvalidoError('El contenido del archivo no corresponde a un tipo permitido.');
  }
  return tipo;
}

/** Firma digitalizada: PNG o JPEG reales, máximo 5 MiB. */
export function validarFirma(archivo: ArchivoEntrante): ArchivoTipo {
  return validarBase(archivo, MAX_FIRMA_BYTES, ['png', 'jpeg']);
}

/** Autorización del Ministerio: PDF real, máximo 10 MiB. */
export function validarAutorizacionMinisterio(archivo: ArchivoEntrante): 'pdf' {
  return validarBase(archivo, MAX_AUTORIZACION_BYTES, ['pdf']) as 'pdf';
}

/** Respaldo de inamovilidad: PDF, PNG o JPEG, máximo 10 MiB. */
export function validarRespaldo(archivo: ArchivoEntrante): ArchivoTipo {
  return validarBase(archivo, MAX_RESPALDO_BYTES, ['pdf', 'png', 'jpeg']);
}
