import { QueryClient } from '@tanstack/react-query';
import { getEnvelopesControllerListV1QueryKey } from '../api/envelopes/envelopes';
import { getMonthsControllerListV1QueryKey } from '../api/months/months';
import { getOperationsControllerListV1QueryKey } from '../api/operations/operations';
import {
  getReportingControllerMonthlyDashboardV1QueryKey,
  getReportingControllerYearlyAnalyticsV1QueryKey,
} from '../api/reporting/reporting';
import { invalidateBudgetData } from './queryKeys';

describe('invalidateBudgetData', () => {
  it('SCOPE-25 / AC-18: invalidates months, dashboard, analytics, envelopes and operations queries', async () => {
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await invalidateBudgetData(queryClient);

    const keys = invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual([
      getMonthsControllerListV1QueryKey(),
      getReportingControllerMonthlyDashboardV1QueryKey(),
      getReportingControllerYearlyAnalyticsV1QueryKey(),
      getEnvelopesControllerListV1QueryKey(),
      getOperationsControllerListV1QueryKey(),
    ]);
  });
});
