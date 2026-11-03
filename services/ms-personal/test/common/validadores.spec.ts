import { enmascarar } from '../../src/common/audit/enmascarar';
import { validarImagenFirma, validarPdf } from '../../src/common/files/archivo.validator';
import { DomainError } from '../../src/domain/errors/domain.error';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const archivo = (originalname: string, mimetype: string, buffer: Buffer) => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('validación de archivos', () => {
  it('acepta una firma PNG con encabezado válido', () => {
    expect(() => validarImagenFirma(archivo('firma.png', 'image/png', png))).not.toThrow();
  });

  it('rechaza un PDF renombrado como PNG', () => {
    expect(() => validarImagenFirma(archivo('firma.png', 'image/png', Buffer.from('%PDF-1.7')))).toThrow(
      DomainError,
    );
  });

  it('acepta una autorización PDF con encabezado válido', () => {
    expect(() =>
      validarPdf(archivo('mt.pdf', 'application/pdf', Buffer.from('%PDF-1.7 ...'))),
    ).not.toThrow();
  });
});

describe('enmascarado de auditoría', () => {
  it('oculta CI y remuneraciones y conserva otros datos', () => {
    expect(
      enmascarar({
        ci: '1234567',
        antes: { remuneracion: 5000 },
        despues: { remuneracionNueva: 6000, areaId: 'x' },
      }),
    ).toEqual({
      ci: '***4567',
      antes: { remuneracion: '***' },
      despues: { remuneracionNueva: '***', areaId: 'x' },
    });
  });

  it('oculta también los campos CI cifrados y hash', () => {
    expect(enmascarar({ ciCifrado: 'payload', ciHash: 'hash' })).toEqual({
      ciCifrado: '***',
      ciHash: '***',
    });
  });
});
