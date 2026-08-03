import { Injectable } from '@nestjs/common';

/**
 * Months service — handles month lifecycle, income, status transitions.
 * TODO: Implement per SPECIFICATION.md § Life Cycle of Month (lines 198-232).
 */
@Injectable()
export class MonthsService {
  list() {
    // TODO: return list of months with brief summaries
    return { months: [] };
  }

  create(dto: unknown) {
    // TODO: create first or next month, handle draft promotion
    return { month: null, message: 'Not implemented' };
  }

  updateIncome(period: string, dto: unknown) {
    // TODO: update income, trigger cascade recalculation
    return { period, income: 0, message: 'Not implemented' };
  }

  close(period: string) {
    // TODO: validate month is open, promote draft to open
    return { period, status: 'closed', message: 'Not implemented' };
  }

  reopen(period: string, dto: unknown) {
    // TODO: validate month is closed, warn about recalculation range
    return { period, status: 'reopened', recalcRange: [], message: 'Not implemented' };
  }
}
