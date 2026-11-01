import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { customAxiosInstance } from '../../api/axios-instance';
import { invalidateBudgetData } from '../../lib/queryKeys';
import type { ApiErrorResponse } from '../envelopes/types';
import type { CreateMonthBody, MonthSummary } from './types';

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
    onSuccess: () => invalidateBudgetData(queryClient),
  });
}
