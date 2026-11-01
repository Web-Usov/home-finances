import type { OperationsControllerListV1200OperationsItem } from '../../api/model';

/** One row of GET /api/v1/operations (API-10). Amounts are integer kopecks. */
export type HistoryOperation = OperationsControllerListV1200OperationsItem;

/** Operation types with an editable form; `initial_balance` is managed through its envelope (OP-10). */
export type EditableOperationType = 'expense' | 'transfer' | 'adjustment';

export function isEditable(operation: HistoryOperation): boolean {
  return !operation.isInitial && operation.type !== 'initial_balance';
}
