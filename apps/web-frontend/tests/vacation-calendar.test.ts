import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVacationCalendarDays,
  formatVacationMonth,
  getVacationMonthBounds,
  shiftVacationMonth,
} from '../src/lib/vacation-calendar';

test('calendar bounds cover the complete month, including leap days', () => {
  assert.deepEqual(getVacationMonthBounds('2024-02'), {
    desde: '2024-02-01',
    hasta: '2024-02-29',
  });
  assert.deepEqual(getVacationMonthBounds('2026-11'), {
    desde: '2026-11-01',
    hasta: '2026-11-30',
  });
});

test('calendar grid starts on Sunday and fills complete weeks', () => {
  const days = buildVacationCalendarDays('2026-11');
  assert.equal(days.length, 35);
  assert.deepEqual(days.slice(0, 3).map(({ date, inMonth }) => [date, inMonth]), [
    ['2026-11-01', true],
    ['2026-11-02', true],
    ['2026-11-03', true],
  ]);
  assert.equal(days.at(-1)?.date, '2026-12-05');
  assert.equal(days.at(-1)?.inMonth, false);
});

test('month navigation crosses year boundaries and formats in Spanish', () => {
  assert.equal(shiftVacationMonth('2026-01', -1), '2025-12');
  assert.equal(shiftVacationMonth('2026-12', 1), '2027-01');
  assert.match(formatVacationMonth('2026-10'), /octubre de 2026/i);
});

test('invalid calendar months are rejected', () => {
  assert.throws(() => getVacationMonthBounds('2026-13'), RangeError);
  assert.throws(() => buildVacationCalendarDays('2026-1'), RangeError);
});
