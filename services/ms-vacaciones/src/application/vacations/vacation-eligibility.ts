export function completedServiceYears(fechaIngreso: Date, asOf: Date): number {
  let years = asOf.getUTCFullYear() - fechaIngreso.getUTCFullYear();
  const anniversaryHasPassed =
    asOf.getUTCMonth() > fechaIngreso.getUTCMonth() ||
    (asOf.getUTCMonth() === fechaIngreso.getUTCMonth() &&
      asOf.getUTCDate() >= fechaIngreso.getUTCDate());

  if (!anniversaryHasPassed) {
    years -= 1;
  }

  return Math.max(years, 0);
}

export function isVacationEligible(estado: string, fechaIngreso: Date, asOf: Date): boolean {
  return estado === 'RATIFICADO' && completedServiceYears(fechaIngreso, asOf) >= 1;
}

export function parsePositiveIntegerConfiguration(key: string, value: string | undefined): number {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`La configuración ${key} debe ser un entero positivo.`);
  }
  return days;
}
