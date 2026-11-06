interface EmployeeEligibility {
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  fechaIngreso: Date | string;
}

function dateOnly(value: Date | string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('La fecha de ingreso no es válida.');
    }
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('La fecha de ingreso debe tener formato YYYY-MM-DD.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    throw new Error('La fecha de ingreso no es válida.');
  }
  return result;
}

export function completedYearsOfService(
  fechaIngreso: Date | string,
  asOf = new Date(),
): number {
  const start = dateOnly(fechaIngreso);
  const today = dateOnly(asOf);
  let years = today.getUTCFullYear() - start.getUTCFullYear();

  const month = start.getUTCMonth();
  const day = Math.min(
    start.getUTCDate(),
    new Date(Date.UTC(today.getUTCFullYear(), month + 1, 0)).getUTCDate(),
  );
  const anniversary = Date.UTC(today.getUTCFullYear(), month, day);

  if (today.getTime() < anniversary) {
    years -= 1;
  }
  return Math.max(years, 0);
}

export function isVacationEligible(
  employee: EmployeeEligibility,
  asOf = new Date(),
): boolean {
  return (
    employee.estado === 'RATIFICADO' &&
    completedYearsOfService(employee.fechaIngreso, asOf) >= 1
  );
}
