import {
  addDays,
  calendarDifference,
  compareDateOnly,
  daysBetweenInclusive,
  firstDayOfYear,
  maxDateOnly,
} from '../common/date-only';
import { formatCents, divideHalfUp, normalizeMoney, parseMoneyToCents } from '../common/money';

export interface FiniquitoInput {
  /** Remuneración vigente (SPI). Se recibe como decimal con 2 decimales. */
  spi: string;
  fechaIngreso: string;
  fechaBaja: string;
  aplicaDesahucio: boolean;
  diasVacacionesPendientes?: number;
  /** Días de prueba configurados al alta; por defecto 90. */
  diasPrueba?: number;
}

export interface PeriodoFiniquito {
  years: number;
  months: number;
  days: number;
  texto: string;
}

export interface FiniquitoConcepto {
  codigo: 'INDEMNIZACION' | 'DESAHUCIO' | 'AGUINALDO' | 'VACACIONES';
  descripcion: string;
  importe: string;
}

export interface FiniquitoResultado {
  moneda: 'BOB';
  spi: string;
  spiOrigen: 'HABER_BASICO';
  periodo: PeriodoFiniquito;
  antiguedadDias: number;
  indemnizacion: string;
  desahucio: string;
  aguinaldo: string;
  vacaciones: string;
  total: string;
  conceptos: FiniquitoConcepto[];
  supuestos: string[];
  advertencias: string[];
}

export const DIAS_PRUEBA_FINIQUITO = 90;

const SUPUESTOS = [
  'SPI = remuneración vigente (haber básico); aún no se dispone de boletas de pago.',
  'La fecha de baja se cuenta como día trabajado (periodo inclusivo).',
  'Años y meses se calculan por calendario; si el día no existe en el mes destino se usa el último día.',
  'Cada concepto se redondea una sola vez, half-up, a 2 decimales; el total suma conceptos ya redondeados.',
  'Moneda: bolivianos (BOB).',
  'No incluye doble aguinaldo ni quinquenio.',
];

/**
 * Cálculo puro del finiquito. Toda la aritmética se hace con centavos enteros
 * (BigInt) y una sola división racional por concepto; nunca con float.
 */
export function calcularFiniquito(input: FiniquitoInput): FiniquitoResultado {
  const spiCents = parseMoneyToCents(input.spi);
  const spi = normalizeMoney(input.spi);
  const diasPrueba = input.diasPrueba ?? DIAS_PRUEBA_FINIQUITO;
  const diasVacaciones = input.diasVacacionesPendientes ?? 0;

  if (!Number.isInteger(diasVacaciones) || diasVacaciones < 0) {
    throw new Error('Los días de vacaciones pendientes deben ser un entero mayor o igual a 0.');
  }
  if (!Number.isInteger(diasPrueba) || diasPrueba < 0) {
    throw new Error('Los días de prueba deben ser un entero mayor o igual a 0.');
  }

  // fechaBaja + 1 día convierte la fecha de baja (inclusive) en fin exclusivo.
  const finExclusivo = addDays(input.fechaBaja, 1);
  const periodo = calendarDifference(input.fechaIngreso, finExclusivo);
  const antiguedadDias = daysBetweenInclusive(input.fechaIngreso, input.fechaBaja);
  const advertencias: string[] = [];

  const cumplePeriodoPrueba = antiguedadDias >= diasPrueba;
  if (!cumplePeriodoPrueba) {
    advertencias.push(
      `Antigüedad de ${antiguedadDias} días, inferior al periodo de prueba de ${diasPrueba} días: ` +
        'no corresponde indemnización ni desahucio (Art. 13 LGT).',
    );
  }

  // Indemnización = años x SPI + SPI/12 x meses + SPI/360 x días.
  const indemnizacionCents = cumplePeriodoPrueba
    ? divideHalfUp(
        spiCents *
          BigInt(periodo.years * 360 + periodo.months * 30 + periodo.days),
        360n,
      )
    : 0n;

  // Desahucio = 3 x SPI solo si aplica y se superó el periodo de prueba.
  const desahucioCents =
    input.aplicaDesahucio && cumplePeriodoPrueba ? spiCents * 3n : 0n;
  if (input.aplicaDesahucio && !cumplePeriodoPrueba) {
    advertencias.push('El desahucio solicitado no se paga porque no se superó el periodo de prueba.');
  }

  // Aguinaldo proporcional desde max(ingreso, 1 de enero del año de la baja).
  const inicioAguinaldo = maxDateOnly(input.fechaIngreso, firstDayOfYear(input.fechaBaja));
  const periodoAguinaldo = calendarDifference(inicioAguinaldo, finExclusivo);
  const mesesAguinaldo = periodoAguinaldo.years * 12 + periodoAguinaldo.months;
  const aguinaldoCents = divideHalfUp(
    spiCents * BigInt(mesesAguinaldo * 30 + periodoAguinaldo.days),
    360n,
  );

  // Vacaciones pendientes = días x SPI/30.
  const vacacionesCents = divideHalfUp(spiCents * BigInt(diasVacaciones), 30n);

  const totalCents =
    indemnizacionCents + desahucioCents + aguinaldoCents + vacacionesCents;

  const periodoTexto = [
    `${periodo.years} años`,
    `${periodo.months} meses`,
    `${periodo.days} días`,
  ].join(', ');

  return {
    moneda: 'BOB',
    spi,
    spiOrigen: 'HABER_BASICO',
    periodo: {
      years: periodo.years,
      months: periodo.months,
      days: periodo.days,
      texto: periodoTexto,
    },
    antiguedadDias,
    indemnizacion: formatCents(indemnizacionCents),
    desahucio: formatCents(desahucioCents),
    aguinaldo: formatCents(aguinaldoCents),
    vacaciones: formatCents(vacacionesCents),
    total: formatCents(totalCents),
    conceptos: [
      {
        codigo: 'INDEMNIZACION',
        descripcion: `${periodo.years} años, ${periodo.months} meses y ${periodo.days} días de servicio`,
        importe: formatCents(indemnizacionCents),
      },
      {
        codigo: 'DESAHUCIO',
        descripcion: 'Tres sueldos, si corresponde',
        importe: formatCents(desahucioCents),
      },
      {
        codigo: 'AGUINALDO',
        descripcion: `Proporcional a ${mesesAguinaldo} meses y ${periodoAguinaldo.days} días`,
        importe: formatCents(aguinaldoCents),
      },
      {
        codigo: 'VACACIONES',
        descripcion: `${diasVacaciones} días pendientes`,
        importe: formatCents(vacacionesCents),
      },
    ],
    supuestos: SUPUESTOS,
    advertencias,
  };
}

/** Comprueba que la fecha de baja no sea anterior al ingreso. */
export function validarFechasFiniquito(fechaIngreso: string, fechaBaja: string): void {
  if (compareDateOnly(fechaBaja, fechaIngreso) < 0) {
    throw new Error('La fecha de baja no puede ser anterior al ingreso.');
  }
}
