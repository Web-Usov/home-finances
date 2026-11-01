import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { customAxiosInstance } from '../../api/axios-instance';
import {
  monthsControllerCloseV1,
  monthsControllerReopenV1,
  monthsControllerUpdateIncomeV1,
} from '../../api/months/months';
import type { MonthsControllerUpdateIncomeV1Body } from '../../api/model';
import { useMonthMutation } from '../../lib/useMonthMutation';
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

/** PATCH /api/v1/months/:period (API-03): `version` is the month's cached version, sent as `If-Match` (API-25). */
export function useUpdateIncome() {
  return useMonthMutation(
    'monthsControllerUpdateIncomeV1',
    ({ period, data }: { period: string; data: MonthsControllerUpdateIncomeV1Body; version: number }, options) =>
      monthsControllerUpdateIncomeV1(period, data, options),
  );
}

/** POST /api/v1/months/:period/close (API-05): no body, the version travels in `If-Match`. */
export function useCloseMonth() {
  return useMonthMutation('monthsControllerCloseV1', ({ period }: { period: string; version: number }, options) =>
    monthsControllerCloseV1(period, options),
  );
}

/** POST /api/v1/months/:period/reopen (API-06): no body, the version travels in `If-Match`. */
export function useReopenMonth() {
  return useMonthMutation('monthsControllerReopenV1', ({ period }: { period: string; version: number }, options) =>
    monthsControllerReopenV1(period, options),
  );
}
