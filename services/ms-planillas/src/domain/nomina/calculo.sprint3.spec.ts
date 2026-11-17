import { formatCents, toCents } from '../common/money';
import {
  calcularEmpleado,
  type EmpleadoNomina,
  NOVEDAD_VACIA,
  type NovedadNomina,
} from './calculo';
import { construirParametros } from './parametros';
import { filasIniciales } from './parametros-iniciales';
import { parsePeriodo } from './periodo';

/**
 * ARCA-121 / TSK-BACK-324
 *
 * Los valores esperados de esta suite fueron calculados manualmente y están
 * escritos como literales. Nunca se obtienen de otra ejecución del motor.
 * Las reglas usadas son los parámetros del Product Backlog cargados por seed;
 * no constituyen una certificación normativa externa.
 */
describe('ARCA-121 — validación independiente del motor de planillas', () => {
  const periodo = parsePeriodo('2026-10');
  const { filas, escala } = filasIniciales();
  const parametros = construirParametros(periodo.fechaFin, filas, escala);

  const empleado = (overrides: Partial<EmpleadoNomina> = {}): EmpleadoNomina => ({
    empleadoId: '00000000-0000-4000-8000-000000000121',
    nombreCompleto: 'Caso manual Sprint 3',
    ciEnmascarado: '***0121',
    areaId: '00000000-0000-4000-8000-000000000001',
    cargoId: '00000000-0000-4000-8000-000000000002',
    fechaIngreso: '2020-01-01',
    haberBasico: toCents('5000.00'),
    ...overrides,
  });

  const novedad = (overrides: Partial<NovedadNomina> = {}): NovedadNomina => ({
    ...NOVEDAD_VACIA,
    ...overrides,
  });

  const dinero = (valor: bigint) => formatCents(valor);

  it.each([
    {
      caso: 'salario completo, seis años de antigüedad y sin RC-IVA',
      empleado: empleado(),
      novedad: NOVEDAD_VACIA,
      saldo: '0.00',
      esperado: {
        haberGanado: '5000.00',
        bonoAntiguedad: '1089.00',
        totalGanado: '6089.00',
        aporteLaboral: '773.91',
        ans: '0.00',
        rcIva: '0.00',
        otrosDescuentos: '0.00',
        totalDescuentos: '773.91',
        liquidoPagable: '5315.09',
        aportePatronal: '1017.47',
      },
    },
    {
      caso: 'salario alto sin antigüedad, con ANS y RC-IVA',
      empleado: empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('20000.00') }),
      novedad: NOVEDAD_VACIA,
      saldo: '0.00',
      esperado: {
        haberGanado: '20000.00',
        bonoAntiguedad: '0.00',
        totalGanado: '20000.00',
        aporteLaboral: '2542.00',
        ans: '70.00',
        rcIva: '544.44',
        otrosDescuentos: '0.00',
        totalDescuentos: '3156.44',
        liquidoPagable: '16843.56',
        aportePatronal: '3342.00',
      },
    },
    {
      caso: 'tres tramos ANS, facturas y otros descuentos',
      empleado: empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('40000.00') }),
      novedad: novedad({
        rcIvaComputable: toCents('10000.00'),
        otrosDescuentos: toCents('250.00'),
      }),
      saldo: '0.00',
      esperado: {
        haberGanado: '40000.00',
        bonoAntiguedad: '0.00',
        totalGanado: '40000.00',
        aporteLaboral: '5084.00',
        ans: '1520.00',
        rcIva: '1325.48',
        otrosDescuentos: '250.00',
        totalDescuentos: '8179.48',
        liquidoPagable: '31820.52',
        aportePatronal: '6684.00',
      },
    },
    {
      caso: 'prorrateo y redondeo half-up al centavo',
      empleado: empleado({ fechaIngreso: '2025-03-01', haberBasico: toCents('3333.33') }),
      novedad: novedad({ diasTrabajados: 17 }),
      saldo: '0.00',
      esperado: {
        haberGanado: '1888.89',
        bonoAntiguedad: '0.00',
        totalGanado: '1888.89',
        aporteLaboral: '240.08',
        ans: '0.00',
        rcIva: '0.00',
        otrosDescuentos: '0.00',
        totalDescuentos: '240.08',
        liquidoPagable: '1648.81',
        aportePatronal: '315.63',
      },
    },
  ])('$caso', ({ empleado: entradaEmpleado, novedad: entradaNovedad, saldo, esperado }) => {
    const resultado = calcularEmpleado(
      entradaEmpleado,
      entradaNovedad,
      toCents(saldo),
      periodo,
      parametros,
    );

    expect({
      haberGanado: dinero(resultado.haberGanado),
      bonoAntiguedad: dinero(resultado.bonoAntiguedad),
      totalGanado: dinero(resultado.totalGanado),
      aporteLaboral: dinero(resultado.aporteLaboral),
      ans: dinero(resultado.ans),
      rcIva: dinero(resultado.rcIva),
      otrosDescuentos: dinero(resultado.otrosDescuentos),
      totalDescuentos: dinero(resultado.totalDescuentos),
      liquidoPagable: dinero(resultado.liquidoPagable),
      aportePatronal: dinero(resultado.aportePatronal),
    }).toEqual(esperado);
  });

  it('respeta exactamente los límites de la escala de antigüedad', () => {
    const casos = [
      ['2024-10-31', '495.00'], // 2 años: 5 % de 3 SMN
      ['2021-10-31', '1089.00'], // 5 años: 11 % de 3 SMN
      ['2001-10-31', '4950.00'], // 25 años: 50 % de 3 SMN
    ] as const;

    for (const [fechaIngreso, bonoEsperado] of casos) {
      const resultado = calcularEmpleado(
        empleado({ fechaIngreso }),
        NOVEDAD_VACIA,
        0n,
        periodo,
        parametros,
      );
      expect(dinero(resultado.bonoAntiguedad)).toBe(bonoEsperado);
    }
  });
});
