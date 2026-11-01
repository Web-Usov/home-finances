import { Injectable } from '@nestjs/common';
import type { Envelope, Operation, OperationResult, Prisma } from '@prisma/client';
import {
  formatMoneyMinorRu,
  parseMoneyMinor,
  CreateOperationRequestSchema,
  OperationListQuerySchema,
  UpdateOperationRequestSchema,
  type ApiWarning,
  type MutationResponse,
} from '@family-budget/types';
import { z } from 'zod';
import { ConflictException, NotFoundException, ValidationException } from '../../common/exceptions';
import type { ExpectedVersion } from '../../common/if-match';
import { lockMonthForMutation, lockWorkingMonth } from '../../common/month-lock';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import type { MonthSummaryDto } from '../months/months.service';

export type CreateOperationRequest = z.infer<typeof CreateOperationRequestSchema>;
export type UpdateOperationRequest = z.infer<typeof UpdateOperationRequestSchema>;
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

export interface OperationDeleteData {
  summary: MonthSummaryDto;
}

/**
 * Operations service — expenses, transfers, adjustments.
 * Rules: OP-01..OP-04 (types), OP-05/OP-09/OP-14 (formulas, in the engine), OP-07 (transfer
 * limit), OP-16..OP-18 (sequence_no), HIST-07..HIST-10 (closed month is read-only), API-15/API-16.
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
   * (covered / uncovered parts). Filters: period, envelope (either side of a transfer,
   * or the source only with `role=source`, HIST-15), type, `uncoveredOnly` (result.uncovered > 0, HIST-15).
   */
  async list(query: OperationListQuery): Promise<{ operations: OperationHistoryItem[] }> {
    const operations = await this.prisma.operation.findMany({
      where: {
        ...(query.period !== undefined ? { month: { period: query.period } } : {}),
        ...(query.type !== undefined ? { type: query.type } : {}),
        ...(query.uncoveredOnly === true ? { result: { is: { uncoveredMinor: { gt: 0 } } } } : {}),
        ...(query.envelopeId !== undefined && query.role === 'source'
          ? { sourceEnvelopeId: query.envelopeId }
          : {}),
        ...(query.envelopeId !== undefined && query.role !== 'source'
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
   * Create an operation in `dto.period` (API-21) or, without it, in the working month (MON-16:
   * open → reopened → draft).
   * Check order: month exists → version → month status → envelopes → business rules.
   */
  async create(
    dto: CreateOperationRequest,
    expectedVersion: ExpectedVersion,
  ): Promise<MutationResponse<OperationMutationData>> {
    const requestedMinor = parseMoneyMinor(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      // DATA-12 / MON-03: the target month is locked FOR UPDATE; version and status are checked under it.
      // API-21: an explicit period locks that month and all later ones (ascending); otherwise MON-16.
      const candidate =
        dto.period !== undefined
          ? await lockMonthForMutation(tx, { period: dto.period }, { expectedVersion })
          : await lockWorkingMonth(tx, { expectedVersion });
      if (candidate === null) {
        throw new NotFoundException(
          'MONTH_NOT_FOUND',
          'Нет бюджетного месяца для операции. Сначала создайте месяц.',
        );
      }

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

  /**
   * HIST-07 / HIST-08 / API-11: edit amount, envelopes or comment. `sequence_no` never changes
   * (OP-17), so the cascade replays the month in the original order. Check order: operation →
   * version → month status → business rules.
   */
  async update(
    id: string,
    dto: UpdateOperationRequest,
    expectedVersion: ExpectedVersion,
  ): Promise<MutationResponse<OperationMutationData>> {
    return this.prisma.$transaction(async (tx) => {
      const { operation: current, period } = await this.lockOperationMonth(tx, id, expectedVersion);

      if (current.type !== 'transfer' && dto.destinationEnvelopeId !== undefined) {
        throw new ValidationException(
          'VALIDATION_ERROR',
          'Конечный конверт указывается только для перевода.',
        );
      }

      const sourceEnvelopeId = dto.sourceEnvelopeId ?? current.sourceEnvelopeId;
      const destinationEnvelopeId =
        current.type === 'transfer'
          ? (dto.destinationEnvelopeId ?? current.destinationEnvelopeId)
          : null;
      // OP-02 / DATA-09: the transfer keeps two different envelopes after the edit.
      if (current.type === 'transfer' && destinationEnvelopeId === sourceEnvelopeId) {
        throw new ValidationException(
          'VALIDATION_ERROR',
          'Конверты перевода должны различаться.',
        );
      }
      // DATA-11: only envelopes that are being changed are re-validated.
      if (sourceEnvelopeId !== current.sourceEnvelopeId) {
        await this.findEnvelope(tx, sourceEnvelopeId, period);
      }
      if (destinationEnvelopeId !== null && destinationEnvelopeId !== current.destinationEnvelopeId) {
        await this.findEnvelope(tx, destinationEnvelopeId, period);
      }

      const requestedMinor =
        dto.amount !== undefined ? parseMoneyMinor(dto.amount) : current.requestedMinor;
      const operation = await tx.operation.update({
        where: { id },
        data: {
          requestedMinor,
          sourceEnvelopeId,
          destinationEnvelopeId,
          ...(dto.comment !== undefined ? { comment: dto.comment === '' ? null : dto.comment } : {}),
        },
      });

      const recalc = await this.engine.recalculateMonthAtomically(operation.monthId, tx);
      const result = await this.findFreshResult(tx, operation.id);

      // OP-07 / HIST-09: a manual transfer edit never leaves the transfer itself uncovered. The
      // balance the transfer meets at its own position is known only after the replay, so the
      // check runs on the fresh result and the throw rolls the whole edit back. Later operations
      // that lose cover because of the edit stay uncovered (OP-08), they are not rejected.
      const moneyChanged =
        requestedMinor !== current.requestedMinor || sourceEnvelopeId !== current.sourceEnvelopeId;
      if (operation.type === 'transfer' && moneyChanged && result.uncoveredMinor > 0) {
        this.assertTransferCovered(requestedMinor, result.sourceBalanceBefore);
      }

      const summary = await this.buildSummary(tx, operation.monthId);
      return {
        data: { operation, result, summary },
        warnings: [...recalc.warnings, ...this.uncoveredWarnings(result, operation)],
      };
    });
  }

  /**
   * HIST-07 / OP-18 / API-11: delete an operation. The `sequence_no` gap stays; the month and all
   * later months are recalculated in the same transaction (the result row goes with the operation).
   */
  async remove(id: string, expectedVersion: ExpectedVersion): Promise<MutationResponse<OperationDeleteData>> {
    return this.prisma.$transaction(async (tx) => {
      const { operation } = await this.lockOperationMonth(tx, id, expectedVersion);

      await tx.operation.delete({ where: { id } });

      const recalc = await this.engine.recalculateMonthAtomically(operation.monthId, tx);
      const summary = await this.buildSummary(tx, operation.monthId);
      return { data: { summary }, warnings: recalc.warnings };
    });
  }

  /**
   * Shared head of update/remove: find the operation, lock ITS month FOR UPDATE, check version and
   * status inside the transaction, then re-read the operation under the lock. The initial balance
   * (OP-10) is managed together with its envelope, never through this API.
   */
  private async lockOperationMonth(
    db: DbClient,
    id: string,
    expectedVersion: ExpectedVersion,
  ): Promise<{ operation: Operation; period: string }> {
    const notFound = () => new NotFoundException('OPERATION_NOT_FOUND', `Операция не найдена: ${id}`);
    const found = await db.operation.findUnique({
      where: { id },
      select: { monthId: true, month: { select: { period: true } } },
    });
    if (found === null) {
      throw notFound();
    }
    await lockMonthForMutation(db, { id: found.monthId }, { expectedVersion });

    // re-read under the lock: a concurrent delete of the same operation has committed by now
    const operation = await db.operation.findUnique({ where: { id } });
    if (operation === null) {
      throw notFound();
    }
    if (operation.isInitial || operation.type === 'initial_balance') {
      throw new ValidationException(
        'VALIDATION_ERROR',
        'Стартовый остаток нельзя изменить или удалить как обычную операцию.',
      );
    }
    return { operation, period: found.month.period };
  }

  /** OP-07 / AC-07: offer the available amount instead of saving an uncovered transfer. */
  private assertTransferCovered(requestedMinor: number, availableMinor: number): void {
    if (requestedMinor > availableMinor) {
      const available = formatMoneyMinorRu(availableMinor);
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
    const uncovered = formatMoneyMinorRu(result.uncoveredMinor);
    if (operation.type === 'expense') {
      return [
        {
          code: 'EXPENSE_EXCEEDS_BALANCE',
          message: `В конверте доступно ${formatMoneyMinorRu(result.sourceBalanceBefore)} ₽. ${uncovered} ₽ будут отмечены как непокрытые.`,
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
