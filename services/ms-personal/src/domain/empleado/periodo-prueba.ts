import { formatFecha, sumarDias } from './fechas';

export type ResultadoRatificacion =
  | { ok: true }
  | { ok: false; motivo: 'FECHA_FUTURA' | 'ANTICIPADA'; ratificableDesde: string };

/** Primer día en que el funcionario puede ser ratificado (cumplidos los días de prueba). */
export function ratificableDesde(fechaIngreso: Date, diasPrueba: number): Date {
  return sumarDias(fechaIngreso, diasPrueba);
}

/**
 * La fecha de ratificación no puede ser futura (evita "adelantar" la ratificación con
 * una fecha posterior) ni anterior al fin del periodo de prueba.
 */
export function evaluarRatificacion(params: {
  fechaIngreso: Date;
  diasPrueba: number;
  fechaRatificacion: Date;
  hoy: Date;
}): ResultadoRatificacion {
  const desde = ratificableDesde(params.fechaIngreso, params.diasPrueba);
  if (params.fechaRatificacion > params.hoy) {
    return { ok: false, motivo: 'FECHA_FUTURA', ratificableDesde: formatFecha(desde) };
  }
  if (params.fechaRatificacion < desde) {
    return { ok: false, motivo: 'ANTICIPADA', ratificableDesde: formatFecha(desde) };
  }
  return { ok: true };
}
