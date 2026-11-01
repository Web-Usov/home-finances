import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  useOperationsControllerRemoveV1,
  useOperationsControllerUpdateV1,
} from '../../api/operations/operations';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateBudgetData } from '../../lib/queryKeys';

/** PATCH /api/v1/operations/:id (API-11, HIST-07/08): the body carries the operation month's `version`. */
export function useUpdateOperation() {
  const queryClient = useQueryClient();
  return useOperationsControllerUpdateV1<AxiosError<ApiErrorResponse>>({
    mutation: { onSettled: () => invalidateBudgetData(queryClient) },
  });
}

/** DELETE /api/v1/operations/:id?version=N (API-11, HIST-07/08, OP-18). */
export function useDeleteOperation() {
  const queryClient = useQueryClient();
  return useOperationsControllerRemoveV1<AxiosError<ApiErrorResponse>>({
    mutation: { onSettled: () => invalidateBudgetData(queryClient) },
  });
}
