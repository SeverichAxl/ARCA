export const PDF_GENERATOR_PORT = Symbol('PDF_GENERATOR_PORT');

/**
 * Renderiza un documento HTML (contrato ya interpolado) a PDF. El adaptador
 * concreto decide el motor (Puppeteer/Chromium) y sus flags de contenedor.
 */
export interface PdfGeneratorPort {
  generate(html: string): Promise<Buffer>;
}
