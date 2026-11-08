import { formatCents, formatPorcentaje, toCents, toPorcentaje } from '../common/money';

export const CLAVES_PARAMETRO = {
  SMN: 'SMN',
  APORTE_LABORAL_PCT: 'APORTE_LABORAL_PCT',
  APORTE_PATRONAL_PCT: 'APORTE_PATRONAL_PCT',
  RC_IVA_PCT: 'RC_IVA_PCT',
  RC_IVA_MINIMO_NO_IMPONIBLE_SMN: 'RC_IVA_MINIMO_NO_IMPONIBLE_SMN',
  BONO_ANTIGUEDAD_BASE_SMN: 'BONO_ANTIGUEDAD_BASE_SMN',
  ANS_TRAMO_1_LIMITE: 'ANS_TRAMO_1_LIMITE',
  ANS_TRAMO_1_PCT: 'ANS_TRAMO_1_PCT',
  ANS_TRAMO_2_LIMITE: 'ANS_TRAMO_2_LIMITE',
  ANS_TRAMO_2_PCT: 'ANS_TRAMO_2_PCT',
  ANS_TRAMO_3_LIMITE: 'ANS_TRAMO_3_LIMITE',
  ANS_TRAMO_3_PCT: 'ANS_TRAMO_3_PCT',
} as const;

export type ClaveParametro = (typeof CLAVES_PARAMETRO)[keyof typeof CLAVES_PARAMETRO];
export const CLAVES_REQUERIDAS: readonly ClaveParametro[] = Object.values(CLAVES_PARAMETRO);

export class ParametrosIncompletosError extends Error {
  constructor(
    readonly faltantes: string[],
    readonly fechaCorte: string,
  ) {
    super(`No hay parámetros legales vigentes al ${fechaCorte} para: ${faltantes.join(', ')}.`);
    this.name = 'ParametrosIncompletosError';
  }
}

export class ParametrosInvalidosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParametrosInvalidosError';
  }
}

export interface ParametroVigenteRaw {
  clave: string;
  valor: string;
  vigenteDesde: string;
}

export interface TramoEscalaRaw {
  aniosDesde: number;
  aniosHasta: number | null;
  porcentaje: string;
  vigenteDesde: string;
}

export interface TramoAns {
  limite: bigint;
  porcentaje: bigint;
}

export interface TramoAntiguedad {
  aniosDesde: number;
  aniosHasta: number | null;
  porcentaje: bigint;
}

export interface ParametrosNomina {
  fechaCorte: string;
  smn: bigint;
  aporteLaboralPct: bigint;
  aportePatronalPct: bigint;
  rcIvaPct: bigint;
  rcIvaMinimoNoImponibleSmn: number;
  bonoAntiguedadBaseSmn: number;
  tramosAns: TramoAns[];
  escalaAntiguedad: TramoAntiguedad[];
  vigencias: Record<string, string>;
}

function enteroPositivo(valor: string, clave: string): number {
  const cents = toCents(valor, clave);
  if (cents % 100n !== 0n || cents <= 0n || cents > 100n * 100n) {
    throw new ParametrosInvalidosError(`${clave} debe ser un entero entre 1 y 100.`);
  }
  return Number(cents / 100n);
}

