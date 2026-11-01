import { freeFundsMinor } from './free-funds';

describe('freeFundsMinor', () => {
  it('FIN-11: free funds are income minus allocated', () => {
    expect(freeFundsMinor(1_000_000, 400_000)).toBe(600_000);
  });

  it('FIN-11: nothing allocated leaves the whole income free', () => {
    expect(freeFundsMinor(1_000_000, 0)).toBe(1_000_000);
  });

  it('FIN-11: fully allocated income leaves zero', () => {
    expect(freeFundsMinor(1_000_000, 1_000_000)).toBe(0);
  });

  it('FIN-11: an over-allocated month has negative free funds', () => {
    expect(freeFundsMinor(1_000_000, 1_250_050)).toBe(-250_050);
  });

  it('FIN-11: zero income with allocations is negative; all zero is zero', () => {
    expect(freeFundsMinor(0, 100)).toBe(-100);
    expect(freeFundsMinor(0, 0)).toBe(0);
  });
});
