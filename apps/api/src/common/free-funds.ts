/**
 * Free funds of a month in kopecks (FIN-11): income minus allocations, nothing else (operations never
 * change it, FIN-12). Negative when the month is over-allocated.
 */
export function freeFundsMinor(incomeMinor: number, allocatedMinor: number): number {
  return incomeMinor - allocatedMinor;
}
