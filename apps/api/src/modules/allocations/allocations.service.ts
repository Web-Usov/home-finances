import { Injectable } from '@nestjs/common';
import type { Allocation, Prisma } from '@prisma/client';
import {
  SaveAllocationsRequestSchema,
  formatMoneyMinor,
  parseMoneyMinor,
  validateAllocations,
  type EnvelopeSnapshot,
  type MonthSummary,
  type MutationResponse,
} from '@family-budget/types';
import { z } from 'zod';
import { NotFoundException, ValidationException } from '../../common/exceptions';
import { lockMonthForMutation, type LockedMonth } from '../../common/month-lock';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';

export type SaveAllocationsRequest = z.infer<typeof SaveAllocationsRequestSchema>;

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

/** Sum of all per-type uncovered parts stored as JSON on a snapshot row. */
function sumUncoveredByType(uncoveredByType: Prisma.JsonValue): number {
  if (
    uncoveredByType === null ||
    typeof uncoveredByType !== 'object' ||
    Array.isArray(uncoveredByType)
  ) {
    return 0;
  }
  let total = 0;
  for (const value of Object.values(uncoveredByType)) {
    if (typeof value === 'number') {
      total += value;
    }
  }
  return total;
}

/**
 * Allocations service — saves the full monthly distribution table.
 * Implemented per UI-11..UI-15 (allocation editor) and
 * FIN-11, FIN-12 (income, distribution and free funds).
 *
 * Notes:
 * - All monetary values are integer kopecks; API strings are converted exactly
 *   once at the boundary via parseMoneyMinor (never float).
 * - Check order is lock month → version → status → Σ ≤ income → envelopes, all inside the
 *   transaction under `lockMonthForMutation` (DATA-12): a stale tab reports VERSION_CONFLICT even when the month closed meanwhile.
 * - Archived envelopes are rejected (ENV-12): they are excluded from new
 *   allocations, so for the write path an archived id is as unavailable as an
 *   unknown one → ENVELOPE_NOT_FOUND with a message naming the archive reason.
 * - Source mutation + cascade recalculation commit in ONE $transaction
 *   (CALC-13) via recalculateMonthAtomically(monthId, tx).
 */
@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CalculationEngineService,
  ) {}

  /**
   * Replace the whole allocation table of a month and recalculate.
   * Returns the updated month summary plus cascade warnings.
   */
  async save(
    period: string,
    dto: SaveAllocationsRequest,
  ): Promise<MutationResponse<MonthSummary>> {
    const { summary, warnings } = await this.prisma.$transaction(async (tx) => {
      // DATA-12 / MON-03: existence → version → status, checked under FOR UPDATE inside the
      // transaction, so a concurrent writer cannot slip between the check and the write.
      const month = await lockMonthForMutation(
        tx,
        { period },
        { expectedVersion: dto.version },
      );

      const amountByEnvelopeId = new Map<string, number>();
      for (const [envelopeId, amount] of Object.entries(dto.allocations)) {
        amountByEnvelopeId.set(envelopeId, parseMoneyMinor(amount));
      }

      const { valid, excessMinor } = validateAllocations(
        month.incomeMinor,
        Object.fromEntries(amountByEnvelopeId),
      );
      if (!valid) {
        throw new ValidationException(
          'ALLOCATION_EXCEEDS_INCOME',
          `Распределено на ${formatMoneyMinor(excessMinor)} ₽ больше дохода. Уменьшите суммы по конвертам.`,
        );
      }

      if (amountByEnvelopeId.size > 0) {
        await this.assertEnvelopesAvailable(tx, amountByEnvelopeId);
      }

      await tx.allocation.deleteMany({ where: { monthId: month.id } });
      if (amountByEnvelopeId.size > 0) {
        await tx.allocation.createMany({
          data: [...amountByEnvelopeId].map(([envelopeId, amountMinor]) => ({
            monthId: month.id,
            envelopeId,
            amountMinor,
          })),
        });
      }
      const result = await this.engine.recalculateMonthAtomically(month.id, tx);
      return {
        summary: await this.buildSummary(tx, month, amountByEnvelopeId),
        warnings: result.warnings,
      };
    });

    return { data: summary, warnings };
  }

  /**
   * Current allocation rows of a month — the read path for GET consumers
   * (allocation editor, reporting).
   */
  async getAllocations(period: string): Promise<{ allocations: Allocation[] }> {
    const month = await this.prisma.budgetMonth.findUnique({ where: { period } });
    if (month === null) {
      throw new NotFoundException('MONTH_NOT_FOUND', `Месяц не найден: ${period}`);
    }
    const allocations = await this.prisma.allocation.findMany({ where: { monthId: month.id } });
    return { allocations };
  }

  /** Every id must belong to an existing, non-archived envelope (ENV-12). */
  private async assertEnvelopesAvailable(
    db: DbClient,
    amountByEnvelopeId: Map<string, number>,
  ): Promise<void> {
    const envelopeIds = [...amountByEnvelopeId.keys()];
    const envelopes = await db.envelope.findMany({ where: { id: { in: envelopeIds } } });
    const byId = new Map(envelopes.map((envelope) => [envelope.id, envelope]));

    for (const envelopeId of envelopeIds) {
      const envelope = byId.get(envelopeId);
      if (envelope === undefined) {
        throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${envelopeId}`);
      }
      if (envelope.status === 'archived') {
        throw new NotFoundException(
          'ENVELOPE_NOT_FOUND',
          `Конверт «${envelope.name}» архивирован и исключён из новых распределений.`,
        );
      }
    }
  }

  /** Month summary from the just-recalculated snapshots plus the saved totals. */
  private async buildSummary(
    db: DbClient,
    month: LockedMonth,
    amountByEnvelopeId: Map<string, number>,
  ): Promise<MonthSummary> {
    const snapshots = await db.envelopeMonthSnapshot.findMany({
      where: { monthId: month.id },
      include: { envelope: { select: { name: true } } },
    });

    const envelopes: EnvelopeSnapshot[] = snapshots.map((snapshot) => ({
      envelopeId: snapshot.envelopeId,
      envelopeName: snapshot.envelope.name,
      opening: snapshot.opening,
      allocation: snapshot.allocation,
      expensesRequested: snapshot.expensesRequested,
      expensesCovered: snapshot.expensesCovered,
      adjustmentApplied: snapshot.adjustmentApplied,
      transfersIn: snapshot.transfersIn,
      transfersOut: snapshot.transfersOut,
      closing: snapshot.closing,
      uncovered: sumUncoveredByType(snapshot.uncoveredByType),
    }));

    let totalAllocatedMinor = 0;
    for (const amountMinor of amountByEnvelopeId.values()) {
      totalAllocatedMinor += amountMinor;
    }

    return {
      period: month.period,
      status: month.status,
      incomeMinor: month.incomeMinor,
      totalAllocatedMinor,
      freeFundsMinor: month.incomeMinor - totalAllocatedMinor,
      totalExpensesRequestedMinor: envelopes.reduce((sum, e) => sum + e.expensesRequested, 0),
      totalExpensesCoveredMinor: envelopes.reduce((sum, e) => sum + e.expensesCovered, 0),
      totalAdjustmentsAppliedMinor: envelopes.reduce((sum, e) => sum + e.adjustmentApplied, 0),
      totalUncoveredMinor: envelopes.reduce((sum, e) => sum + e.uncovered, 0),
      envelopes,
    };
  }
}
