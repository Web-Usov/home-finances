import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  monthsControllerCloseV1,
  monthsControllerReopenV1,
  monthsControllerUpdateIncomeV1,
  useMonthsControllerCreateV1,
} from '../../api/months/months';
import type { MonthsControllerUpdateIncomeV1Body } from '../../api/model';
import { useMonthMutation } from '../../lib/useMonthMutation';
import { invalidateBudgetData } from '../../lib/queryKeys';
import type { ApiErrorResponse } from '../envelopes/types';

/** POST /api/v1/months (API-02): the first or the next month; no `If-Match` (nothing to lock yet, API-25). */
export function useCreateMonth() {
  const queryClient = useQueryClient();
  return useMonthsControllerCreateV1<AxiosError<ApiErrorResponse>>({
    mutation: { onSuccess: () => invalidateBudgetData(queryClient) },
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
