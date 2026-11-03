import { parseFecha } from '../../src/domain/empleado/fechas';
import { calcularFiniquito } from '../../src/domain/empleado/finiquito';

const d = (valor: string) => parseFecha(valor) as Date;

describe('calcularFiniquito', () => {
  const base = {
    fechaIngreso: d('2023-03-01'),
    fechaBaja: d('2026-10-30'),
    sueldos: [6000],
    diasVacacionPendientes: 10,
  };

  it('calcula el finiquito sin desahucio', () => {
    const resultado = calcularFiniquito({ ...base, aplicaDesahucio: false });

    expect(resultado.tiempoServicio).toEqual({ anios: 3, meses: 8, dias: 0, totalDias: 1320 });
    expect(resultado.sueldoPromedioIndemnizable).toBe(6000);
    expect(resultado.indemnizacion).toEqual({
      aplica: true,
      porAnios: 18000,
      porDuodecimas: 4000,
      porDias: 0,
      monto: 22000,
    });
    expect(resultado.aguinaldo).toEqual({ diasComputables: 300, monto: 5000 });
    expect(resultado.vacaciones.monto).toBe(2000);
    expect(resultado.desahucio).toEqual({ aplica: false, monto: 0 });
    expect(resultado.total).toBe(29000);
  });

  it('suma tres salarios por desahucio cuando aplica', () => {
    const resultado = calcularFiniquito({ ...base, aplicaDesahucio: true });

    expect(resultado.desahucio).toEqual({ aplica: true, monto: 18000 });
    expect(resultado.total).toBe(47000);
  });

  it('promedia los últimos tres sueldos', () => {
    const resultado = calcularFiniquito({
      ...base,
      sueldos: [5000, 6000, 7000],
      aplicaDesahucio: false,
    });

    expect(resultado.sueldoPromedioIndemnizable).toBe(6000);
  });

  it('incluye los días sueltos en la indemnización', () => {
    const resultado = calcularFiniquito({
      fechaIngreso: d('2025-01-01'),
      fechaBaja: d('2026-03-15'),
      sueldos: [3600],
      aplicaDesahucio: false,
      diasVacacionPendientes: 0,
    });

    expect(resultado.tiempoServicio).toEqual({ anios: 1, meses: 2, dias: 15, totalDias: 435 });
    expect(resultado.indemnizacion.monto).toBe(4350);
    expect(resultado.aguinaldo.monto).toBe(0);
    expect(resultado.total).toBe(4350);
  });

  it('no calcula indemnización con menos de 90 días', () => {
    const resultado = calcularFiniquito({
      fechaIngreso: d('2026-09-01'),
      fechaBaja: d('2026-10-30'),
      sueldos: [4000],
      aplicaDesahucio: false,
      diasVacacionPendientes: 0,
    });

    expect(resultado.indemnizacion.aplica).toBe(false);
    expect(resultado.total).toBe(0);
  });

  it('rechaza fecha de baja anterior al ingreso', () => {
    expect(() =>
      calcularFiniquito({ ...base, fechaBaja: d('2020-01-01'), aplicaDesahucio: false }),
    ).toThrow();
  });
});
