import { addYearsClamped, calendarDifference } from '../common/date-only';
import { calcularFiniquito } from './finiquito';
import { normalizarCi } from './ci';
import {
  MAX_AUTORIZACION_BYTES,
  MAX_FIRMA_BYTES,
  validarAutorizacionMinisterio,
  validarFirma,
} from './file-validation';
import { excedeLimiteExtranjeros } from './foreign-limit';
import { algunaInamovilidadActiva, estaInamovilidadActiva } from './inamovilidad';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const pdf = Buffer.from('%PDF-1.7\n', 'ascii');

describe('CI', () => {
  it('normaliza mayúsculas, espacios y guiones con el mismo formato de búsqueda', () => {
    expect(normalizarCi('  ab- 12345 ')).toBe('AB12345');
  });

  it('rechaza CI fuera del patrón contractual', () => {
    expect(() => normalizarCi('1234')).toThrow();
    expect(() => normalizarCi('AB_12345')).toThrow();
  });
});

describe('fechas de calendario', () => {
  it('clampa el aniversario del 29 de febrero al último día de febrero', () => {
    expect(addYearsClamped('2020-02-29', 1)).toBe('2021-02-28');
  });

  it('distingue el día anterior al aniversario', () => {
    expect(calendarDifference('2020-01-01', '2020-12-31')).toMatchObject({
      years: 0,
      months: 11,
      days: 30,
    });
  });

  it('representa un día de servicio cuando ingreso y baja coinciden', () => {
    expect(calendarDifference('2026-11-30', '2026-12-01')).toMatchObject({
      years: 0,
      months: 0,
      days: 1,
    });
  });
});

describe('validación por magic bytes', () => {
  it('acepta PNG y JPEG por su contenido sin confiar en MIME o nombre', () => {
    expect(
      validarFirma({
        originalname: 'archivo.pdf',
        mimetype: 'application/pdf',
        buffer: png,
      }),
    ).toBe('png');
    expect(
      validarFirma({
        originalname: 'firma.bin',
        mimetype: 'application/octet-stream',
        buffer: jpeg,
      }),
    ).toBe('jpeg');
  });

  it('acepta autorización PDF por su firma real', () => {
    expect(
      validarAutorizacionMinisterio({
        originalname: 'autorizacion.bin',
        mimetype: 'text/plain',
        buffer: pdf,
      }),
    ).toBe('pdf');
  });

  it('rechaza vacíos, contenido renombrado y tamaños mayores a los topes', () => {
    expect(() =>
      validarFirma({ originalname: 'firma.png', buffer: Buffer.alloc(0) }),
    ).toThrow();
    expect(() =>
      validarFirma({ originalname: 'firma.png', buffer: Buffer.from('not a PNG') }),
    ).toThrow();
    expect(() =>
      validarFirma({
        originalname: 'firma.png',
        buffer: Buffer.concat([png, Buffer.alloc(MAX_FIRMA_BYTES)]),
      }),
    ).toThrow();
    expect(() =>
      validarAutorizacionMinisterio({
        originalname: 'autorizacion.pdf',
        buffer: Buffer.concat([pdf, Buffer.alloc(MAX_AUTORIZACION_BYTES)]),
      }),
    ).toThrow();
  });
});

describe('límite de personal extranjero', () => {
  it('compara la proporción tras sumar el alta y permite el límite exacto', () => {
    expect(
      excedeLimiteExtranjeros({
        activos: 5,
        extranjerosActivos: 0,
        limitePct: '16.67',
        nuevoEsExtranjero: true,
      }),
    ).toBe(false);
    expect(
      excedeLimiteExtranjeros({
        activos: 5,
        extranjerosActivos: 1,
        limitePct: '33.33',
        nuevoEsExtranjero: true,
      }),
    ).toBe(true);
    expect(
      excedeLimiteExtranjeros({
        activos: 5,
        extranjerosActivos: 1,
        limitePct: '100',
        nuevoEsExtranjero: false,
      }),
    ).toBe(false);
  });
});

