import { formatCents, toCents } from '../common/money';
import {
  calcularEmpleado,
  calcularPlanilla,
  type EmpleadoNomina,
  LiquidoNegativoError,
  NOVEDAD_VACIA,
  type NovedadNomina,
  NovedadInconsistenteError,
} from './calculo';
import {
  construirParametros,
  ParametrosIncompletosError,
  ParametrosInvalidosError,
} from './parametros';
import { filasIniciales } from './parametros-iniciales';
import {
  aniosAntiguedad,
  diasTrabajadosPorIngreso,
  parsePeriodo,
  PeriodoInvalidoError,
} from './periodo';

const periodo = parsePeriodo('2026-10');
const { filas, escala } = filasIniciales();
const parametros = construirParametros(periodo.fechaFin, filas, escala);

function empleado(overrides: Partial<EmpleadoNomina> = {}): EmpleadoNomina {
  return {
    empleadoId: '00000000-0000-4000-8000-000000000001',
    nombreCompleto: 'Ana Rojas',
    ciEnmascarado: '***4567',
    areaId: '00000000-0000-4000-8000-0000000000a1',
    cargoId: '00000000-0000-4000-8000-0000000000c1',
    fechaIngreso: '2020-01-01',
    haberBasico: toCents('5000.00'),
    ...overrides,
  };
}

function novedad(overrides: Partial<NovedadNomina> = {}): NovedadNomina {
  return { ...NOVEDAD_VACIA, ...overrides };
}

const fmt = (value: bigint) => formatCents(value);

