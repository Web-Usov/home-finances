import { Injectable } from '@nestjs/common';
import type { BudgetMonth, Envelope, Prisma } from '@prisma/client';
import {
  CreateEnvelopeRequestSchema,
  UpdateEnvelopeRequestSchema,
  formatMoneyMinor,
  parseMoneyMinor,
} from '@family-budget/types';
import { z } from 'zod';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';

export type CreateEnvelopeRequest = z.infer<typeof CreateEnvelopeRequestSchema>;
export type UpdateEnvelopeRequest = z.infer<typeof UpdateEnvelopeRequestSchema>;

export interface EnvelopeWithBalance extends Envelope {
  balanceMinor: number;
}

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

/** Current calendar period in YYYY-MM — used only when no budget month exists yet. */
function currentCalendarPeriod(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/**
 * Envelopes service — manages envelope lifecycle, naming, ordering.
 * Implemented per ENV-01..ENV-13.
 *
 * Notes:
 * - All monetary values are integer kopecks (never float).
 * - Name uniqueness is case-insensitive across ALL envelopes, including archived
 *   (ENV-06), enforced via Prisma `mode: 'insensitive'` (LOWER comparison).
 * - Mutations are forbidden in closed months (MON-03) → MONTH_LOCKED.
 */
@Injectable()
export class EnvelopesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CalculationEngineService,
  ) {}

  /**
   * All envelopes (active and archived) ordered for display, each with its current
   * balance — the closing balance of the latest month snapshot, 0 when none exists.
   */
  async list(): Promise<{ envelopes: EnvelopeWithBalance[] }> {
    const envelopes = await this.prisma.envelope.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const closingByEnvelope = await this.findLatestClosingBalances(
      this.prisma,
      envelopes.map((envelope) => envelope.id),
    );

    return {
      envelopes: envelopes.map((envelope) => ({
        ...envelope,
        balanceMinor: closingByEnvelope.get(envelope.id) ?? 0,
      })),
    };
  }

  /**
   * Create an envelope. When `initialBalance` is provided, a matching
   * `initial_balance` operation is appended to the current working month
   * (open/reopened/draft) atomically with the envelope (ENV-03, ENV-05), and the
   * month is recalculated in the same transaction (ENV-03, OP-10, FIN-14, CALC-04).
   */
  async create(dto: CreateEnvelopeRequest): Promise<{ envelope: EnvelopeWithBalance }> {
    const month = await this.findCurrentMonth(this.prisma);

    if (month !== null && month.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        `Месяц ${month.period} закрыт. Создание конвертов в закрытом месяце запрещено.`,
      );
    }

    const initialBalanceMinor =
      dto.initialBalance !== undefined ? parseMoneyMinor(dto.initialBalance) : 0;

    if (initialBalanceMinor > 0 && month === null) {
      throw new ConflictException(
        'MONTH_LOCKED',
        'Нет открытого месяца для стартового остатка. Сначала создайте месяц.',
      );
    }

    const name = dto.name.trim();
    await this.assertNameAvailable(this.prisma, name);

    const orderAggregate = await this.prisma.envelope.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = (orderAggregate._max.displayOrder ?? -1) + 1;
    const createdPeriod = month?.period ?? currentCalendarPeriod();

    const envelope = await this.prisma.$transaction(async (tx) => {
      const created = await tx.envelope.create({
        data: { name, createdPeriod, displayOrder },
      });

      if (initialBalanceMinor > 0 && month !== null) {
        const seqAggregate = await tx.operation.aggregate({
          where: { monthId: month.id },
          _max: { sequenceNo: true },
        });
        await tx.operation.create({
          data: {
            monthId: month.id,
            sequenceNo: (seqAggregate._max.sequenceNo ?? 0) + 1,
            type: 'initial_balance',
            sourceEnvelopeId: created.id,
            requestedMinor: initialBalanceMinor,
            isInitial: true,
          },
        });
        // CALC-04 / FIN-14: the balance only exists once the month is replayed
        // (OperationResult + EnvelopeMonthSnapshot); same transaction as the insert.
        await this.engine.recalculateMonthAtomically(month.id, tx);
      }

      return created;
    });

    return { envelope: { ...envelope, balanceMinor: initialBalanceMinor } };
  }

  /**
   * Rename and/or change display order. Pure metadata change — never touches
   * financial data and is not blocked by month status (ENV-07).
   */
  async update(id: string, dto: UpdateEnvelopeRequest): Promise<{ envelope: Envelope }> {
    const envelope = await this.prisma.envelope.findUnique({ where: { id } });
    if (envelope === null) {
      throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${id}`);
    }

    const data: { name?: string; displayOrder?: number } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== envelope.name) {
        await this.assertNameAvailable(this.prisma, name, id);
        data.name = name;
      }
    }

    if (dto.displayOrder !== undefined) {
      data.displayOrder = dto.displayOrder;
    }

    const updated = await this.prisma.envelope.update({ where: { id }, data });
    return { envelope: updated };
  }

  /**
   * Archive an envelope with zero balance (ENV-10..ENV-13).
   * Already-archived envelopes are returned unchanged: re-archiving must never
   * move archivedPeriod (ENV-13), and a no-op is not a closed-month
   * mutation. Otherwise the month lock (MON-03) is checked before the
   * balance so MONTH_LOCKED always wins; balance is the latest snapshot closing
   * (0 when none exists — the same source list() displays).
   */
  async archive(id: string): Promise<{ envelope: Envelope }> {
    const envelope = await this.prisma.envelope.findUnique({ where: { id } });
    if (envelope === null) {
      throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${id}`);
    }

    if (envelope.status === 'archived') {
      return { envelope };
    }

    const month = await this.findCurrentMonth(this.prisma);
    if (month !== null && month.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        `Месяц ${month.period} закрыт. Архивирование конвертов в закрытом месяце запрещено.`,
      );
    }

    const closingByEnvelope = await this.findLatestClosingBalances(this.prisma, [id]);
    const balanceMinor = closingByEnvelope.get(id) ?? 0;
    if (balanceMinor !== 0) {
      throw new ConflictException(
        'ENVELOPE_NOT_EMPTY',
        `Невозможно архивировать конверт «${envelope.name}»: баланс ${formatMoneyMinor(balanceMinor)} ₽. Переведите остаток или сделайте отрицательную корректировку.`,
      );
    }

    const archivedPeriod = month?.period ?? currentCalendarPeriod();
    const archived = await this.prisma.envelope.update({
      where: { id },
      data: { status: 'archived', archivedPeriod },
    });

    return { envelope: archived };
  }

  /**
   * Current working month: prefer 'open', then 'reopened', then 'draft'
   * (MON-01..MON-04, ENV-05). When no mutable month exists, falls back to the
   * latest month overall so the caller can reject closed-month mutations;
   * returns null only when no budget month exists at all.
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

  /** Case-insensitive name uniqueness across all envelopes, including archived. */
  private async assertNameAvailable(
    db: DbClient,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await db.envelope.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate !== null) {
      throw new ConflictException(
        'ENVELOPE_NAME_DUPLICATE',
        `Конверт с названием «${name}» уже существует.`,
      );
    }
  }

  /** Closing balance of each envelope's latest snapshot (by month period). */
  private async findLatestClosingBalances(
    db: DbClient,
    envelopeIds: string[],
  ): Promise<Map<string, number>> {
    const closingByEnvelope = new Map<string, number>();
    if (envelopeIds.length === 0) {
      return closingByEnvelope;
    }

    const snapshots = await db.envelopeMonthSnapshot.findMany({
      where: { envelopeId: { in: envelopeIds } },
      select: { envelopeId: true, closing: true, month: { select: { period: true } } },
    });

    const latestPeriodByEnvelope = new Map<string, string>();
    for (const snapshot of snapshots) {
      const knownPeriod = latestPeriodByEnvelope.get(snapshot.envelopeId);
      if (knownPeriod === undefined || snapshot.month.period > knownPeriod) {
        latestPeriodByEnvelope.set(snapshot.envelopeId, snapshot.month.period);
        closingByEnvelope.set(snapshot.envelopeId, snapshot.closing);
      }
    }

    return closingByEnvelope;
  }
}
