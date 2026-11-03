/** Puerto de reloj: el dominio no lee la hora del sistema directamente. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  /** Fecha actual como YYYY-MM-DD en la zona de negocio (America/La_Paz). */
  today(): string;
}
