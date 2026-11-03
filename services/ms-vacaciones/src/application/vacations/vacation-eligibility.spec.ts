import {
  completedYearsOfService,
  isVacationEligible,
} from './vacation-eligibility';

describe('vacation eligibility', () => {
  it('counts completed anniversaries, not partial years', () => {
    expect(completedYearsOfService('2025-11-03', new Date('2026-11-02T12:00:00Z'))).toBe(0);
    expect(completedYearsOfService('2025-11-03', new Date('2026-11-03T00:00:00Z'))).toBe(1);
  });

  it('requires ratification and at least one completed year', () => {
    const asOf = new Date('2026-11-02T00:00:00Z');
    expect(
      isVacationEligible(
        { estado: 'RATIFICADO', fechaIngreso: '2025-11-02' },
        asOf,
      ),
    ).toBe(true);
    expect(
      isVacationEligible(
        { estado: 'EN_PRUEBA', fechaIngreso: '2020-01-01' },
        asOf,
      ),
    ).toBe(false);
    expect(
      isVacationEligible(
        { estado: 'RATIFICADO', fechaIngreso: '2025-11-03' },
        asOf,
      ),
    ).toBe(false);
  });
});
