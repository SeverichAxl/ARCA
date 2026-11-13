/**
 * Periodo mensual de planilla (YYYY-MM) y reglas de calendario de nómina.
 * Se trabaja con fechas "solo día" en formato ISO para no depender de la zona
 * horaria del servidor.
 */
export class PeriodoInvalidoError extends Error {
  constructor(readonly valor: string) {
    super(`Periodo inválido: ${valor}. Se esperaba YYYY-MM.`);
    this.name = 'PeriodoInvalidoError';
  }
}

export class FechaInvalidaError extends Error {
  constructor(readonly valor: string) {
    super(`Fecha inválida: ${valor}. Se esperaba YYYY-MM-DD.`);
    this.name = 'FechaInvalidaError';
  }
}

export const DIAS_MES_COMERCIAL = 30;

export interface Periodo {
  readonly codigo: string;
  readonly anio: number;
  readonly mes: number;
  readonly fechaInicio: string;
  readonly fechaFin: string;
}

const PERIODO_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const FECHA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function parsePeriodo(codigo: string): Periodo {
  const match = PERIODO_PATTERN.exec(codigo);
  if (!match) throw new PeriodoInvalidoError(codigo);
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  if (anio < 2000 || anio > 2100) throw new PeriodoInvalidoError(codigo);
  return {
    codigo,
    anio,
    mes,
    fechaInicio: `${anio}-${pad(mes)}-01`,
    fechaFin: `${anio}-${pad(mes)}-${pad(ultimoDiaDelMes(anio, mes))}`,
  };
}

export function periodoAnterior(periodo: Periodo): string {
  return periodo.mes === 1 ? `${periodo.anio - 1}-12` : `${periodo.anio}-${pad(periodo.mes - 1)}`;
}

export interface FechaPartes {
  anio: number;
  mes: number;
  dia: number;
}

/** Acepta YYYY-MM-DD o un ISO completo (toma la parte de fecha). */
export function parseFecha(valor: string): FechaPartes {
  const soloFecha = valor.slice(0, 10);
  const match = FECHA_PATTERN.exec(soloFecha);
  if (!match) throw new FechaInvalidaError(valor);
  const partes = { anio: Number(match[1]), mes: Number(match[2]), dia: Number(match[3]) };
  if (
    partes.mes < 1 ||
    partes.mes > 12 ||
    partes.dia < 1 ||
    partes.dia > ultimoDiaDelMes(partes.anio, partes.mes)
  ) {
    throw new FechaInvalidaError(valor);
  }
  return partes;
}

export function compararFechas(a: string, b: string): number {
  return a.slice(0, 10).localeCompare(b.slice(0, 10));
}

/** Mes comercial de 30 días; el ingreso dentro del mes cuenta el día inicial. */
export function diasTrabajadosPorIngreso(fechaIngreso: string, periodo: Periodo): number {
  if (compararFechas(fechaIngreso, periodo.fechaFin) > 0) return 0;
  if (compararFechas(fechaIngreso, periodo.fechaInicio) < 0) return DIAS_MES_COMERCIAL;
  const { dia } = parseFecha(fechaIngreso);
  return DIAS_MES_COMERCIAL - Math.min(dia, DIAS_MES_COMERCIAL) + 1;
}

/** Años completos de servicio cumplidos al cierre del periodo. */
export function aniosAntiguedad(fechaIngreso: string, fechaCorte: string): number {
  const ingreso = parseFecha(fechaIngreso);
  const corte = parseFecha(fechaCorte);
  let anios = corte.anio - ingreso.anio;
  if (corte.mes < ingreso.mes || (corte.mes === ingreso.mes && corte.dia < ingreso.dia)) {
    anios -= 1;
  }
  return Math.max(0, anios);
}

/** Suma años a una fecha ISO (29-feb pasa a 28-feb en años no bisiestos). */
export function sumarAnios(fecha: string, anios: number): string {
  const { anio, mes, dia } = parseFecha(fecha);
  const destino = anio + anios;
  const diaAjustado = Math.min(dia, ultimoDiaDelMes(destino, mes));
  return `${destino}-${pad(mes)}-${pad(diaAjustado)}`;
}
