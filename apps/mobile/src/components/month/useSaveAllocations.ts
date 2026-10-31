import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { allocationsControllerSaveV1 } from '../../api/allocations/allocations';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateMonthData } from './useMonthMutations';

export interface SaveAllocationsInput {
  period: string;
  version: number;
  /** Envelope id -> API decimal string, one entry per active envelope (the whole table is replaced). */
  allocations: Record<string, string>;
  /** New income as an API decimal string; sent only when the income field changed. */
  income?: string;
}

/**
 * Save the allocation table (API-04) in ONE request; a changed income travels with it and is validated and stored
 * atomically by the API (FIN-02, one version bump). On success or failure the month data is refetched.
 */
export function useSaveAllocations() {
  const queryClient = useQueryClient();
  return useMutation<unknown, AxiosError<ApiErrorResponse>, SaveAllocationsInput>({
    mutationKey: ['saveAllocations'],
    mutationFn: ({ period, version, allocations, income }) =>
      allocationsControllerSaveV1(period, { allocations, version, ...(income !== undefined ? { income } : {}) }),
    onSettled: () => invalidateMonthData(queryClient),
  });
}
