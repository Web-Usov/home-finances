import { Injectable } from '@nestjs/common';

/**
 * Reporting service — monthly snapshots, history, yearly analytics.
 * TODO: Implement per SPECIFICATION.md § Yearly Analytics (lines 375-404).
 */
@Injectable()
export class ReportingService {
  monthlyDashboard() {
    // TODO: return month summary, envelope statuses, warnings
    return { summary: null, envelopes: [], warnings: [] };
  }

  yearlyAnalytics() {
    // TODO: return three reports: income/allocation/free, envelope balances, uncovered operations
    return {
      incomeReport: [],
      envelopeBalances: [],
      uncoveredOperations: [],
    };
  }
}
