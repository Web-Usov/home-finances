import { Injectable } from '@nestjs/common';
import type { Allocation, BudgetMonth, Envelope, Operation, Prisma } from '@prisma/client';
import { formatMoneyMinor, type ApiWarning, type OperationType } from '@family-budget/types';
import { NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

/**
 * Result of applying a single operation to envelope balance(s).
 * All values are integer kopecks.
 */
export interface ApplyOperationResult {
  sourceBalanceAfter: number;
  destinationBalanceAfter?: number;
  covered: number;
  uncovered: number;
}

/**
 * Result of a cascade recalculation started from a given period.
 */
export interface RecalculateFromResult {
  recalculatedFrom: string;
  warnings: ApiWarning[];
}

/** Per-envelope running totals while replaying a single month. */
interface MonthEnvelopeAccum {
  opening: number;
  initial: number;
  allocation: number;
  expensesRequested: number;
  expensesCovered: number;
  adjustmentApplied: number;
  transfersIn: number;
  transfersOut: number;
  uncoveredExpense: number;
  uncoveredTransfer: number;
  uncoveredAdjustment: number;
  touchedByOperation: boolean;
}

function emptyAccum(): MonthEnvelopeAccum {
  return {
    opening: 0,
    initial: 0,
    allocation: 0,
    expensesRequested: 0,
    expensesCovered: 0,
    adjustmentApplied: 0,
    transfersIn: 0,
    transfersOut: 0,
    uncoveredExpense: 0,
    uncoveredTransfer: 0,
    uncoveredAdjustment: 0,
    touchedByOperation: false,
  };
}

/**
 * Calculation Engine — deterministic cascade recalculation of balances.
 * Implemented per CALC-01..CALC-13.
 *
 * Key invariants:
 * - Envelope balance never negative
 * - Allocation does not exceed income
 * - Free funds do not accumulate
 * - Closing balance becomes opening balance of next month
 * - Operation order is stable (by sequence_no)
 */
@Injectable()
export class CalculationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate all derived data (OperationResult, EnvelopeMonthSnapshot) for
   * every month from `period` forward, atomically (CALC-02..CALC-07, CALC-13).
   *
   * `period` is the earliest affected month, determined by the caller. The
   * whole affected month is replayed from its restored opening balances:
   * derived data must be reproducible from source data (CALC-01), and a full
   * deterministic replay is what guarantees it — the "first affected position"
   * only matters for locating that earliest month, which the caller did.
   *
   * Pass an existing transaction client as `db` when the source-data mutation
   * and the recalculation must commit atomically (CALC-13); otherwise the
   * engine wraps the whole cascade in its own transaction.
   *
   * Source data (Operation, Allocation) is never modified — only derived rows
   * are deleted and rebuilt (DATA-13).
   */
  async recalculateFrom(period: string, db?: DbClient): Promise<RecalculateFromResult> {
    if (db !== undefined) {
      return this.recalculateWithin(period, db);
    }
    return this.prisma.$transaction((tx) => this.recalculateWithin(period, tx));
  }

  /**
   * Resolve a BudgetMonth by id, then atomically recalculate all derived data
   * from that month's period forward and increment `version` by 1 on every
   * affected BudgetMonth (CALC-06, CALC-13, NFR-16..NFR-19).
   *
   * The entire cascade — delete + recreate of OperationResult and
   * EnvelopeMonthSnapshot for all affected months, and the version increment —
   * runs inside a single Prisma `$transaction`. On any error the transaction
   * rolls back: no partial derived data, no version change.
   *
   * Callers that must commit their own source-data mutation and the cascade in
   * ONE transaction pass their interactive tx client as `db` (CALC-13);
   * without it the method wraps everything in its own `$transaction`.
   *
   * @throws NotFoundException when no BudgetMonth exists for `monthId`.
   */
  async recalculateMonthAtomically(
    monthId: string,
    db?: Prisma.TransactionClient,
  ): Promise<RecalculateFromResult> {
    const run = async (tx: DbClient): Promise<RecalculateFromResult> => {
      const month = await tx.budgetMonth.findUnique({ where: { id: monthId } });
      if (month === null) {
        throw new NotFoundException(
          'MONTH_NOT_FOUND',
          `Budget month not found: ${monthId}`,
        );
      }

      const result = await this.recalculateFrom(month.period, tx);
      await tx.budgetMonth.updateMany({
        where: { period: { gte: month.period } },
        data: { version: { increment: 1 } },
      });
      return result;
    };

    if (db !== undefined) {
      return run(db);
    }
    return this.prisma.$transaction(run);
  }

  private async recalculateWithin(period: string, db: DbClient): Promise<RecalculateFromResult> {
    // Step 13 (partially caller-side): the earliest affected month must exist.
    const startMonth = await db.budgetMonth.findUnique({ where: { period } });
    if (startMonth === null) {
      throw new Error(`Budget month not found: ${period}`);
    }

    const affectedMonths = await db.budgetMonth.findMany({
      where: { period: { gte: period } },
      orderBy: { period: 'asc' },
    });

    // Step 14: opening balances come from the snapshots of the latest month
    // before the earliest affected one — the last unchanged snapshot.
    const previousMonth = await db.budgetMonth.findFirst({
      where: { period: { lt: period } },
      orderBy: { period: 'desc' },
    });
    const opening = new Map<string, number>();
    if (previousMonth !== null) {
      const snapshots = await db.envelopeMonthSnapshot.findMany({
        where: { monthId: previousMonth.id },
      });
      for (const snapshot of snapshots) {
        opening.set(snapshot.envelopeId, snapshot.closing);
      }
    }

    const [allocations, operations, envelopes] = await Promise.all([
      db.allocation.findMany({ where: { month: { period: { gte: period } } } }),
      db.operation.findMany({
        where: { month: { period: { gte: period } } },
        orderBy: { sequenceNo: 'asc' },
      }),
      db.envelope.findMany(),
    ]);

    const allocationsByMonth = groupBy(allocations, (a) => a.monthId);
    const operationsByMonth = groupBy(operations, (o) => o.monthId);
    const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

    const warnings: ApiWarning[] = [];
    const warnedEnvelopes = new Set<string>();

    let carriedOpening = opening;
    for (const month of affectedMonths) {
      carriedOpening = await this.replayMonth({
        db,
        month,
        opening: carriedOpening,
        allocations: allocationsByMonth.get(month.id) ?? [],
        operations: operationsByMonth.get(month.id) ?? [],
        envelopeById,
        warnings,
        warnedEnvelopes,
      });
    }

    return { recalculatedFrom: period, warnings };
  }

  /**
   * Replay one month: restore opening balances, apply initial balances, then
   * the allocation, then operations by sequence_no (FIN-13, FIN-14, OP-15,
   * CALC-04). Recreates all derived rows for the month and returns the per-envelope
   * closing balances that become the next month's opening (FIN-13).
   */
  private async replayMonth(args: {
    db: DbClient;
    month: BudgetMonth;
    opening: Map<string, number>;
    allocations: Allocation[];
    operations: Operation[];
    envelopeById: Map<string, Envelope>;
    warnings: ApiWarning[];
    warnedEnvelopes: Set<string>;
  }): Promise<Map<string, number>> {
    const { db, month, opening, allocations, operations, envelopeById, warnings } = args;

    const accums = new Map<string, MonthEnvelopeAccum>();
    const balances = new Map<string, number>();
    const accumFor = (envelopeId: string): MonthEnvelopeAccum => {
      let accum = accums.get(envelopeId);
      if (accum === undefined) {
        accum = emptyAccum();
        accums.set(envelopeId, accum);
      }
      return accum;
    };

    for (const [envelopeId, closing] of opening) {
      balances.set(envelopeId, closing);
      accumFor(envelopeId).opening = closing;
    }

    const resultRows: Prisma.OperationResultCreateManyInput[] = [];

    // Initial balances apply before the allocation and all user operations,
    // only in the envelope's creation month (FIN-14, OP-10).
    const initialOps = operations.filter((op) => op.type === 'initial_balance');
    const userOps = operations.filter((op) => op.type !== 'initial_balance');

    for (const op of initialOps) {
      const before = balances.get(op.sourceEnvelopeId) ?? 0;
      const applied = this.applyOperation(before, undefined, op.requestedMinor, 'initial_balance');
      balances.set(op.sourceEnvelopeId, applied.sourceBalanceAfter);
      const accum = accumFor(op.sourceEnvelopeId);
      accum.initial += op.requestedMinor;
      accum.touchedByOperation = true;
      resultRows.push(toResultRow(op, before, applied));
    }

    // The monthly allocation always applies before expenses, transfers and
    // adjustments (FIN-14, OP-15).
    for (const allocation of allocations) {
      balances.set(
        allocation.envelopeId,
        (balances.get(allocation.envelopeId) ?? 0) + allocation.amountMinor,
      );
      accumFor(allocation.envelopeId).allocation += allocation.amountMinor;
    }

    for (const op of userOps) {
      const sourceBefore = balances.get(op.sourceEnvelopeId) ?? 0;
      const sourceAccum = accumFor(op.sourceEnvelopeId);
      sourceAccum.touchedByOperation = true;

      if (op.type === 'transfer') {
        if (op.destinationEnvelopeId === null) {
          throw new Error(`transfer operation ${op.id} has no destination envelope`);
        }
        const destinationBefore = balances.get(op.destinationEnvelopeId) ?? 0;
        const applied = this.applyOperation(
          sourceBefore,
          destinationBefore,
          op.requestedMinor,
          'transfer',
        );
        balances.set(op.sourceEnvelopeId, applied.sourceBalanceAfter);
        balances.set(op.destinationEnvelopeId, applied.destinationBalanceAfter ?? 0);
        // transfersOut is the covered part (what actually left the source);
        // transfersIn is the full requested amount (what the destination
        // actually received, OP-09). The gap lives in
        // uncoveredByType.transfer.
        sourceAccum.transfersOut += applied.covered;
        sourceAccum.uncoveredTransfer += applied.uncovered;
        const destinationAccum = accumFor(op.destinationEnvelopeId);
        destinationAccum.transfersIn += op.requestedMinor;
        destinationAccum.touchedByOperation = true;
        resultRows.push(toResultRow(op, sourceBefore, applied, destinationBefore));
        continue;
      }

      const sign = op.sign as '+' | '-' | null;
      const applied = this.applyOperation(
        sourceBefore,
        undefined,
        op.requestedMinor,
        op.type,
        sign,
      );
      balances.set(op.sourceEnvelopeId, applied.sourceBalanceAfter);

      if (op.type === 'expense') {
        sourceAccum.expensesRequested += op.requestedMinor;
        sourceAccum.expensesCovered += applied.covered;
        sourceAccum.uncoveredExpense += applied.uncovered;
      } else if (op.type === 'adjustment') {
        // Dashboard shows the net actually-applied amount (OP-14).
        sourceAccum.adjustmentApplied += sign === '-' ? -applied.covered : applied.covered;
        sourceAccum.uncoveredAdjustment += applied.uncovered;
      }
      resultRows.push(toResultRow(op, sourceBefore, applied));
    }

    // Derived rows are fully rebuilt from source data (DATA-05, DATA-06, DATA-13).
    await db.operationResult.deleteMany({ where: { operation: { monthId: month.id } } });
    await db.envelopeMonthSnapshot.deleteMany({ where: { monthId: month.id } });
    if (resultRows.length > 0) {
      await db.operationResult.createMany({ data: resultRows });
    }

    const snapshotRows: Prisma.EnvelopeMonthSnapshotCreateManyInput[] = [];
    const closing = new Map<string, number>();
    for (const [envelopeId, accum] of accums) {
      const touched =
        accum.opening !== 0 ||
        accum.initial !== 0 ||
        accum.allocation !== 0 ||
        accum.touchedByOperation;
      if (!touched) {
        continue;
      }

      const closingBalance = balances.get(envelopeId) ?? 0;
      closing.set(envelopeId, closingBalance);

      const uncoveredByType: Record<string, number> = {};
      if (accum.uncoveredExpense !== 0) uncoveredByType.expense = accum.uncoveredExpense;
      if (accum.uncoveredTransfer !== 0) uncoveredByType.transfer = accum.uncoveredTransfer;
      if (accum.uncoveredAdjustment !== 0) {
        uncoveredByType.adjustment = accum.uncoveredAdjustment;
      }

      snapshotRows.push({
        monthId: month.id,
        envelopeId,
        opening: accum.opening,
        initial: accum.initial,
        allocation: accum.allocation,
        expensesRequested: accum.expensesRequested,
        expensesCovered: accum.expensesCovered,
        adjustmentApplied: accum.adjustmentApplied,
        transfersIn: accum.transfersIn,
        transfersOut: accum.transfersOut,
        closing: closingBalance,
        uncoveredByType,
      });

      // Conflict "Архивный конверт с остатком" (CALC-12): an envelope
      // archived at or before this month ends up with a non-zero balance.
      // Reported once per envelope, at the first month the conflict appears.
      const envelope = envelopeById.get(envelopeId);
      if (
        envelope !== undefined &&
        envelope.status === 'archived' &&
        envelope.archivedPeriod !== null &&
        month.period >= envelope.archivedPeriod &&
        closingBalance !== 0 &&
        !args.warnedEnvelopes.has(envelopeId)
      ) {
        args.warnedEnvelopes.add(envelopeId);
        warnings.push({
          code: 'ARCHIVED_ENVELOPE_WITH_BALANCE',
          message:
            `Конверт «${envelope.name}» архивирован, но после пересчёта в месяце ` +
            `${month.period} его остаток равен ${formatMoneyMinor(closingBalance)} ₽. ` +
            'Верните конверт из архива, обнулите его и архивируйте заново.',
        });
      }
    }
    if (snapshotRows.length > 0) {
      await db.envelopeMonthSnapshot.createMany({ data: snapshotRows });
    }

    return closing;
  }

  /**
   * Apply a single operation to envelope balance(s).
   * Per OP-01..OP-14 (operation rules).
   *
   * All inputs/outputs are integer kopecks — never float.
   *
   * @param sourceBalanceBefore   balance of the source envelope before the operation
   * @param destinationBalanceBefore  balance of the destination envelope (transfer only)
   * @param requested             full requested amount (always stored, even if uncovered)
   * @param type                  operation type
   * @param sign                  '+' | '-' for adjustments, null otherwise
   */
  applyOperation(
    sourceBalanceBefore: number,
    destinationBalanceBefore: number | undefined,
    requested: number,
    type: OperationType,
    sign?: '+' | '-' | null,
  ): ApplyOperationResult {
    switch (type) {
      case 'expense': {
        const covered = Math.min(requested, sourceBalanceBefore);
        return {
          sourceBalanceAfter: sourceBalanceBefore - covered,
          covered,
          uncovered: requested - covered,
        };
      }

      // Destination always receives the FULL requested amount, even when the
      // source cannot cover it (retro-recalculation case) — no debt is created.
      case 'transfer': {
        if (destinationBalanceBefore === undefined) {
          throw new Error('transfer requires destinationBalanceBefore');
        }
        const covered = Math.min(requested, sourceBalanceBefore);
        return {
          sourceBalanceAfter: sourceBalanceBefore - covered,
          destinationBalanceAfter: destinationBalanceBefore + requested,
          covered,
          uncovered: requested - covered,
        };
      }

      case 'adjustment': {
        if (sign === '+') {
          return {
            sourceBalanceAfter: sourceBalanceBefore + requested,
            covered: requested,
            uncovered: 0,
          };
        }
        if (sign === '-') {
          const covered = Math.min(requested, sourceBalanceBefore);
          return {
            sourceBalanceAfter: sourceBalanceBefore - covered,
            covered,
            uncovered: requested - covered,
          };
        }
        throw new Error("adjustment requires sign '+' or '-'");
      }

      case 'initial_balance': {
        return {
          sourceBalanceAfter: sourceBalanceBefore + requested,
          covered: requested,
          uncovered: 0,
        };
      }
    }
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = grouped.get(k);
    if (bucket === undefined) {
      grouped.set(k, [item]);
    } else {
      bucket.push(item);
    }
  }
  return grouped;
}

function toResultRow(
  op: Operation,
  sourceBalanceBefore: number,
  applied: ApplyOperationResult,
  destinationBalanceBefore?: number,
): Prisma.OperationResultCreateManyInput {
  return {
    operationId: op.id,
    coveredMinor: applied.covered,
    uncoveredMinor: applied.uncovered,
    sourceBalanceBefore,
    sourceBalanceAfter: applied.sourceBalanceAfter,
    destinationBalanceBefore: destinationBalanceBefore ?? null,
    destinationBalanceAfter: applied.destinationBalanceAfter ?? null,
  };
}