describe('motor de cálculo mensual — casos contra cálculo manual', () => {
  it('funcionario con 6 años: bono 11 % de 3 SMN, sin ANS ni RC-IVA', () => {
    // Bono = 3 × 3300 × 11 % = 1089.00; TG = 6089.00
    // Aporte 12.71 % = 773.9119 -> 773.91; Patronal 16.71 % = 1017.4719 -> 1017.47
    // Neto 5315.09 < 2 SMN (6600) -> RC-IVA 0; Líquido = 5315.09
    const r = calcularEmpleado(empleado(), NOVEDAD_VACIA, 0n, periodo, parametros);
    expect(r.aniosAntiguedad).toBe(6);
    expect(fmt(r.bonoAntiguedad)).toBe('1089.00');
    expect(fmt(r.totalGanado)).toBe('6089.00');
    expect(fmt(r.aporteLaboral)).toBe('773.91');
    expect(fmt(r.ans)).toBe('0.00');
    expect(fmt(r.rcIva)).toBe('0.00');
    expect(fmt(r.aportePatronal)).toBe('1017.47');
    expect(fmt(r.liquidoPagable)).toBe('5315.09');
  });

  it('sin bono (1 año) y salario alto: ANS tramo 1 y RC-IVA sin facturas', () => {
    // TG 20000; aporte 2542.00; ANS 1 % × 7000 = 70.00; neto 17388.00
    // base = 17388 − 6600 = 10788.00; impuesto 13 % = 1402.44; cómputo 2 SMN = 858.00
    // RC-IVA = 544.44; líquido = 20000 − 2542 − 70 − 544.44 = 16843.56
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('20000') }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(r.aniosAntiguedad).toBe(1);
    expect(fmt(r.bonoAntiguedad)).toBe('0.00');
    expect(fmt(r.aporteLaboral)).toBe('2542.00');
    expect(fmt(r.ans)).toBe('70.00');
    expect(fmt(r.rcIvaBaseImponible)).toBe('10788.00');
    expect(fmt(r.rcIvaImpuesto)).toBe('1402.44');
    expect(fmt(r.rcIva)).toBe('544.44');
    expect(fmt(r.liquidoPagable)).toBe('16843.56');
    expect(fmt(r.aportePatronal)).toBe('3342.00');
  });

  it('RC-IVA computable editable: facturas reducen la retención', () => {
    const base = { fechaIngreso: '2025-03-01', haberBasico: toCents('20000') };
    const conFacturas = calcularEmpleado(
      empleado(base),
      novedad({ rcIvaComputable: toCents('3000') }), // 13 % = 390.00
      0n,
      periodo,
      parametros,
    );
    expect(fmt(conFacturas.rcIva)).toBe('154.44');
    expect(fmt(conFacturas.rcIvaSaldoSiguiente)).toBe('0.00');

    const excedente = calcularEmpleado(
      empleado(base),
      novedad({ rcIvaComputable: toCents('5000') }), // 13 % = 650.00
      0n,
      periodo,
      parametros,
    );
    expect(fmt(excedente.rcIva)).toBe('0.00');
    expect(fmt(excedente.rcIvaSaldoSiguiente)).toBe('105.56');
  });

  it('el saldo a favor anterior se consume antes de retener', () => {
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('20000') }),
      NOVEDAD_VACIA,
      toCents('100.00'),
      periodo,
      parametros,
    );
    expect(fmt(r.rcIva)).toBe('444.44');
    expect(fmt(r.rcIvaSaldoAnterior)).toBe('100.00');
    expect(fmt(r.rcIvaSaldoSiguiente)).toBe('0.00');

    const grande = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('20000') }),
      NOVEDAD_VACIA,
      toCents('600.00'),
      periodo,
      parametros,
    );
    expect(fmt(grande.rcIva)).toBe('0.00');
    expect(fmt(grande.rcIvaSaldoSiguiente)).toBe('55.56');
  });

  it('ANS acumula los tres tramos', () => {
    // TG 40000: 1 % × 27000 + 5 % × 15000 + 10 % × 5000 = 270 + 750 + 500
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('40000') }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(fmt(r.ans)).toBe('1520.00');
  });

  it('prorratea haber y bono por fecha de ingreso dentro del mes', () => {
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2026-10-16', haberBasico: toCents('3000') }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(r.diasTrabajados).toBe(15);
    expect(fmt(r.haberGanado)).toBe('1500.00');
    expect(fmt(r.bonoAntiguedad)).toBe('0.00');
  });

  it('redondea half-up una sola vez por concepto', () => {
    // 3333.33 × 17 / 30 = 1888.887 -> 1888.89
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('3333.33') }),
      novedad({ diasTrabajados: 17 }),
      0n,
      periodo,
      parametros,
    );
    expect(fmt(r.haberGanado)).toBe('1888.89');
    // 1888.89 × 12.71 % = 240.077919 -> 240.08
    expect(fmt(r.aporteLaboral)).toBe('240.08');
    expect(r.totalGanado).toBe(r.haberGanado + r.bonoAntiguedad + r.otrosIngresos);
    expect(r.liquidoPagable).toBe(r.totalGanado - r.totalDescuentos);
  });

  it('importes cero: 0 días trabajados dejan todo en cero, incluido el bono', () => {
    const r = calcularEmpleado(empleado(), novedad({ diasTrabajados: 0 }), 0n, periodo, parametros);
    for (const valor of [
      r.haberGanado,
      r.bonoAntiguedad,
      r.totalGanado,
      r.aporteLaboral,
      r.ans,
      r.rcIva,
      r.liquidoPagable,
      r.aportePatronal,
    ]) {
      expect(valor).toBe(0n);
    }
  });

  it('haber básico cero conserva solo el bono de antigüedad', () => {
    const r = calcularEmpleado(
      empleado({ haberBasico: 0n }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(fmt(r.haberGanado)).toBe('0.00');
    expect(fmt(r.totalGanado)).toBe('1089.00');
  });

  it('otros ingresos y descuentos se integran al total y al líquido', () => {
    const r = calcularEmpleado(
      empleado({ fechaIngreso: '2025-03-01' }),
      novedad({
        otrosIngresos: toCents('500'),
        otrosDescuentos: toCents('100'),
        subsidios: { natalidad: '3300.00' },
      }),
      0n,
      periodo,
      parametros,
    );
    expect(fmt(r.totalGanado)).toBe('5500.00');
    // aporte 699.05; líquido = 5500 − 699.05 − 100 = 4700.95 (subsidio informativo no suma)
    expect(fmt(r.liquidoPagable)).toBe('4700.95');
    expect(r.subsidios).toEqual({ natalidad: '3300.00' });
  });

  it('rechaza descuentos mayores al total ganado', () => {
    expect(() =>
      calcularEmpleado(
        empleado(),
        novedad({ otrosDescuentos: toCents('99999') }),
        0n,
        periodo,
        parametros,
      ),
    ).toThrow(LiquidoNegativoError);
  });

  it('rechaza más días que los posibles según la fecha de ingreso', () => {
    expect(() =>
      calcularEmpleado(
        empleado({ fechaIngreso: '2026-10-20' }),
        novedad({ diasTrabajados: 30 }),
        0n,
        periodo,
        parametros,
      ),
    ).toThrow(NovedadInconsistenteError);
  });

  it('es reproducible: mismas entradas, mismo resultado', () => {
    const a = calcularEmpleado(empleado(), NOVEDAD_VACIA, 0n, periodo, parametros);
    const b = calcularEmpleado(empleado(), NOVEDAD_VACIA, 0n, periodo, parametros);
    expect(a).toEqual(b);
  });
});

