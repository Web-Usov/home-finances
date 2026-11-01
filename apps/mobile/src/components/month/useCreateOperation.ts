import { operationsControllerCreateV1 } from '../../api/operations/operations';
import type { OperationsControllerCreateV1Body } from '../../api/model';
import { useMonthMutation } from '../../lib/useMonthMutation';

/**
 * POST /api/v1/operations (API-21, UI-16). The caller always passes the displayed month as `data.period` together
 * with that month's cached `version` (sent as `If-Match`, API-25).
 */
export function useCreateOperation() {
  return useMonthMutation(
    'operationsControllerCreateV1',
    ({ data }: { data: OperationsControllerCreateV1Body; version: number }, options) =>
      operationsControllerCreateV1(data, options),
  );
}
