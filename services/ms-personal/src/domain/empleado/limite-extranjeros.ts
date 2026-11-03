/**
 * Art. 3 LGT: el personal extranjero no puede superar el porcentaje configurado (15%).
 * Evalúa la situación DESPUÉS de dar de alta a un extranjero más.
 */
export function superaLimiteExtranjeros(
  totalVigentes: number,
  extranjerosVigentes: number,
  limitePct: number,
): boolean {
  const total = totalVigentes + 1;
  const extranjeros = extranjerosVigentes + 1;
  return extranjeros * 100 > limitePct * total;
}
