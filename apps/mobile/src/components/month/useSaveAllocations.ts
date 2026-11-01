import { allocationsControllerSaveV1 } from '../../api/allocations/allocations';
import { useMonthMutation } from '../../lib/useMonthMutation';

export interface SaveAllocationsInput {
  period: string;
  /** Cached version of the month, sent as `If-Match` (API-25). */
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
  return useMonthMutation('saveAllocations', ({ period, allocations, income }: SaveAllocationsInput, options) =>
    allocationsControllerSaveV1(period, { allocations, ...(income !== undefined ? { income } : {}) }, options),
  );
}
