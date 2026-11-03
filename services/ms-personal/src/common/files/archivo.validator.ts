import { extname } from 'node:path';
import { Errores } from '../../domain/errors/domain.error';

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const MAX_FIRMA_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

function empiezaCon(buffer: Buffer, firma: number[]): boolean {
  return buffer.length >= firma.length && firma.every((byte, i) => buffer[i] === byte);
}

/** Firma gráfica: extensión, MIME y bytes mágicos deben coincidir (PNG o JPEG). */
export function validarImagenFirma(archivo: ArchivoSubido): void {
  if (!archivo.buffer?.length || archivo.size > MAX_FIRMA_BYTES) throw Errores.archivoInvalido();
  const ext = extname(archivo.originalname).toLowerCase();
  const esPng = ext === '.png' && archivo.mimetype === 'image/png' && empiezaCon(archivo.buffer, PNG);
  const esJpeg =
    ['.jpg', '.jpeg'].includes(ext) && archivo.mimetype === 'image/jpeg' && empiezaCon(archivo.buffer, JPEG);
  if (!esPng && !esJpeg) throw Errores.archivoInvalido();
}

/** Autorización del Ministerio de Trabajo: PDF real. */
export function validarPdf(archivo: ArchivoSubido): void {
  if (!archivo.buffer?.length || archivo.size > MAX_PDF_BYTES) throw Errores.archivoInvalido();
  const ext = extname(archivo.originalname).toLowerCase();
  if (ext !== '.pdf' || archivo.mimetype !== 'application/pdf' || !empiezaCon(archivo.buffer, PDF)) {
    throw Errores.archivoInvalido();
  }
}
