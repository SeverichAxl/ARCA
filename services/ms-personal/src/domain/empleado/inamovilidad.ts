export interface InamovilidadEvaluable {
  estadoActivo: boolean;
  fechaInicio: Date;
  fechaFin: Date | null;
}

/** Una inamovilidad protege al funcionario si está activa y la fecha cae en su vigencia. */
export function inamovilidadVigente(i: InamovilidadEvaluable, enFecha: Date): boolean {
  return i.estadoActivo && i.fechaInicio <= enFecha && (i.fechaFin === null || i.fechaFin >= enFecha);
}
