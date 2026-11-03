import { countBusinessDays, parseDateOnly } from './vacation-dates';

describe('vacation date calculations', () => {
  it('rejects invalid calendar dates', () => {
    expect(() => parseDateOnly('2026-02-30')).toThrow('La fecha no es válida.');
    expect(() => parseDateOnly('2026/02/28')).toThrow('formato YYYY-MM-DD');
  });

  it('counts weekdays inclusively and excludes weekends and holidays', () => {
    const start = parseDateOnly('2026-12-21');
    const end = parseDateOnly('2026-12-25');
    const holidays = [parseDateOnly('2026-12-25')];

    expect(countBusinessDays(start, end, holidays)).toBe(4);
  });

  it('returns zero for ranges containing only weekends and holidays', () => {
    const start = parseDateOnly('2026-12-26');
    const end = parseDateOnly('2026-12-27');

    expect(countBusinessDays(start, end, [])).toBe(0);
  });
});
