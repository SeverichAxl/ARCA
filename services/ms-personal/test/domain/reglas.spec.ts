import { diasComerciales, hoyBolivia, parseFecha } from '../../src/domain/empleado/fechas';
import { inamovilidadVigente } from '../../src/domain/empleado/inamovilidad';
import { superaLimiteExtranjeros } from '../../src/domain/empleado/limite-extranjeros';
import { evaluarRatificacion } from '../../src/domain/empleado/periodo-prueba';

const d = (valor: string) => parseFecha(valor) as Date;

describe('fechas', () => {
  it('rechaza fechas inexistentes o formatos alternativos', () => {
    expect(parseFecha('2026-02-30')).toBeNull();
    expect(parseFecha('30/10/2026')).toBeNull();
  });

  it('calcula días comerciales inclusivos y meses completos como 30 días', () => {
    expect(diasComerciales(d('2026-01-01'), d('2026-01-31'))).toBe(30);
    expect(diasComerciales(d('2026-01-01'), d('2026-02-28'))).toBe(60);
  });

  it('obtiene el día calendario de Bolivia', () => {
    expect(hoyBolivia(new Date('2026-11-03T02:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-02');
  });
});

describe('ratificación', () => {
  const base = { fechaIngreso: d('2026-01-01'), diasPrueba: 90, hoy: d('2026-11-03') };

  it('rechaza ratificar antes de cumplir el periodo de prueba', () => {
    expect(evaluarRatificacion({ ...base, fechaRatificacion: d('2026-03-31') })).toEqual({
      ok: false,
      motivo: 'ANTICIPADA',
      ratificableDesde: '2026-04-01',
    });
  });

  it('permite ratificar desde el día siguiente al periodo', () => {
    expect(evaluarRatificacion({ ...base, fechaRatificacion: d('2026-04-01') })).toEqual({ ok: true });
  });

  it('rechaza fechas futuras', () => {
    const resultado = evaluarRatificacion({
      fechaIngreso: d('2026-10-01'),
      diasPrueba: 90,
      hoy: d('2026-11-03'),
      fechaRatificacion: d('2027-01-15'),
    });

    expect(resultado).toMatchObject({ ok: false, motivo: 'FECHA_FUTURA' });
  });
});

describe('límite de extranjeros', () => {
  it('permite un extranjero entre seis funcionarios nacionales', () => {
    expect(superaLimiteExtranjeros(6, 0, 15)).toBe(false);
  });

  it('bloquea un extranjero entre cinco funcionarios nacionales', () => {
    expect(superaLimiteExtranjeros(5, 0, 15)).toBe(true);
  });
});

describe('inamovilidad vigente', () => {
  const inamovilidad = {
    estadoActivo: true,
    fechaInicio: d('2026-05-01'),
    fechaFin: d('2027-05-01'),
  };

  it('está vigente dentro del rango', () => {
    expect(inamovilidadVigente(inamovilidad, d('2026-10-30'))).toBe(true);
  });

  it('no está vigente después de la fecha fin', () => {
    expect(inamovilidadVigente(inamovilidad, d('2027-06-01'))).toBe(false);
  });

  it('no está vigente si se encuentra cerrada', () => {
    expect(inamovilidadVigente({ ...inamovilidad, estadoActivo: false }, d('2026-10-30'))).toBe(false);
  });
});
