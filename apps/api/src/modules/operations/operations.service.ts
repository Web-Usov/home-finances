import { BadRequestException, Injectable } from '@nestjs/common';
import type { BudgetMonth, Envelope, Operation, OperationResult, Prisma } from '@prisma/client';
import {
  formatMoneyMinor,
  parseMoneyMinor,
  type ApiWarning,
  type OperationType,
} from '@family-budget/types';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import type {
  CreateOperationRequest,
  OperationListQuery,
  UpdateOperationRequest,
} from './operations.dto';

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

type OperationWithRelations = Prisma.OperationGetPayload<{
  include: { result: true; month: { select: { period: true } } };
}>;

export interface OperationHistoryItem extends Omit<OperationWithRelations, 'month'> {
  period: string;
}

export interface OperationSummary {
  monthId: string;
  period: string;
  /** Fresh month version after the mutation (recalculation increments it by 1). */
  version: number;
  sourceBalanceMinor: number;
  destinationBalanceMinor?: number;
}

export interface OperationMutationResponse {
  operation: Operation;
  result: OperationResult;
  summary: OperationSummary;
  warnings: ApiWarning[];
}

export interface OperationDeleteResponse {
  id: string;
  summary: OperationSummary;
  warnings: ApiWarning[];
}

/**
 * Operations service — expenses, transfers, adjustments, initial balances.
 * Implemented per SPECIFICATION.md § Operations and History (lines 297-328)
 * and § Operation Rules (lines 142-196).
 *
 * Key invariants:
 * - All monetary values are integer kopecks (never float).
 * - A manually saved transfer never exceeds the available balance
 *   (spec line 161); uncovered transfers arise only from retro-recalculation.
 * - sequence_no is assigned inside the mutating transaction under a
 *   FOR UPDATE lock on the month row, so concurrent creations stay unique
 *   (spec line 453); editing never changes it (line 195).
 * - Mutations are forbidden in closed months (line 321) → MONTH_LOCKED.
 * - Every mutation commits its source change and the cascade recalculation
 *   in ONE transaction via recalculateMonthAtomically(monthId, tx) (line 261).
 */
