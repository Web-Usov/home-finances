import type { Prisma } from '@prisma/client';
import type { MonthSummarySchema } from '@family-budget/types';
import type { z } from 'zod';

export type MonthSummaryDto = z.infer<typeof MonthSummarySchema>;

/**
 * Short summary of a month (API-22), re-read inside the mutation's transaction after the cascade
 * recalculation, because the engine bumps `version` (ADR 0005). Envelope balances are not part of it.
 */
export async function buildMonthSummary(
  db: Prisma.TransactionClient,
  monthId: string,
): Promise<MonthSummaryDto> {
  const month = await db.budgetMonth.findUnique({ where: { id: monthId } });
  if (month === null) {
    throw new Error(`Budget month disappeared during recalculation: ${monthId}`);
  }
  const aggregate = await db.allocation.aggregate({
    where: { monthId },
    _sum: { amountMinor: true },
  });
  const totalAllocatedMinor = aggregate._sum.amountMinor ?? 0;
  return {
    id: month.id,
    period: month.period,
    status: month.status,
    incomeMinor: month.incomeMinor,
    version: month.version,
    totalAllocatedMinor,
    freeFundsMinor: month.incomeMinor - totalAllocatedMinor,
  };
}