describe('antigüedad y calendario', () => {
  it.each([
    ['2024-10-31', 2],
    ['2024-11-01', 1],
    ['2021-10-31', 5],
    ['2001-10-01', 25],
  ])('ingreso %s -> %i años al 2026-10-31', (ingreso, anios) => {
    expect(aniosAntiguedad(ingreso, '2026-10-31')).toBe(anios);
  });

  it('escala: 2 años = 5 %, 25 años = 50 %', () => {
    const dos = calcularEmpleado(
      empleado({ fechaIngreso: '2024-10-31' }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(fmt(dos.bonoAntiguedad)).toBe('495.00');
    const veinticinco = calcularEmpleado(
      empleado({ fechaIngreso: '2001-10-01' }),
      NOVEDAD_VACIA,
      0n,
      periodo,
      parametros,
    );
    expect(fmt(veinticinco.bonoAntiguedad)).toBe('4950.00');
  });

  it('días por ingreso: 30, prorrata, día 31 y posterior al periodo', () => {
    expect(diasTrabajadosPorIngreso('2026-01-01', periodo)).toBe(30);
    expect(diasTrabajadosPorIngreso('2026-10-01', periodo)).toBe(30);
    expect(diasTrabajadosPorIngreso('2026-10-31', periodo)).toBe(1);
    expect(diasTrabajadosPorIngreso('2026-11-01', periodo)).toBe(0);
  });

  it('periodo inválido', () => {
    expect(() => parsePeriodo('2026-13')).toThrow(PeriodoInvalidoError);
    expect(() => parsePeriodo('26-01')).toThrow(PeriodoInvalidoError);
  });
});

describe('parámetros persistidos', () => {
  it('falla si falta una clave vigente', () => {
    expect(() =>
      construirParametros(
        '2026-10-31',
        filas.filter((f) => f.clave !== 'SMN'),
        escala,
      ),
    ).toThrow(ParametrosIncompletosError);
  });

  it('falla si la escala tiene huecos', () => {
    expect(() =>
      construirParametros(
        '2026-10-31',
        filas,
        escala.filter((t) => t.aniosDesde !== 5),
      ),
    ).toThrow(ParametrosInvalidosError);
  });

  it('usa el valor persistido: otro SMN cambia el bono', () => {
    const otro = construirParametros(
      '2026-10-31',
      filas.map((f) => (f.clave === 'SMN' ? { ...f, valor: '3500.000000' } : f)),
      escala,
    );
    const r = calcularEmpleado(empleado(), NOVEDAD_VACIA, 0n, periodo, otro);
    expect(fmt(r.bonoAntiguedad)).toBe('1155.00');
  });
});

describe('planilla completa', () => {
  function plantilla(n: number): EmpleadoNomina[] {
    return Array.from({ length: n }, (_, i) =>
      empleado({
        empleadoId: `00000000-0000-4000-8000-${(i + 1).toString().padStart(12, '0')}`,
        nombreCompleto: `Funcionario ${i.toString().padStart(3, '0')}`,
        fechaIngreso: `${2000 + (i % 26)}-0${(i % 9) + 1}-15`,
        haberBasico: toCents(`${3300 + i * 137}.${(i % 100).toString().padStart(2, '0')}`),
      }),
    );
  }

  it('totales cuadran con la suma de los detalles', () => {
    const r = calcularPlanilla({
      periodo,
      parametros,
      empleados: plantilla(50),
      novedades: new Map(),
      saldosRcIva: new Map(),
    });
    expect(r.totales.totalEmpleados).toBe(50);
    expect(r.totales.totalLiquido).toBe(
      r.totales.totalGanado -
        r.totales.totalAportesLaborales -
        r.totales.totalAns -
        r.totales.totalRcIva -
        r.totales.totalOtrosDescuentos,
    );
  });

  it('excluye ingresos posteriores y reporta novedades huérfanas', () => {
    const r = calcularPlanilla({
      periodo,
      parametros,
      empleados: [
        empleado(),
        empleado({
          empleadoId: '00000000-0000-4000-8000-0000000000ff',
          fechaIngreso: '2026-11-02',
        }),
      ],
      novedades: new Map([['00000000-0000-4000-8000-0000000000ee', NOVEDAD_VACIA]]),
      saldosRcIva: new Map(),
    });
    expect(r.detalles).toHaveLength(1);
    expect(r.observaciones).toHaveLength(2);
  });

  it('200 funcionarios se calculan muy por debajo de 30 s', () => {
    const inicio = process.hrtime.bigint();
    const r = calcularPlanilla({
      periodo,
      parametros,
      empleados: plantilla(200),
      novedades: new Map(),
      saldosRcIva: new Map(),
    });
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    expect(r.detalles).toHaveLength(200);
    expect(ms).toBeLessThan(1000);
  });
});
