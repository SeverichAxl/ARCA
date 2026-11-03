import { desglosarDias, diasComerciales } from './fechas';

/**
 * Cálculo de finiquito (HU-07). Base comercial de 360 días.
 * - SPI: promedio de los últimos 3 sueldos (mientras no existan boletas, el haber básico).
 * - Indemnización (solo con 90 días o más de servicio): 1 SPI por año + duodécimas por mes + días.
 * - Desahucio: 3 × SPI solo si aplicaDesahucio.
 * - Aguinaldo proporcional de la gestión (mínimo 90 días trabajados en el año).
 * - Vacaciones pendientes: SPI / 30 por día pendiente.
 */
export interface DatosFiniquito {
  fechaIngreso: Date;
  fechaBaja: Date;
  sueldos: number[];
  aplicaDesahucio: boolean;
  diasVacacionPendientes: number;
}

export interface DetalleFiniquito {
  tiempoServicio: { anios: number; meses: number; dias: number; totalDias: number };
  sueldoPromedioIndemnizable: number;
  indemnizacion: {
    aplica: boolean;
    porAnios: number;
    porDuodecimas: number;
    porDias: number;
    monto: number;
  };
  desahucio: { aplica: boolean; monto: number };
  aguinaldo: { diasComputables: number; monto: number };
  vacaciones: { dias: number; monto: number };
  total: number;
}

export const DIAS_MINIMOS_INDEMNIZACION = 90;
export const DIAS_MINIMOS_AGUINALDO = 90;

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularFiniquito(datos: DatosFiniquito): DetalleFiniquito {
  if (datos.sueldos.length === 0 || datos.sueldos.some((s) => !(s >= 0))) {
    throw new Error('Se requiere al menos un sueldo válido para calcular el SPI.');
  }
  if (datos.fechaBaja < datos.fechaIngreso) {
    throw new Error('La fecha de baja no puede ser anterior a la fecha de ingreso.');
  }

  const ultimos = datos.sueldos.slice(-3);
  const spi = redondear2(ultimos.reduce((a, b) => a + b, 0) / ultimos.length);

  const totalDias = diasComerciales(datos.fechaIngreso, datos.fechaBaja);
  const { anios, meses, dias } = desglosarDias(totalDias);

  const aplicaIndemnizacion = totalDias >= DIAS_MINIMOS_INDEMNIZACION;
  const porAnios = aplicaIndemnizacion ? redondear2(anios * spi) : 0;
  const porDuodecimas = aplicaIndemnizacion ? redondear2((meses * spi) / 12) : 0;
  const porDias = aplicaIndemnizacion ? redondear2((dias * spi) / 360) : 0;
  const indemnizacion = redondear2(porAnios + porDuodecimas + porDias);

  const desahucio = datos.aplicaDesahucio ? redondear2(3 * spi) : 0;

  const inicioGestion = new Date(Date.UTC(datos.fechaBaja.getUTCFullYear(), 0, 1));
  const desdeAguinaldo = datos.fechaIngreso > inicioGestion ? datos.fechaIngreso : inicioGestion;
  const diasAguinaldo = diasComerciales(desdeAguinaldo, datos.fechaBaja);
  const aguinaldo = diasAguinaldo >= DIAS_MINIMOS_AGUINALDO ? redondear2((spi * diasAguinaldo) / 360) : 0;

  const vacaciones = redondear2((spi / 30) * datos.diasVacacionPendientes);

  return {
    tiempoServicio: { anios, meses, dias, totalDias },
    sueldoPromedioIndemnizable: spi,
    indemnizacion: { aplica: aplicaIndemnizacion, porAnios, porDuodecimas, porDias, monto: indemnizacion },
    desahucio: { aplica: datos.aplicaDesahucio, monto: desahucio },
    aguinaldo: { diasComputables: diasAguinaldo, monto: aguinaldo },
    vacaciones: { dias: datos.diasVacacionPendientes, monto: vacaciones },
    total: redondear2(indemnizacion + desahucio + aguinaldo + vacaciones),
  };
}
