import { Injectable } from '@nestjs/common';
import type { BudgetMonth, Envelope, Operation, OperationResult, Prisma } from '@prisma/client';
import {
  formatMoneyMinor,
  parseMoneyMinor,
  CreateOperationRequestSchema,
  OperationListQuerySchema,
  type ApiWarning,
  type MutationResponse,
} from '@family-budget/types';
import { z } from 'zod';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import type { MonthSummaryDto } from '../months/months.service';

export type CreateOperationRequest = z.infer<typeof CreateOperationRequestSchema>;
export type OperationListQuery = z.infer<typeof OperationListQuerySchema>;

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

type OperationWithRelations = Prisma.OperationGetPayload<{
  include: { result: true; month: { select: { period: true } } };
}>;

export interface OperationHistoryItem extends Omit<OperationWithRelations, 'month'> {
  period: string;
}

export interface OperationMutationData {
  operation: Operation;
  result: OperationResult;
  /** Same shape as the months API summary (MonthSummaryDto). */
  summary: MonthSummaryDto;
}

/**
 * Operations service — expenses, transfers, adjustments.
 * Rules: OP-01..OP-04 (types), OP-05/OP-09/OP-14 (formulas, in the engine), OP-07 (transfer
 * limit), OP-16/OP-17 (sequence_no), HIST-10 (closed month is read-only), API-15/API-16.
 *
 * - Money is integer kopecks; API strings are converted once via parseMoneyMinor (API-14).
 * - The month is read, locked FOR UPDATE and version-checked INSIDE the transaction, so
 *   concurrent mutations of the same month serialise (sequence_no, transfer limit, ADR 0005).
 * - Source write and cascade recalculation commit in one transaction (API-15, ADR 0004).
 */
