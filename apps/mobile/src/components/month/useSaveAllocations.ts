import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { allocationsControllerSaveV1 } from '../../api/allocations/allocations';
import { monthsControllerUpdateIncomeV1 } from '../../api/months/months';
import { reportingControllerMonthlyDashboardV1 } from '../../api/reporting/reporting';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateMonthData } from './useMonthMutations';

export interface SaveAllocationsInput {
  period: string;
  version: number;
  /** Envelope id -> API decimal string, one entry per active envelope (the whole table is replaced). */
  allocations: Record<string, string>;
  /** Set when the income field changed; `incomeFirst` tells which request has to go first. */
  income?: { value: string; incomeFirst: boolean };
}

/** Each mutation bumps the month version (ADR 0005); the mutation response shape is not relied upon (unified responses are still an open question), so re-read it. */
async function currentVersion(period: string): Promise<number> {
  return (await reportingControllerMonthlyDashboardV1({ period })).month.version;
}

/**
 * Save the allocation table (API-04) and, when the income changed, the income (API-03). The API refuses an income below
 * the stored allocation and an allocation above the stored income (FIN-02), so the two requests go in the safe order.
 * On success the month list and dashboards are refetched.
 */
export function useSaveAllocations() {
  const queryClient = useQueryClient();
  return useMutation<void, AxiosError<ApiErrorResponse>, SaveAllocationsInput>({
    mutationKey: ['saveAllocations'],
    mutationFn: async ({ period, version, allocations, income }) => {
      const saveAllocations = (v: number) => allocationsControllerSaveV1(period, { allocations, version: v });
      const saveIncome = (v: number) => monthsControllerUpdateIncomeV1(period, { income: income?.value ?? '', version: v });
      if (!income) {
        await saveAllocations(version);
      } else if (income.incomeFirst) {
        await saveIncome(version);
        await saveAllocations(await currentVersion(period));
      } else {
        await saveAllocations(version);
        await saveIncome(await currentVersion(period));
      }
    },
    onSettled: () => invalidateMonthData(queryClient),
  });
}
