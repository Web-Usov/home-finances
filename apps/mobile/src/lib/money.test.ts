import { formatRubles, isNonZeroMoney, normalizeMoneyInput, toInputMoney } from './money';

const NBSP = ' ';

describe('formatRubles', () => {
  it('NFR-24: formats API decimal strings in ru-RU with grouped thousands and a decimal comma', () => {
    expect(formatRubles('15000.5')).toBe(`15${NBSP}000,50${NBSP}₽`);
    expect(formatRubles('0')).toBe(`0,00${NBSP}₽`);
    expect(formatRubles('1234567.89')).toBe(`1${NBSP}234${NBSP}567,89${NBSP}₽`);
  });

  it('NFR-24: never shows a negative amount unless explicitly signed (net adjustments)', () => {
    expect(formatRubles('-120.00')).toBe(`0,00${NBSP}₽`);
    expect(formatRubles('-120.00', { signed: true })).toBe(`−120,00${NBSP}₽`);
    expect(formatRubles('45.00', { signed: true })).toBe(`+45,00${NBSP}₽`);
    expect(formatRubles('0.00', { signed: true })).toBe(`0,00${NBSP}₽`);
  });
});

describe('money input helpers', () => {
  it('detects non-zero decimal strings', () => {
    expect(isNonZeroMoney('0.00')).toBe(false);
    expect(isNonZeroMoney('0.01')).toBe(true);
  });

  it('normalises typed input to an API decimal string', () => {
    expect(normalizeMoneyInput('1 500,5')).toBe('1500.5');
  });
});

describe('formatRubles showNegative / toInputMoney', () => {
  it('FIN-11: showNegative keeps the minus sign without adding a plus', () => {
    expect(formatRubles('-75000.00', { showNegative: true })).toBe('−75\u00A0000,00\u00A0₽');
    expect(formatRubles('25000.00', { showNegative: true })).toBe('25\u00A0000,00\u00A0₽');
  });

  it('prefills API decimals in ru-RU input form', () => {
    expect(toInputMoney('100000.00')).toBe('100000,00');
    expect(toInputMoney('0.5')).toBe('0,50');
    expect(toInputMoney('7')).toBe('7,00');
  });
});
