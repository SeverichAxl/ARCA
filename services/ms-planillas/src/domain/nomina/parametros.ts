import { formatCents, formatPorcentaje, toCents, toPorcentaje } from '../common/money';

/**
 * Parámetros legales que el motor necesita, identificados por (tipo, clave) en
 * `parametro_legal` (modelo de TSK-ARQ-202, mantenido por TSK-SCRUMDEV-201).
 * Aquí solo están las CLAVES; los VALORES siempre vienen de la base de datos.
 * Si falta un parámetro activo y vigente, el cálculo se rechaza.
 */
export const PARAMETROS_REQUERIDOS = {
  SMN: { tipo: 'SMN', clave: 'SMN_NACIONAL' },
  APORTE_LABORAL: { tipo: 'APORTE_LABORAL', clave: 'AFP_LABORAL' },
  APORTE_PATRONAL: { tipo: 'APORTE_PATRONAL', clave: 'AFP_PATRONAL' },
  RC_IVA_ALICUOTA: { tipo: 'RC_IVA', clave: 'RC_IVA_ALICUOTA' },
  RC_IVA_MINIMO: { tipo: 'RC_IVA', clave: 'RC_IVA_MINIMO_NO_IMPONIBLE' },
  BONO_ANTIGUEDAD: { tipo: 'BONO_ANTIGUEDAD', clave: 'ESCALA_LGT_REFERENCIAL' },
  ANS: { tipo: 'OTRO', clave: 'ANS_APORTE_SOLIDARIO' },
} as const;

export type NombreParametro = keyof typeof PARAMETROS_REQUERIDOS;

export const idParametro = (tipo: string, clave: string): string => `${tipo}:${clave}`;

export class ParametrosIncompletosError extends Error {
  constructor(
    readonly faltantes: string[],
    readonly fechaCorte: string,
  ) {
    super(
      `No hay parámetros legales activos y vigentes al ${fechaCorte} para: ${faltantes.join(', ')}.`,
    );
    this.name = 'ParametrosIncompletosError';
  }
}

export class ParametrosInvalidosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParametrosInvalidosError';
  }
}

/** Fila activa y vigente leída del repositorio (valor como string decimal). */
export interface ParametroLegalRaw {
  tipo: string;
  clave: string;
  valor: string;
  metadata: unknown;
  vigenteDesde: string;
}

export interface TramoAns {
  limite: bigint; // centavos
  porcentaje: bigint; // escalado 10^4
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

function enteroPositivo(valor: string, nombre: string): number {
  const cents = toCents(valor, nombre);
  if (cents % 100n !== 0n || cents <= 0n || cents > 100n * 100n) {
    throw new ParametrosInvalidosError(`${nombre} debe ser un entero entre 1 y 100.`);
  }
  return Number(cents / 100n);
}

function tramosDe(metadata: unknown, nombre: string): Record<string, unknown>[] {
  const tramos =
    typeof metadata === 'object' && metadata !== null
      ? (metadata as { tramos?: unknown }).tramos
      : undefined;
  if (!Array.isArray(tramos) || tramos.length === 0) {
    throw new ParametrosInvalidosError(`${nombre} requiere metadata.tramos con al menos un tramo.`);
  }
  return tramos.map((tramo) => {
    if (typeof tramo !== 'object' || tramo === null) {
      throw new ParametrosInvalidosError(`${nombre}: cada tramo debe ser un objeto.`);
    }
    return tramo as Record<string, unknown>;
  });
}

function enteroNoNegativo(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    throw new ParametrosInvalidosError(`${campo} debe ser un entero no negativo.`);
  }
  return valor;
}

function decimalTexto(valor: unknown, campo: string): string {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor.toString();
  if (typeof valor === 'string') return valor;
  throw new ParametrosInvalidosError(`${campo} debe ser numérico.`);
}

/**
 * Escala de antigüedad: metadata.tramos = [{ desdeAnios, hastaAnios, porcentajeSMN }].
 * Los tramos deben ser contiguos y el último abierto (hastaAnios null). Antes del
 * primer tramo el porcentaje es 0.
 */