export function construirParametros(
  fechaCorte: string,
  filas: readonly ParametroVigenteRaw[],
  escala: readonly TramoEscalaRaw[],
): ParametrosNomina {
  const porClave = new Map(filas.map((fila) => [fila.clave, fila]));
  const faltantes: string[] = CLAVES_REQUERIDAS.filter((clave) => !porClave.has(clave));
  if (escala.length === 0) faltantes.push('ESCALA_ANTIGUEDAD');
  if (faltantes.length > 0) throw new ParametrosIncompletosError(faltantes, fechaCorte);

  const valor = (clave: ClaveParametro): string => {
    const fila = porClave.get(clave);
    if (!fila) throw new ParametrosIncompletosError([clave], fechaCorte);
    return fila.valor;
  };

  const smn = toCents(valor('SMN'), 'SMN');
  if (smn <= 0n) throw new ParametrosInvalidosError('SMN debe ser mayor a cero.');

  const tramosAns: TramoAns[] = [1, 2, 3].map((n) => ({
    limite: toCents(valor(`ANS_TRAMO_${n}_LIMITE` as ClaveParametro), `ANS_TRAMO_${n}_LIMITE`),
    porcentaje: toPorcentaje(valor(`ANS_TRAMO_${n}_PCT` as ClaveParametro), `ANS_TRAMO_${n}_PCT`),
  }));
  for (let i = 1; i < tramosAns.length; i += 1) {
    if (tramosAns[i].limite <= tramosAns[i - 1].limite) {
      throw new ParametrosInvalidosError('Los límites de los tramos ANS deben ser crecientes.');
    }
  }

  const escalaOrdenada: TramoAntiguedad[] = [...escala]
    .sort((a, b) => a.aniosDesde - b.aniosDesde)
    .map((tramo) => ({
      aniosDesde: tramo.aniosDesde,
      aniosHasta: tramo.aniosHasta,
      porcentaje: toPorcentaje(tramo.porcentaje, 'ESCALA_ANTIGUEDAD'),
    }));
  if (escalaOrdenada[0].aniosDesde !== 0) {
    throw new ParametrosInvalidosError('La escala de antigüedad debe iniciar en 0 años.');
  }
  for (let i = 0; i < escalaOrdenada.length; i += 1) {
    const actual = escalaOrdenada[i];
    const siguiente = escalaOrdenada[i + 1];
    if (!siguiente) {
      if (actual.aniosHasta !== null) {
        throw new ParametrosInvalidosError('El último tramo de antigüedad debe ser abierto.');
      }
    } else if (actual.aniosHasta === null || actual.aniosHasta + 1 !== siguiente.aniosDesde) {
      throw new ParametrosInvalidosError('La escala de antigüedad tiene huecos o solapamientos.');
    }
  }

  return {
    fechaCorte,
    smn,
    aporteLaboralPct: toPorcentaje(valor('APORTE_LABORAL_PCT'), 'APORTE_LABORAL_PCT'),
    aportePatronalPct: toPorcentaje(valor('APORTE_PATRONAL_PCT'), 'APORTE_PATRONAL_PCT'),
    rcIvaPct: toPorcentaje(valor('RC_IVA_PCT'), 'RC_IVA_PCT'),
    rcIvaMinimoNoImponibleSmn: enteroPositivo(
      valor('RC_IVA_MINIMO_NO_IMPONIBLE_SMN'),
      'RC_IVA_MINIMO_NO_IMPONIBLE_SMN',
    ),
    bonoAntiguedadBaseSmn: enteroPositivo(
      valor('BONO_ANTIGUEDAD_BASE_SMN'),
      'BONO_ANTIGUEDAD_BASE_SMN',
    ),
    tramosAns,
    escalaAntiguedad: escalaOrdenada,
    vigencias: Object.fromEntries([
      ...filas.map((fila) => [fila.clave, fila.vigenteDesde.slice(0, 10)] as const),
      ['ESCALA_ANTIGUEDAD', escala[0].vigenteDesde.slice(0, 10)] as const,
    ]),
  };
}

export function porcentajeAntiguedad(parametros: ParametrosNomina, anios: number): bigint {
  const tramo = parametros.escalaAntiguedad.find(
    (item) => anios >= item.aniosDesde && (item.aniosHasta === null || anios <= item.aniosHasta),
  );
  return tramo?.porcentaje ?? 0n;
}

export function serializarParametros(parametros: ParametrosNomina) {
  return {
    fechaCorte: parametros.fechaCorte,
    smn: formatCents(parametros.smn),
    aporteLaboralPct: formatPorcentaje(parametros.aporteLaboralPct),
    aportePatronalPct: formatPorcentaje(parametros.aportePatronalPct),
    rcIvaPct: formatPorcentaje(parametros.rcIvaPct),
    rcIvaMinimoNoImponibleSmn: parametros.rcIvaMinimoNoImponibleSmn,
    bonoAntiguedadBaseSmn: parametros.bonoAntiguedadBaseSmn,
    tramosAns: parametros.tramosAns.map((tramo) => ({
      limite: formatCents(tramo.limite),
      porcentaje: formatPorcentaje(tramo.porcentaje),
    })),
    escalaAntiguedad: parametros.escalaAntiguedad.map((tramo) => ({
      aniosDesde: tramo.aniosDesde,
      aniosHasta: tramo.aniosHasta,
      porcentaje: formatPorcentaje(tramo.porcentaje),
    })),
    vigencias: parametros.vigencias,
  };
}

export type ParametrosSerializados = ReturnType<typeof serializarParametros>;