@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CalculationEngineService,
  ) {}

  /**
   * Operation history (spec lines 323-325): by default all operations in
   * chronological order (period, then sequence_no), each with its result
   * (covered/uncovered parts). Filters: period, envelope (either side of a
   * transfer), type.
   */
  async list(query: OperationListQuery): Promise<{ operations: OperationHistoryItem[] }> {
    const operations = await this.prisma.operation.findMany({
      where: {
        ...(query.period !== undefined ? { month: { period: query.period } } : {}),
        ...(query.type !== undefined ? { type: query.type } : {}),
        ...(query.envelopeId !== undefined
          ? { OR: [{ sourceEnvelopeId: query.envelopeId }, { destinationEnvelopeId: query.envelopeId }] }
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
   * Create an operation in the current working month (open → reopened →
   * draft). The operation row and the engine's full recalculation commit
   * atomically; the response carries the fresh result, the new month summary
   * (including the incremented version for the next optimistic-lock check)
   * and warnings — including the uncovered-part notices of spec lines
   * 369/371.
   */
  async create(dto: CreateOperationRequest): Promise<OperationMutationResponse> {
    this.assertStructuralRules(dto.type, dto.sourceEnvelopeId, dto.destinationEnvelopeId ?? null, dto.sign);

    const requestedMinor = parseMoneyMinor(dto.amount);
    const month = await this.findCurrentMonth();
    if (month === null) {
      throw new NotFoundException(
        'MONTH_NOT_FOUND',
        'Нет бюджетного месяца для операции. Сначала создайте месяц.',
      );
    }
    this.assertMonthMutable(month);

    const source = await this.findEnvelope(dto.sourceEnvelopeId, month.period);
    let destination: Envelope | null = null;
    if (dto.type === 'transfer') {
      // Non-null is guaranteed by assertStructuralRules above.
      destination = await this.findEnvelope(dto.destinationEnvelopeId as string, month.period);
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockMonth(tx, month.id);
      this.assertLockedMonthMutable(locked, month.period, dto.version);

      if (dto.type === 'transfer') {
        const availableMinor = await this.findMonthClosing(tx, month.id, source.id);
        this.assertTransferCovered(requestedMinor, availableMinor);
      }

      const sequenceNo = await this.nextSequenceNo(tx, month.id);
      const operation = await tx.operation.create({
        data: {
          monthId: month.id,
          sequenceNo,
          type: dto.type,
          sourceEnvelopeId: source.id,
          destinationEnvelopeId: dto.type === 'transfer' ? destination?.id ?? null : null,
          requestedMinor,
          sign: dto.type === 'adjustment' ? dto.sign ?? null : null,
          isInitial: dto.type === 'initial_balance',
          comment: dto.comment ?? null,
        },
      });

      const recalc = await this.engine.recalculateMonthAtomically(month.id, tx);
      const result = await this.findFreshResult(tx, operation.id);
      const summary = await this.buildSummary(
        tx,
        month,
        locked.version + 1,
        source.id,
        dto.type === 'transfer' ? destination?.id : undefined,
      );

      return {
        operation,
        result,
        summary,
        warnings: [...recalc.warnings, ...this.uncoveredWarnings(result, operation)],
      };
    });
  }

  /**
   * Edit an operation (spec lines 313-321). sequence_no never changes; a
   * transfer is re-checked against the available balance — position-accurate
   * (the balance just before this operation) when the source is unchanged,
   * else the source's month-end closing. The update and the cascade
   * recalculation commit atomically.
   */
  // Todo 27 — implemented after its failing tests are captured.
  async update(id: string, dto: UpdateOperationRequest): Promise<OperationMutationResponse> {
    void id;
    void dto;
    throw new Error('Not implemented');
  }

  /**
   * Delete an operation (spec lines 315-317): the removal triggers a cascade
   * recalculation; the sequence_no gap is left in place — remaining
   * operations are never renumbered (line 196).
   */
  // Todo 27 — implemented after its failing tests are captured.
  async remove(id: string, version: number): Promise<OperationDeleteResponse> {
    void id;
    void version;
    throw new Error('Not implemented');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Structural type rules (spec lines 142-147): transfer needs a distinct
   * destination, adjustment needs a sign. Malformed requests → 400, matching
   * the boundary behaviour of ZodValidationPipe.
   */
  private assertStructuralRules(
    type: OperationType,
    sourceEnvelopeId: string,
    destinationEnvelopeId: string | null,
    sign: '+' | '-' | null | undefined,
  ): void {
    if (type === 'transfer') {
      if (destinationEnvelopeId === null) {
        throw new BadRequestException('Перевод требует конверт-получатель (destinationEnvelopeId).');
      }
      if (destinationEnvelopeId === sourceEnvelopeId) {
        throw new BadRequestException('Конверт-источник и конверт-получатель перевода должны различаться.');
      }
    }
    if (type === 'adjustment' && sign !== '+' && sign !== '-') {
      throw new BadRequestException("Корректировка требует знак '+' или '-'.");
    }
  }

  /** Closed months are read-only (spec line 321); the spec message is line 373. */
  private assertMonthMutable(month: BudgetMonth): void {
    if (month.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        `Месяц ${month.period} закрыт. Откройте его повторно, чтобы внести изменения.`,
      );
    }
  }

  /**
   * Authoritative in-transaction gate: the month row was read under FOR
   * UPDATE, so status and version are current. Lock precedes version so a
   * closed month always reports MONTH_LOCKED.
   */
  private assertLockedMonthMutable(
    locked: { status: string; version: number },
    period: string,
    expectedVersion: number,
  ): void {
    if (locked.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        `Месяц ${period} закрыт. Откройте его повторно, чтобы внести изменения.`,
      );
    }
    if (locked.version !== expectedVersion) {
      throw new ConflictException(
        'VERSION_CONFLICT',
        `Данные месяца ${period} изменились. Обновите данные и повторите.`,
      );
    }
  }

  /** A manually saved transfer never exceeds the available balance (spec line 370). */
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
   * Uncovered-part notices (spec lines 369, 371). Transfers are excluded:
   * a manually saved transfer is always covered (line 161).
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
   * Current working month: prefer 'open', then 'reopened', then 'draft'
   * (spec lines 200-205). When no mutable month exists, falls back to the
   * latest month overall so the caller can reject closed-month mutations;
   * returns null only when no budget month exists at all.
   */
  private async findCurrentMonth(): Promise<BudgetMonth | null> {
    const mutableMonths = await this.prisma.budgetMonth.findMany({
      where: { status: { in: ['open', 'reopened', 'draft'] } },
      orderBy: { period: 'desc' },
    });

    return (
      mutableMonths.find((m) => m.status === 'open') ??
      mutableMonths.find((m) => m.status === 'reopened') ??
      mutableMonths.find((m) => m.status === 'draft') ??
      this.prisma.budgetMonth.findFirst({ orderBy: { period: 'desc' } })
    );
  }

  /**
   * Load an envelope and require it available in the given month (spec line
   * 455): unknown → 404; archived at or before that month → 409.
   */
  private async findEnvelope(id: string, period: string): Promise<Envelope> {
    const envelope = await this.prisma.envelope.findUnique({ where: { id } });
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
   * Lock the month row FOR UPDATE and return its fresh status/version. This
   * serializes concurrent mutations of the same month: sequence numbers and
   * the transfer balance check stay race-safe (spec lines 453, 457).
   */
  private async lockMonth(db: DbClient, monthId: string): Promise<{ status: string; version: number }> {
    const rows = await db.$queryRaw<Array<{ status: string; version: number }>>`
      SELECT status, version FROM budget_month WHERE id = ${monthId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException('MONTH_NOT_FOUND', `Budget month not found: ${monthId}`);
    }
    return row;
  }

  /** sequence_no = max + 1 within the month, computed inside the transaction. */
  private async nextSequenceNo(db: DbClient, monthId: string): Promise<number> {
    const aggregate = await db.operation.aggregate({
      where: { monthId },
      _max: { sequenceNo: true },
    });
    return (aggregate._max.sequenceNo ?? 0) + 1;
  }

  /** Closing balance of an envelope in a given month (0 when no snapshot). */
  private async findMonthClosing(db: DbClient, monthId: string, envelopeId: string): Promise<number> {
    const snapshot = await db.envelopeMonthSnapshot.findUnique({
      where: { monthId_envelopeId: { monthId, envelopeId } },
      select: { closing: true },
    });
    return snapshot?.closing ?? 0;
  }

  /**
   * The engine replays every operation of every affected month inside this
   * transaction, so a fresh result row always exists for a just-mutated
   * operation; a missing row means the engine contract broke.
   */
  private async findFreshResult(db: DbClient, operationId: string): Promise<OperationResult> {
    const result = await db.operationResult.findUnique({ where: { operationId } });
    if (result === null) {
      throw new Error(`engine produced no result for operation ${operationId}`);
    }
    return result;
  }

  private async buildSummary(
    db: DbClient,
    month: BudgetMonth,
    version: number,
    sourceEnvelopeId: string,
    destinationEnvelopeId?: string,
  ): Promise<OperationSummary> {
    const summary: OperationSummary = {
      monthId: month.id,
      period: month.period,
      version,
      sourceBalanceMinor: await this.findMonthClosing(db, month.id, sourceEnvelopeId),
    };
    if (destinationEnvelopeId !== undefined) {
      summary.destinationBalanceMinor = await this.findMonthClosing(db, month.id, destinationEnvelopeId);
    }
    return summary;
  }
}