@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CalculationEngineService,
  ) {}

  /**
   * HIST-11: operation history, chronological (period, then sequence_no), each with its result
   * (covered / uncovered parts). Filters: period, envelope (either side of a transfer), type.
   */
  async list(query: OperationListQuery): Promise<{ operations: OperationHistoryItem[] }> {
    const operations = await this.prisma.operation.findMany({
      where: {
        ...(query.period !== undefined ? { month: { period: query.period } } : {}),
        ...(query.type !== undefined ? { type: query.type } : {}),
        ...(query.envelopeId !== undefined
          ? {
              OR: [
                { sourceEnvelopeId: query.envelopeId },
                { destinationEnvelopeId: query.envelopeId },
              ],
            }
          : {}),
      },
      include: { result: true, month: { select: { period: true } } },
      orderBy: [{ month: { period: 'asc' } }, { sequenceNo: 'asc' }],
    });

    return {
      operations: operations.map(({ month, ...operation }) => ({
        ...operation,
        period: month.period,
      })),
    };
  }

  /**
   * Create an operation in the current working month (open → reopened → draft).
   * Check order: month exists → version → month status → envelopes → business rules.
   */
  async create(dto: CreateOperationRequest): Promise<MutationResponse<OperationMutationData>> {
    const requestedMinor = parseMoneyMinor(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const candidate = await this.findCurrentMonth(tx);
      if (candidate === null) {
        throw new NotFoundException(
          'MONTH_NOT_FOUND',
          'Нет бюджетного месяца для операции. Сначала создайте месяц.',
        );
      }
      const locked = await this.lockMonth(tx, candidate.id);
      this.assertVersion(locked, candidate.period, dto.version);
      this.assertMonthMutable(locked, candidate.period);

      const source = await this.findEnvelope(tx, dto.sourceEnvelopeId, candidate.period);
      let destination: Envelope | null = null;
      if (dto.type === 'transfer' && dto.destinationEnvelopeId !== undefined) {
        destination = await this.findEnvelope(tx, dto.destinationEnvelopeId, candidate.period);
      }

      // OP-07: a manually created transfer never exceeds the available balance.
      if (dto.type === 'transfer') {
        const availableMinor = await this.findMonthClosing(tx, candidate.id, source.id);
        this.assertTransferCovered(requestedMinor, availableMinor);
      }

      // OP-16 / OP-17: a new operation goes to the end of the month's sequence.
      const sequenceNo = await this.nextSequenceNo(tx, candidate.id);
      const operation = await tx.operation.create({
        data: {
          monthId: candidate.id,
          sequenceNo,
          type: dto.type,
          sourceEnvelopeId: source.id,
          destinationEnvelopeId: destination?.id ?? null,
          requestedMinor,
          sign: dto.type === 'adjustment' ? (dto.sign ?? null) : null,
          isInitial: false,
          comment: dto.comment ?? null,
        },
      });

      const recalc = await this.engine.recalculateMonthAtomically(candidate.id, tx);
      const result = await this.findFreshResult(tx, operation.id);
      const summary = await this.buildSummary(tx, candidate.id);

      return {
        data: { operation, result, summary },
        warnings: [...recalc.warnings, ...this.uncoveredWarnings(result, operation)],
      };
    });
  }

  // update/remove: T-005.

  /** DATA-12 / ADR 0005: stale `version` → VERSION_CONFLICT. */
  private assertVersion(locked: { version: number }, period: string, expected: number): void {
    if (locked.version !== expected) {
      throw new ConflictException(
        'VERSION_CONFLICT',
        `Данные месяца ${period} изменились. Обновите данные и повторите.`,
      );
    }
  }

  /** HIST-10 / MON-03: closed months are read-only. */
  private assertMonthMutable(locked: { status: string }, period: string): void {
    if (locked.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        `Месяц ${period} закрыт. Откройте его повторно, чтобы внести изменения.`,
      );
    }
  }

  /** OP-07 / AC-07: offer the available amount instead of saving an uncovered transfer. */
  private assertTransferCovered(requestedMinor: number, availableMinor: number): void {
    if (requestedMinor > availableMinor) {
      const available = formatMoneyMinor(availableMinor);
      throw new ConflictException(
        'TRANSFER_EXCEEDS_BALANCE',
        `Доступно ${available} ₽. Перевести только ${available} ₽?`,
      );
    }
  }

  /**
   * Uncovered-part notices (OP-06, OP-12). Transfers are excluded: a manually saved transfer is
   * always covered (OP-07).
   */
  private uncoveredWarnings(result: OperationResult, operation: Operation): ApiWarning[] {
    if (result.uncoveredMinor <= 0) {
      return [];
    }
    const uncovered = formatMoneyMinor(result.uncoveredMinor);
    if (operation.type === 'expense') {
      return [
        {
          code: 'EXPENSE_EXCEEDS_BALANCE',
          message: `В конверте доступно ${formatMoneyMinor(result.sourceBalanceBefore)} ₽. ${uncovered} ₽ будут отмечены как непокрытые.`,
        },
      ];
    }
    if (operation.type === 'adjustment' && operation.sign === '-') {
      return [
        {
          code: 'ADJUSTMENT_EXCEEDS_BALANCE',
          message: `Баланс станет 0 ₽, ${uncovered} ₽ будут отмечены как непокрытые.`,
        },
      ];
    }
    return [];
  }

  /**
   * Current working month (MON-01, MON-02, MON-04): prefer 'open', then 'reopened', then 'draft'.
   * With no mutable month it falls back to the latest month so a closed-month mutation is
   * rejected with MONTH_LOCKED (HIST-10); null only when no month exists at all.
   */
  private async findCurrentMonth(db: DbClient): Promise<BudgetMonth | null> {
    const mutableMonths = await db.budgetMonth.findMany({
      where: { status: { in: ['open', 'reopened', 'draft'] } },
      orderBy: { period: 'desc' },
    });

    return (
      mutableMonths.find((m) => m.status === 'open') ??
      mutableMonths.find((m) => m.status === 'reopened') ??
      mutableMonths.find((m) => m.status === 'draft') ??
      db.budgetMonth.findFirst({ orderBy: { period: 'desc' } })
    );
  }

  /** DATA-11: the envelope must exist (404) and not be archived at or before the month (409). */
  private async findEnvelope(db: DbClient, id: string, period: string): Promise<Envelope> {
    const envelope = await db.envelope.findUnique({ where: { id } });
    if (envelope === null) {
      throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${id}`);
    }
    if (
      envelope.status === 'archived' &&
      envelope.archivedPeriod !== null &&
      envelope.archivedPeriod <= period
    ) {
      throw new ConflictException(
        'INVALID_STATUS_TRANSITION',
        `Конверт «${envelope.name}» архивирован (месяц архивирования: ${envelope.archivedPeriod}). Операции по архивному конверту недоступны.`,
      );
    }
    return envelope;
  }

  /**
   * Lock the month row FOR UPDATE and return its fresh status/version: concurrent mutations of
   * the same month serialise, so the version check, sequence_no and the transfer balance check
   * are race-safe.
   */
  private async lockMonth(
    db: DbClient,
    monthId: string,
  ): Promise<{ status: string; version: number }> {
    const rows = await db.$queryRaw<Array<{ status: string; version: number }>>`
      SELECT status, version FROM budget_month WHERE id = ${monthId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException('MONTH_NOT_FOUND', `Месяц не найден: ${monthId}`);
    }
    return row;
  }

  /** OP-17: sequence_no = max + 1 within the month, computed inside the locked transaction. */
  private async nextSequenceNo(db: DbClient, monthId: string): Promise<number> {
    const aggregate = await db.operation.aggregate({
      where: { monthId },
      _max: { sequenceNo: true },
    });
    return (aggregate._max.sequenceNo ?? 0) + 1;
  }

  /** Closing balance of an envelope in a given month (0 when it has no snapshot). */
  private async findMonthClosing(
    db: DbClient,
    monthId: string,
    envelopeId: string,
  ): Promise<number> {
    const snapshot = await db.envelopeMonthSnapshot.findUnique({
      where: { monthId_envelopeId: { monthId, envelopeId } },
      select: { closing: true },
    });
    return snapshot?.closing ?? 0;
  }

  /** The engine replays every operation of the month in this transaction, so a result exists. */
  private async findFreshResult(db: DbClient, operationId: string): Promise<OperationResult> {
    const result = await db.operationResult.findUnique({ where: { operationId } });
    if (result === null) {
      throw new Error(`engine produced no result for operation ${operationId}`);
    }
    return result;
  }

  /** Month summary re-read after the recalculation (the engine bumped `version`). */
  private async buildSummary(db: DbClient, monthId: string): Promise<MonthSummaryDto> {
    const month = await db.budgetMonth.findUnique({ where: { id: monthId } });
    if (month === null) {
      throw new Error(`Budget month disappeared during recalculation: ${monthId}`);
    }
    const aggregate = await db.allocation.aggregate({
      where: { monthId },
      _sum: { amountMinor: true },
    });
    const totalAllocatedMinor = aggregate._sum.amountMinor ?? 0;
    return {
      id: month.id,
      period: month.period,
      status: month.status,
      incomeMinor: month.incomeMinor,
      version: month.version,
      totalAllocatedMinor,
      freeFundsMinor: month.incomeMinor - totalAllocatedMinor,
    };
  }
}
