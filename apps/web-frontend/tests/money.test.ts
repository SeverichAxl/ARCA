import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centsToDecimalString,
  formatMoney,
  parseDecimalString,
} from '../src/lib/format/money';

test('MoneyText formatea strings decimales en es-BO con dos decimales', () => {
  assert.equal(formatMoney('8995.00'), 'Bs 8.995,00');
  assert.equal(formatMoney('0'), 'Bs 0,00');
  assert.equal(formatMoney('0.5'), 'Bs 0,50');
  assert.equal(formatMoney('1234567.89'), 'Bs 1.234.567,89');
  assert.equal(formatMoney('-1500.5'), 'Bs -1.500,50');
});

test('cero y negativos se tratan sin signo negativo espurio', () => {
  assert.equal(formatMoney('0.00'), 'Bs 0,00');
  assert.equal(formatMoney('-0.00'), 'Bs 0,00');
  assert.equal(formatMoney('-0.004'), 'Bs 0,00');
  assert.equal(formatMoney('-0.005'), 'Bs -0,01');
});

test('redondea a centavos sin pasar por float', () => {
  assert.equal(formatMoney('0.005'), 'Bs 0,01');
  assert.equal(formatMoney('0.004'), 'Bs 0,00');
  assert.equal(formatMoney('1.999'), 'Bs 2,00');
  assert.equal(formatMoney('-1.999'), 'Bs -2,00');
});

test('conserva precisión más allá de Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatMoney('9007199254740993.99'), 'Bs 9.007.199.254.740.993,99');
  assert.equal(formatMoney('9007199254740993.999'), 'Bs 9.007.199.254.740.994,00');
});

test('valores inválidos se muestran como raya', () => {
  assert.equal(formatMoney(null), '—');
  assert.equal(formatMoney(undefined), '—');
  assert.equal(formatMoney(''), '—');
  assert.equal(formatMoney('1234,56'), '—');
  assert.equal(formatMoney('1.2.3'), '—');
  assert.equal(formatMoney('abc'), '—');
});

test('parseDecimalString separa signo, entero y fracción', () => {
  assert.deepEqual(parseDecimalString('-0012.340'), {
    negative: true,
    whole: '12',
    fraction: '340',
  });
  assert.deepEqual(parseDecimalString('+0.5'), {
    negative: false,
    whole: '0',
    fraction: '5',
  });
  assert.equal(parseDecimalString('1e3'), null);
});

test('centsToDecimalString reconstruye importes desde enteros', () => {
  assert.equal(centsToDecimalString(899500), '8995.00');
  assert.equal(centsToDecimalString(0), '0.00');
  assert.equal(centsToDecimalString(-15050), '-150.50');
  assert.equal(centsToDecimalString(5n), '0.05');
});
