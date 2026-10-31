import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { customAxiosInstance } from '../../api/axios-instance';
import { getEnvelopesControllerListV1QueryKey } from '../../api/envelopes/envelopes';
import { getMonthsControllerListV1QueryKey } from '../../api/months/months';
import { getReportingControllerMonthlyDashboardV1QueryKey } from '../../api/reporting/reporting';
import type { ApiErrorResponse } from '../envelopes/types';
import type { CreateMonthBody, MonthSummary } from './types';

/** Month changes move every derived figure: refetch the month list, dashboards and envelope balances. */
export function invalidateMonthData(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getMonthsControllerListV1QueryKey() }),
    queryClient.invalidateQueries({ queryKey: getReportingControllerMonthlyDashboardV1QueryKey() }),
    queryClient.invalidateQueries({ queryKey: getEnvelopesControllerListV1QueryKey() }),
  ]);
}

/**
 * POST /api/v1/months. The generated `useMonthsControllerCreateV1` takes no body (the controller declares
 * none in OpenAPI), so the request is issued here through the same Orval mutator until the contract is fixed.
 */
export function useCreateMonth() {
  const queryClient = useQueryClient();
  return useMutation<{ month: MonthSummary }, AxiosError<ApiErrorResponse>, CreateMonthBody>({
    mutationKey: ['monthsControllerCreateV1'],
    mutationFn: (body) =>
      customAxiosInstance<{ month: MonthSummary }>({
        url: '/api/v1/months',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: body,
      }),
    onSuccess: () => invalidateMonthData(queryClient),
  });
}
