import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  getOperationsControllerListV1QueryKey,
  useOperationsControllerRemoveV1,
  useOperationsControllerUpdateV1,
} from '../../api/operations/operations';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateMonthData } from '../month/useMonthMutations';

/** An edit or delete moves the cascade: refetch history, dashboards, the month list and envelope balances. */
function invalidateAfterChange(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    invalidateMonthData(queryClient),
    queryClient.invalidateQueries({ queryKey: getOperationsControllerListV1QueryKey() }),
  ]);
}

/** PATCH /api/v1/operations/:id (API-11, HIST-07/08): the body carries the operation month's `version`. */
export function useUpdateOperation() {
  const queryClient = useQueryClient();
  return useOperationsControllerUpdateV1<AxiosError<ApiErrorResponse>>({
    mutation: { onSettled: () => invalidateAfterChange(queryClient) },
  });
}

/** DELETE /api/v1/operations/:id?version=N (API-11, HIST-07/08, OP-18). */
export function useDeleteOperation() {
  const queryClient = useQueryClient();
  return useOperationsControllerRemoveV1<AxiosError<ApiErrorResponse>>({
    mutation: { onSettled: () => invalidateAfterChange(queryClient) },
  });
}
