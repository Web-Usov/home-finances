import { Prisma } from '@prisma/client';

/** Name of the partial unique index of the migration `single_reopened_month` (MON-13). */
export const SINGLE_REOPENED_INDEX = 'budget_month_single_reopened_key';

/**
 * P2002 caused by the single-reopened-month partial unique index (MON-13) and nothing else.
 * `meta.target` is the index name or the indexed fields depending on the driver; `status` is
 * indexed by no other unique constraint, so either form identifies this index.
 */
export function isSingleReopenedViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target: unknown = error.meta?.target;
  if (Array.isArray(target)) {
    return target.length === 1 && (target[0] === 'status' || target[0] === SINGLE_REOPENED_INDEX);
  }
  return typeof target === 'string' && target === SINGLE_REOPENED_INDEX;
}
