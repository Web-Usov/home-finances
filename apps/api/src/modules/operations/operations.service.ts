import { Injectable } from '@nestjs/common';

/**
 * Operations service — manages expenses, transfers, adjustments.
 * TODO: Implement per SPECIFICATION.md § Operations and History (lines 297-328).
 */
@Injectable()
export class OperationsService {
  list() {
    // TODO: return operation history with filters
    return { operations: [] };
  }

  create(_dto: unknown) {
    // TODO: validate, create operation, calculate result, trigger recalculation
    return { operation: null, message: 'Not implemented' };
  }

  update(id: string, _dto: unknown) {
    // TODO: validate, update operation, recalculate results
    return { id, message: 'Not implemented' };
  }

  remove(id: string) {
    // TODO: validate month is not closed, delete operation, trigger recalculation
    return { id, message: 'Not implemented' };
  }
}
