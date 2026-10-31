import type { BudgetMonth } from '@prisma/client';
import { ConflictException } from '../../common/exceptions';

export interface ReopenRange {
  from: string;
  to: string;
}

/**
 * The single source of truth for "can this month be reopened, and what will be recalculated"
 * (API-06, API-20), shared by `POST .../reopen` and `GET .../reopen-preview` so they cannot diverge.
 *
 * Throws the reopen errors: 409 INVALID_STATUS_TRANSITION when the month is not closed or another
 * month is already reopened (MON-13). Otherwise returns the inclusive range from `month.period` to
 * the last existing month (MON-12, MON-14). Pure: callers pass the already-read rows.
 */
export function planReopen(
  month: Pick<BudgetMonth, 'period' | 'status'>,
  reopened: Pick<BudgetMonth, 'period'> | null,
  last: Pick<BudgetMonth, 'period'> | null,
): ReopenRange {
  if (month.status !== 'closed') {
    throw new ConflictException(
      'INVALID_STATUS_TRANSITION',
      `Месяц ${month.period} не закрыт. Повторно открыть можно только закрытый месяц.`,
    );
  }
  if (reopened !== null) {
    throw new ConflictException(
      'INVALID_STATUS_TRANSITION',
      `Месяц ${reopened.period} уже открыт повторно. Закройте его, прежде чем открывать другой.`,
    );
  }
  return { from: month.period, to: last?.period ?? month.period };
}
