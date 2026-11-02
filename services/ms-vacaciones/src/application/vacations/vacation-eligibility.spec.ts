import {
  completedServiceYears,
  isVacationEligible,
  parsePositiveIntegerConfiguration,
} from './vacation-eligibility';

describe('vacation eligibility', () => {
  it('counts only completed service years', () => {
    expect(
      completedServiceYears(
        new Date('2025-01-15T00:00:00.000Z'),
        new Date('2026-01-14T00:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      completedServiceYears(
        new Date('2025-01-15T00:00:00.000Z'),
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe(1);
  });

  it('requires ratification and at least one completed year', () => {
    const ingreso = new Date('2025-01-15T00:00:00.000Z');
    const asOf = new Date('2026-01-15T00:00:00.000Z');

    expect(isVacationEligible('RATIFICADO', ingreso, asOf)).toBe(true);
    expect(isVacationEligible('EN_PRUEBA', ingreso, asOf)).toBe(false);
    expect(isVacationEligible('RATIFICADO', ingreso, new Date('2026-01-14T00:00:00.000Z'))).toBe(
      false,
    );
  });

  it('validates the configurable days per management', () => {
    expect(parsePositiveIntegerConfiguration('DIAS_POR_GESTION', '15')).toBe(15);
    expect(() => parsePositiveIntegerConfiguration('DIAS_POR_GESTION', undefined)).toThrow(
      'La configuración DIAS_POR_GESTION debe ser un entero positivo.',
    );
    expect(() => parsePositiveIntegerConfiguration('MAX_GESTIONES_ACUMULADAS', '0')).toThrow(
      'La configuración MAX_GESTIONES_ACUMULADAS debe ser un entero positivo.',
    );
    expect(() => parsePositiveIntegerConfiguration('DIAS_POR_GESTION', '15.5')).toThrow();
  });
});
