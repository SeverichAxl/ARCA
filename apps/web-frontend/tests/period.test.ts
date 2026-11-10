import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateInBolivia,
  formatDateOnly,
  formatPeriodo,
  isPeriodo,
} from '../src/lib/format/period';

test('formatPeriodo muestra el mes en español', () => {
  assert.equal(formatPeriodo('2026-01'), 'Enero 2026');
  assert.equal(formatPeriodo('2026-10'), 'Octubre 2026');
  assert.equal(formatPeriodo('2026-12'), 'Diciembre 2026');
});

test('formatPeriodo rechaza periodos inválidos sin romper', () => {
  assert.equal(formatPeriodo('2026-13'), '2026-13');
  assert.equal(formatPeriodo('2026-1'), '2026-1');
  assert.equal(formatPeriodo(null), '—');
  assert.equal(isPeriodo('2026-10'), true);
  assert.equal(isPeriodo('2026-13'), false);
});

test('formatDateOnly no sufre desfase de zona horaria', () => {
  assert.equal(formatDateOnly('2026-01-01'), '01/01/2026');
  assert.equal(formatDateOnly('2026-12-31'), '31/12/2026');
  assert.equal(formatDateOnly('2026-01-01T23:30:00.000Z'), '01/01/2026');
});

test('formatDateOnly valida fechas reales', () => {
  assert.equal(formatDateOnly('2024-02-29'), '29/02/2024');
  assert.equal(formatDateOnly('2026-02-29'), '2026-02-29');
  assert.equal(formatDateOnly('2026-04-31'), '2026-04-31');
  assert.equal(formatDateOnly('texto'), 'texto');
});

test('formatDateInBolivia usa America/La_Paz', () => {
  // 02:00 UTC del 6 de noviembre = 22:00 del 5 de noviembre en Bolivia.
  assert.equal(formatDateInBolivia('2026-11-06T02:00:00.000Z'), '05/11/2026');
  assert.equal(formatDateInBolivia('2026-11-05T15:30:00.000Z'), '05/11/2026');
  assert.equal(formatDateInBolivia('fecha-invalida'), 'fecha-invalida');
});
