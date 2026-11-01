import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '../components/envelopes/types';
import { invalidateBudgetData } from './queryKeys';
import { ifMatch } from './monthVersion';

/** Variables of every month-scoped mutation: `version` is the displayed month's cached version (API-25). */
export interface MonthScoped {
  version: number;
}

/**
 * The one way to run a month-scoped mutation (API-25, ADR 0005 addendum): `request` receives the variables and the
 * per-call request options carrying `If-Match: "<version>"`, which it must pass to the generated client function.
 * After a settled request the budget data is refetched: a success moved the figures, a conflict means they were stale.
 */
export function useMonthMutation<TData, TVars extends MonthScoped>(
  mutationKey: string,
  request: (variables: TVars, options: ReturnType<typeof ifMatch>) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, AxiosError<ApiErrorResponse>, TVars>({
    mutationKey: [mutationKey],
    mutationFn: (variables) => request(variables, ifMatch(variables.version)),
    onSettled: () => invalidateBudgetData(queryClient),
  });
}
