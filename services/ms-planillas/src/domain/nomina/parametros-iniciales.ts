import type { ParametroLegalRaw } from './parametros';

/**
 * Datos de SEMILLA (prisma/seed.ts) y de pruebas, en el formato de
 * `parametro_legal` (tipo + clave + valor + metadata). El motor NO los lee:
 * usa siempre lo persistido. Valores del Product Backlog (HU-20); no constituyen
 * verificación normativa externa.
 */
export const VIGENCIA_INICIAL = '2026-01-01';

export interface ParametroInicial {
  tipo: 'SMN' | 'APORTE_LABORAL' | 'APORTE_PATRONAL' | 'BONO_ANTIGUEDAD' | 'RC_IVA' | 'OTRO';
  clave: string;
  valor: string;
  unidad: string;
  metadata?: Record<string, unknown>;
}

export const PARAMETROS_INICIALES: readonly ParametroInicial[] = [
  { tipo: 'SMN', clave: 'SMN_NACIONAL', valor: '3300.0000', unidad: 'BOB' },
  { tipo: 'APORTE_LABORAL', clave: 'AFP_LABORAL', valor: '12.7100', unidad: 'PCT' },
  { tipo: 'APORTE_PATRONAL', clave: 'AFP_PATRONAL', valor: '16.7100', unidad: 'PCT' },
  { tipo: 'RC_IVA', clave: 'RC_IVA_ALICUOTA', valor: '13.0000', unidad: 'PCT' },
  { tipo: 'RC_IVA', clave: 'RC_IVA_MINIMO_NO_IMPONIBLE', valor: '2.0000', unidad: 'SMN' },
  {
    // valor = base del bono expresada en SMN; porcentajeSMN se aplica sobre esa base.
    tipo: 'BONO_ANTIGUEDAD',
    clave: 'ESCALA_LGT_REFERENCIAL',
    valor: '3.0000',
    unidad: 'SMN',
    metadata: {
      tramos: [
        { desdeAnios: 2, hastaAnios: 4, porcentajeSMN: 5 },
        { desdeAnios: 5, hastaAnios: 7, porcentajeSMN: 11 },
        { desdeAnios: 8, hastaAnios: 10, porcentajeSMN: 18 },
        { desdeAnios: 11, hastaAnios: 14, porcentajeSMN: 26 },
        { desdeAnios: 15, hastaAnios: 19, porcentajeSMN: 34 },
        { desdeAnios: 20, hastaAnios: 24, porcentajeSMN: 42 },
        { desdeAnios: 25, hastaAnios: null, porcentajeSMN: 50 },
      ],
    },
  },
  {
    tipo: 'OTRO',
    clave: 'ANS_APORTE_SOLIDARIO',
    valor: '0.0000',
    unidad: 'ESCALA',
    metadata: {
      tramos: [
        { limite: '13000.00', porcentaje: '1' },
        { limite: '25000.00', porcentaje: '5' },
        { limite: '35000.00', porcentaje: '10' },
      ],
    },
  },
];

export function filasIniciales(): ParametroLegalRaw[] {
  return PARAMETROS_INICIALES.map((p) => ({
    tipo: p.tipo,
    clave: p.clave,
    valor: p.valor,
    metadata: p.metadata ?? null,
    vigenteDesde: VIGENCIA_INICIAL,
  }));
}
