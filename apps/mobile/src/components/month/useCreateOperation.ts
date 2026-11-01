import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  useOperationsControllerCreateV1,
} from '../../api/operations/operations';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateBudgetData } from '../../lib/queryKeys';

/**
 * POST /api/v1/operations (API-21, UI-16). The caller always passes the displayed month as `period` together with
 * that month's `version`. After a settled request the dashboard, month list, envelope balances and operation history
 * are refetched: a success moved the figures, a conflict means they were stale.
 */
export function useCreateOperation() {
  const queryClient = useQueryClient();
  return useOperationsControllerCreateV1<AxiosError<ApiErrorResponse>>({
    mutation: {
      onSettled: () => invalidateBudgetData(queryClient),
    },
  });
}