function construirEscala(metadata: unknown): TramoAntiguedad[] {
  const nombre = 'BONO_ANTIGUEDAD:ESCALA_LGT_REFERENCIAL';
  const escala = tramosDe(metadata, nombre)
    .map((tramo, i) => ({
      aniosDesde: enteroNoNegativo(tramo.desdeAnios, `${nombre}.tramos[${i}].desdeAnios`),
      aniosHasta:
        tramo.hastaAnios === null || tramo.hastaAnios === undefined
          ? null
          : enteroNoNegativo(tramo.hastaAnios, `${nombre}.tramos[${i}].hastaAnios`),
      porcentaje: toPorcentaje(
        decimalTexto(tramo.porcentajeSMN, `${nombre}.tramos[${i}].porcentajeSMN`),
        nombre,
      ),
    }))
    .sort((a, b) => a.aniosDesde - b.aniosDesde);

  for (let i = 0; i < escala.length; i += 1) {
    const actual = escala[i];
    const siguiente = escala[i + 1];
    if (actual.aniosHasta !== null && actual.aniosHasta < actual.aniosDesde) {
      throw new ParametrosInvalidosError(`${nombre}: un tramo termina antes de empezar.`);
    }
    if (siguiente === undefined) {
      if (actual.aniosHasta !== null) {
        throw new ParametrosInvalidosError(
          `${nombre}: el último tramo debe ser abierto (hastaAnios null).`,
        );
      }
    } else if (actual.aniosHasta === null || actual.aniosHasta + 1 !== siguiente.aniosDesde) {
      throw new ParametrosInvalidosError(`${nombre}: los tramos tienen huecos o solapamientos.`);
    }
  }
  return escala;
}

/** Tramos ANS: metadata.tramos = [{ limite, porcentaje }] con límites crecientes. */
function construirTramosAns(metadata: unknown): TramoAns[] {
  const nombre = 'OTRO:ANS_APORTE_SOLIDARIO';
  const tramos = tramosDe(metadata, nombre).map((tramo, i) => ({
    limite: toCents(decimalTexto(tramo.limite, `${nombre}.tramos[${i}].limite`), nombre),
    porcentaje: toPorcentaje(
      decimalTexto(tramo.porcentaje, `${nombre}.tramos[${i}].porcentaje`),
      nombre,
    ),
  }));
  for (let i = 1; i < tramos.length; i += 1) {
    if (tramos[i].limite <= tramos[i - 1].limite) {
      throw new ParametrosInvalidosError(`${nombre}: los límites deben ser crecientes.`);
    }
  }
  return tramos;
}

/** Construye y valida los parámetros a partir de las filas activas y vigentes. */
export function construirParametros(
  fechaCorte: string,
  registros: readonly ParametroLegalRaw[],
): ParametrosNomina {
  const porId = new Map(registros.map((r) => [idParametro(r.tipo, r.clave), r]));
  const faltantes = Object.values(PARAMETROS_REQUERIDOS)
    .map((p) => idParametro(p.tipo, p.clave))
    .filter((id) => !porId.has(id));
  if (faltantes.length > 0) throw new ParametrosIncompletosError(faltantes, fechaCorte);

  const registro = (nombre: NombreParametro): ParametroLegalRaw => {
    const { tipo, clave } = PARAMETROS_REQUERIDOS[nombre];
    return porId.get(idParametro(tipo, clave)) as ParametroLegalRaw;
  };

  const smn = toCents(registro('SMN').valor, 'SMN');
  if (smn <= 0n) throw new ParametrosInvalidosError('SMN debe ser mayor a cero.');

  const bono = registro('BONO_ANTIGUEDAD');
  const vigencias = Object.fromEntries(
    Object.values(PARAMETROS_REQUERIDOS).map((p) => {
      const r = porId.get(idParametro(p.tipo, p.clave)) as ParametroLegalRaw;
      return [idParametro(p.tipo, p.clave), r.vigenteDesde.slice(0, 10)];
    }),
  );

  return {
    fechaCorte,
    smn,
    aporteLaboralPct: toPorcentaje(registro('APORTE_LABORAL').valor, 'APORTE_LABORAL'),
    aportePatronalPct: toPorcentaje(registro('APORTE_PATRONAL').valor, 'APORTE_PATRONAL'),
    rcIvaPct: toPorcentaje(registro('RC_IVA_ALICUOTA').valor, 'RC_IVA_ALICUOTA'),
    rcIvaMinimoNoImponibleSmn: enteroPositivo(
      registro('RC_IVA_MINIMO').valor,
      'RC_IVA_MINIMO_NO_IMPONIBLE',
    ),
    bonoAntiguedadBaseSmn: enteroPositivo(bono.valor, 'ESCALA_LGT_REFERENCIAL (base en SMN)'),
    tramosAns: construirTramosAns(registro('ANS').metadata),
    escalaAntiguedad: construirEscala(bono.metadata),
    vigencias,
  };
}

export function porcentajeAntiguedad(parametros: ParametrosNomina, anios: number): bigint {
  const tramo = parametros.escalaAntiguedad.find(
    (item) => anios >= item.aniosDesde && (item.aniosHasta === null || anios <= item.aniosHasta),
  );
  return tramo?.porcentaje ?? 0n;
}

/** Representación JSON estable guardada en `planilla_mensual.parametros_aplicados`. */
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
