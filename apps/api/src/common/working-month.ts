import type { MonthStatus } from '@prisma/client';

/**
 * Working month (MON-16, MON-01, MON-02, MON-04): prefer 'open', then 'reopened', then 'draft'.
 * With no mutable month it falls back to the first entry, which callers pass sorted by period
 * descending, i.e. the latest month. Undefined when `months` is empty. Pure: no I/O, no mutation.
 */
export function pickWorkingMonth<T extends { status: MonthStatus }>(months: readonly T[]): T | undefined {
  return (
    months.find((m) => m.status === 'open') ??
    months.find((m) => m.status === 'reopened') ??
    months.find((m) => m.status === 'draft') ??
    months[0]
  );
}
