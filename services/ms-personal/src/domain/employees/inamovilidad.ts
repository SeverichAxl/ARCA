import { compareDateOnly } from '../common/date-only';

export type TipoInamovilidad =
  | 'GESTACION'
  | 'PROGENITOR'
  | 'DISCAPACIDAD'
  | 'TUTOR_DISCAPACIDAD';

export interface InamovilidadFuero {
  estadoActivo: boolean;
  fechaInicio: string;
  fechaFin: string | null;
}

/**
 * Una inamovilidad está activa en una fecha si está habilitada y esa fecha
 * está dentro de su intervalo inclusivo.
 */
export function estaInamovilidadActiva(
  fuero: InamovilidadFuero,
  fechaReferencia: string,
): boolean {
  if (!fuero.estadoActivo) return false;
  if (compareDateOnly(fuero.fechaInicio, fechaReferencia) > 0) return false;
  return fuero.fechaFin === null || compareDateOnly(fuero.fechaFin, fechaReferencia) >= 0;
}

export function algunaInamovilidadActiva(
  fueros: InamovilidadFuero[],
  fechaReferencia: string,
): boolean {
  return fueros.some((fuero) => estaInamovilidadActiva(fuero, fechaReferencia));
}
