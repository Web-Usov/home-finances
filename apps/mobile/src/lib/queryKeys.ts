import type { QueryClient } from '@tanstack/react-query';
import { getEnvelopesControllerListV1QueryKey } from '../api/envelopes/envelopes';
import { getMonthsControllerListV1QueryKey } from '../api/months/months';
import { getOperationsControllerListV1QueryKey } from '../api/operations/operations';
import {
  getReportingControllerMonthlyDashboardV1QueryKey,
  getReportingControllerYearlyAnalyticsV1QueryKey,
} from '../api/reporting/reporting';

/**
 * Every query that shows budget data. Any mutation that changes envelopes, allocations, income, operations or a month
 * must call `invalidateBudgetData`, so no screen keeps a stale copy (QueryProvider caches for 5 minutes).
 */
export const budgetQueryKeys = [
  getMonthsControllerListV1QueryKey,
  getReportingControllerMonthlyDashboardV1QueryKey,
  getReportingControllerYearlyAnalyticsV1QueryKey,
  getEnvelopesControllerListV1QueryKey,
  getOperationsControllerListV1QueryKey,
] as const;

export function invalidateBudgetData(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(budgetQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: queryKey() })));
}