describe('inamovilidad', () => {
  it('evalúa fin inclusive y respeta estadoActivo', () => {
    expect(
      estaInamovilidadActiva(
        { estadoActivo: true, fechaInicio: '2026-01-01', fechaFin: '2026-11-30' },
        '2026-11-30',
      ),
    ).toBe(true);
    expect(
      estaInamovilidadActiva(
        { estadoActivo: true, fechaInicio: '2026-01-01', fechaFin: '2026-11-29' },
        '2026-11-30',
      ),
    ).toBe(false);
    expect(
      estaInamovilidadActiva(
        { estadoActivo: true, fechaInicio: '2026-12-01', fechaFin: null },
        '2026-11-30',
      ),
    ).toBe(false);
    expect(
      algunaInamovilidadActiva(
        [{ estadoActivo: false, fechaInicio: '2026-01-01', fechaFin: null }],
        '2026-11-30',
      ),
    ).toBe(false);
  });
});

describe('finiquito', () => {
  const cases = [
    {
      input: {
        spi: '6000.00',
        fechaIngreso: '2020-03-01',
        fechaBaja: '2026-11-30',
        aplicaDesahucio: false,
      },
      expected: ['40500.00', '0.00', '5500.00', '0.00', '46000.00'],
      period: [6, 9, 0],
    },
    {
      input: {
        spi: '4500.00',
        fechaIngreso: '2023-08-16',
        fechaBaja: '2026-05-20',
        aplicaDesahucio: true,
        diasVacacionesPendientes: 10,
      },
      expected: ['12437.50', '13500.00', '1750.00', '1500.00', '29187.50'],
      period: [2, 9, 5],
    },
    {
      input: {
        spi: '3500.00',
        fechaIngreso: '2026-09-01',
        fechaBaja: '2026-10-15',
        aplicaDesahucio: true,
      },
      expected: ['0.00', '0.00', '437.50', '0.00', '437.50'],
      period: [0, 1, 15],
    },
    {
      input: {
        spi: '5000.00',
        fechaIngreso: '2024-01-10',
        fechaBaja: '2026-02-28',
        aplicaDesahucio: false,
        diasVacacionesPendientes: 3,
      },
      expected: ['10680.56', '0.00', '833.33', '500.00', '12013.89'],
      period: [2, 1, 19],
    },
  ] as const;

  it.each(cases)('coincide exactamente con el caso de referencia %#', ({ input, expected, period }) => {
    const result = calcularFiniquito(input);
    expect([
      result.indemnizacion,
      result.desahucio,
      result.aguinaldo,
      result.vacaciones,
      result.total,
    ]).toEqual(expected);
    expect([result.periodo.years, result.periodo.months, result.periodo.days]).toEqual(period);
  });

  it('cuenta la baja del 31/12 inclusive y no da de baja antes de ingresar', () => {
    const result = calcularFiniquito({
      spi: '1200.00',
      fechaIngreso: '2026-12-31',
      fechaBaja: '2026-12-31',
      aplicaDesahucio: false,
    });
    expect(result.periodo).toMatchObject({ years: 0, months: 0, days: 1 });
    expect(result.aguinaldo).toBe('3.33');
  });

  it('calcula cantidades con centavos sin aritmética de punto flotante', () => {
    const result = calcularFiniquito({
      spi: '100.01',
      fechaIngreso: '2025-01-01',
      fechaBaja: '2025-01-30',
      aplicaDesahucio: false,
    });
    expect(result.aguinaldo).toBe('8.33');
    expect(result.total).toBe('8.33');
  });

  it('suprime indemnización y desahucio en el día 89, y los habilita al día 90', () => {
    const day89 = calcularFiniquito({
      spi: '3000.00',
      fechaIngreso: '2026-09-01',
      fechaBaja: '2026-11-28',
      aplicaDesahucio: true,
    });
    const day90 = calcularFiniquito({
      spi: '3000.00',
      fechaIngreso: '2026-09-01',
      fechaBaja: '2026-11-29',
      aplicaDesahucio: true,
    });
    const day91 = calcularFiniquito({
      spi: '3000.00',
      fechaIngreso: '2026-09-01',
      fechaBaja: '2026-11-30',
      aplicaDesahucio: true,
    });
    expect(day89.antiguedadDias).toBe(89);
    expect(day89.indemnizacion).toBe('0.00');
    expect(day89.desahucio).toBe('0.00');
    expect(day90.antiguedadDias).toBe(90);
    expect(day90.desahucio).toBe('9000.00');
    expect(day91.antiguedadDias).toBe(91);
    expect(day91.desahucio).toBe('9000.00');
  });
});
