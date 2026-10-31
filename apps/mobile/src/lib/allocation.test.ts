import { computeAllocationTotals } from './allocation';

describe('computeAllocationTotals', () => {
  it('UI-13 / FIN-08: sums kopecks exactly (0.10 + 0.20 is 0.30, not a float artefact)', () => {
    const totals = computeAllocationTotals('1', ['0.10', '0,20']);
    expect(totals.allocatedMinor).toBe(30);
    expect(totals.freeMinor).toBe(70);
    expect(totals.overflowMinor).toBe(0);
  });

  it('UI-13: accepts spaces, comma, one decimal digit and empty fields', () => {
    const totals = computeAllocationTotals('100 000', ['1 500,5', '', '0.07']);
    expect(totals.allocatedMinor).toBe(150_057);
    expect(totals.freeMinor).toBe(10_000_000 - 150_057);
  });

  it('UI-14 / AC-03: 100000.01 on income 100000 overflows by exactly one kopeck', () => {
    const totals = computeAllocationTotals('100000', ['100000.01']);
    expect(totals.overflowMinor).toBe(1);
    expect(totals.freeMinor).toBe(-1);
  });

  it('flags invalid amounts and ignores them in the sum', () => {
    const totals = computeAllocationTotals('10', ['abc', '1.234', '2']);
    expect(totals.hasInvalid).toBe(true);
    expect(totals.allocatedMinor).toBe(200);
  });

  it('an invalid income gives no overflow and zero free funds', () => {
    const totals = computeAllocationTotals('x', ['5']);
    expect(totals.incomeMinor).toBeNull();
    expect(totals.overflowMinor).toBe(0);
    expect(totals.freeMinor).toBe(0);
  });
});
