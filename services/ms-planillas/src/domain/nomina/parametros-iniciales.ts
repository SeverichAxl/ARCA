/**
 * Datos de semilla. El motor de cálculo debe leer siempre lo persistido en
 * parametro_legal / escala_antiguedad, no estas constantes.
 * Valores del Product Backlog (HU-20); no constituyen verificación normativa.
 */
export const VIGENCIA_INICIAL = '2025-05-01';

export const PARAMETROS_INICIALES: ReadonlyArray<{
  clave: string;
  valor: string;
  descripcion: string;
}> = [
  { clave: 'SMN', valor: '3300.00', descripcion: 'Salario Mínimo Nacional (Bs)' },
  { clave: 'APORTE_LABORAL_PCT', valor: '12.71', descripcion: 'Aportes laborales AFP/SIP (%)' },
  {
    clave: 'APORTE_PATRONAL_PCT',
    valor: '16.71',
    descripcion: 'Aportes patronales CNS, riesgo, vivienda, solidario (%)',
  },
  { clave: 'RC_IVA_PCT', valor: '13', descripcion: 'Alícuota RC-IVA (%)' },
  {
    clave: 'RC_IVA_MINIMO_NO_IMPONIBLE_SMN',
    valor: '2',
    descripcion: 'Mínimo no imponible RC-IVA en SMN',
  },
  {
    clave: 'BONO_ANTIGUEDAD_BASE_SMN',
    valor: '3',
    descripcion: 'Base del Bono de Antigüedad en SMN',
  },
  { clave: 'ANS_TRAMO_1_LIMITE', valor: '13000.00', descripcion: 'ANS: límite tramo 1 (Bs)' },
  { clave: 'ANS_TRAMO_1_PCT', valor: '1', descripcion: 'ANS: % sobre excedente tramo 1' },
  { clave: 'ANS_TRAMO_2_LIMITE', valor: '25000.00', descripcion: 'ANS: límite tramo 2 (Bs)' },
  { clave: 'ANS_TRAMO_2_PCT', valor: '5', descripcion: 'ANS: % sobre excedente tramo 2' },
  { clave: 'ANS_TRAMO_3_LIMITE', valor: '35000.00', descripcion: 'ANS: límite tramo 3 (Bs)' },
  { clave: 'ANS_TRAMO_3_PCT', valor: '10', descripcion: 'ANS: % sobre excedente tramo 3' },
];

export const ESCALA_ANTIGUEDAD_INICIAL: ReadonlyArray<{
  aniosDesde: number;
  aniosHasta: number | null;
  porcentaje: string;
}> = [
  { aniosDesde: 0, aniosHasta: 1, porcentaje: '0' },
  { aniosDesde: 2, aniosHasta: 4, porcentaje: '5' },
  { aniosDesde: 5, aniosHasta: 7, porcentaje: '11' },
  { aniosDesde: 8, aniosHasta: 10, porcentaje: '18' },
  { aniosDesde: 11, aniosHasta: 14, porcentaje: '26' },
  { aniosDesde: 15, aniosHasta: 19, porcentaje: '34' },
  { aniosDesde: 20, aniosHasta: 24, porcentaje: '42' },
  { aniosDesde: 25, aniosHasta: null, porcentaje: '50' },
];

export function filasIniciales(): {
  filas: Array<{ clave: string; valor: string; vigenteDesde: string }>;
  escala: Array<{
    aniosDesde: number;
    aniosHasta: number | null;
    porcentaje: string;
    vigenteDesde: string;
  }>;
} {
  return {
    filas: PARAMETROS_INICIALES.map((parametro) => ({
      clave: parametro.clave,
      valor: parametro.valor,
      vigenteDesde: VIGENCIA_INICIAL,
    })),
    escala: ESCALA_ANTIGUEDAD_INICIAL.map((tramo) => ({
      ...tramo,
      vigenteDesde: VIGENCIA_INICIAL,
    })),
  };
}
