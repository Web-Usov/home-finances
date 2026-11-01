import { operationsControllerRemoveV1, operationsControllerUpdateV1 } from '../../api/operations/operations';
import type { OperationsControllerUpdateV1Body } from '../../api/model';
import { useMonthMutation } from '../../lib/useMonthMutation';

/** PATCH /api/v1/operations/:id (API-11, HIST-07/08): `version` is the operation month's cached version (`If-Match`). */
export function useUpdateOperation() {
  return useMonthMutation(
    'operationsControllerUpdateV1',
    ({ id, data }: { id: string; data: OperationsControllerUpdateV1Body; version: number }, options) =>
      operationsControllerUpdateV1(id, data, options),
  );
}

/** DELETE /api/v1/operations/:id (API-11, HIST-07/08, OP-18): `version` travels in `If-Match`. */
export function useDeleteOperation() {
  return useMonthMutation('operationsControllerRemoveV1', ({ id }: { id: string; version: number }, options) =>
    operationsControllerRemoveV1(id, options),
  );
}
