import { MoneyStringSchema, formatMoneyMinor, parseMoneyMinor } from '@family-budget/types';
import { normalizeMoneyInput } from './money';

export interface AllocationTotals {
  /** Kopecks of the typed income, or null while the income field is not a valid amount. */
  incomeMinor: number | null;
  allocatedMinor: number;
  /** Income minus allocated; negative on overflow, 0 while the income is invalid. */
  freeMinor: number;
  /** Kopecks by which the allocation exceeds the income (FIN-02), 0 when it fits. */
  overflowMinor: number;
  /** True when at least one typed amount is not a valid money value. */
  hasInvalid: boolean;
}

/** An empty field counts as zero; anything else must normalise to a `MoneyStringSchema` value. */
export function amountToMinor(raw: string): number | null {
  const normalized = normalizeMoneyInput(raw);
  if (normalized === '') return 0;
  return MoneyStringSchema.safeParse(normalized).success ? parseMoneyMinor(normalized) : null;
}

/**
 * Live totals of the allocation editor (UI-13, UI-14). Pure preview in integer kopecks (string -> kopecks -> sum),
 * never float arithmetic; the API stays the authority and re-validates on save (FIN-02).
 */
export function computeAllocationTotals(incomeRaw: string, amountsRaw: string[]): AllocationTotals {
  const incomeParsed = incomeRaw.trim() === '' ? null : amountToMinor(incomeRaw);
  let allocatedMinor = 0;
  let hasInvalid = false;
  for (const raw of amountsRaw) {
    const minor = amountToMinor(raw);
    if (minor === null) hasInvalid = true;
    else allocatedMinor += minor;
  }
  const freeMinor = incomeParsed === null ? 0 : incomeParsed - allocatedMinor;
  return {
    incomeMinor: incomeParsed,
    allocatedMinor,
    freeMinor,
    overflowMinor: incomeParsed !== null && freeMinor < 0 ? -freeMinor : 0,
    hasInvalid,
  };
}

/** API decimal string for a typed amount ("1 500,5" -> "1500.50"); an empty field is "0.00". */
export function amountToApiString(raw: string): string {
  return formatMoneyMinor(amountToMinor(raw) ?? 0);
}
