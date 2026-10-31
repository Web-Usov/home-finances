import { formatMoneyMinor, formatMoneyMinorRu } from '@family-budget/types';

const NBSP = '\u00A0';

describe('formatMoneyMinorRu (MSG-07)', () => {
  it.each([
    [0, '0,00'],
    [1, '0,01'],
    [5, '0,05'],
    [10, '0,10'],
    [99, '0,99'],
    [100, '1,00'],
    [123450, `1${NBSP}234,50`],
    [99_999, `999,99`],
    [100_000, `1${NBSP}000,00`],
    [100_001, `1${NBSP}000,01`],
    [10_000_000, `100${NBSP}000,00`],
    [100_000_000, `1${NBSP}000${NBSP}000,00`],
    [123_456_789_01, `123${NBSP}456${NBSP}789,01`],
  ])('MSG-07: formats %i kopecks as %j', (minor, expected) => {
    expect(formatMoneyMinorRu(minor)).toBe(expected);
  });

  it('MSG-07: formats 1 kopeck, 123450 kopecks and 10000000 kopecks as 0,01 / 1 234,50 / 100 000,00', () => {
    expect([1, 123450, 10_000_000].map(formatMoneyMinorRu)).toEqual([
      '0,01',
      `1${NBSP}234,50`,
      `100${NBSP}000,00`,
    ]);
  });

  it('MSG-07: separates thousands with U+00A0 only, never an ordinary space or a dot', () => {
    const text = formatMoneyMinorRu(123_456_789);
    expect(text).toBe(`1${NBSP}234${NBSP}567,89`);
    expect(text).not.toMatch(/[ .]/); // neither a plain space nor a dot
  });

  it('MSG-07: negative amounts keep a U+2212 minus and the same grouping', () => {
    expect(formatMoneyMinorRu(-1)).toBe('\u22120,01');
    expect(formatMoneyMinorRu(-123450)).toBe(`\u22121${NBSP}234,50`);
  });

  it('API-14: the transport format formatMoneyMinor is unchanged', () => {
    expect(formatMoneyMinor(1)).toBe('0.01');
    expect(formatMoneyMinor(123450)).toBe('1234.50');
  });
});
