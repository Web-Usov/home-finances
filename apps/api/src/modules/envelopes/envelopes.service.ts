import { Injectable } from '@nestjs/common';
import { Prisma, type Envelope } from '@prisma/client';
import {
  CreateEnvelopeRequestSchema,
  UpdateEnvelopeRequestSchema,
  formatMoneyMinorRu,
  parseMoneyMinor,
} from '@family-budget/types';
import { z } from 'zod';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { lockWorkingMonth } from '../../common/month-lock';
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
 * P2002 on the envelope name unique index only: `meta.target` is the list of fields (or, with some
 * drivers, the index name `envelope_name_key`); any other unique violation is not a duplicate name.
 */
function isEnvelopeNameViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target: unknown = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('name');
  }
  return typeof target === 'string' && target.includes('name');
}

/**
 * A unique-name violation of a concurrent writer that slipped past `assertNameAvailable`
 * (no month row to serialise on, or a rename) is the same domain error as the pre-check (ENV-06).
 */
function rethrowDuplicateName(name: string): (error: unknown) => never {
  return (error) => {
    if (isEnvelopeNameViolation(error)) {
      throw new ConflictException(
        'ENVELOPE_NAME_DUPLICATE',
        `Конверт с названием «${name}» уже существует.`,
      );
    }
    throw error;
  };
}

/**
 * Envelopes service — manages envelope lifecycle, naming, ordering.
 * Implemented per ENV-01..ENV-13.
 *
 * Notes:
 * - All monetary values are integer kopecks (never float).
 * - Name uniqueness is case-insensitive across ALL envelopes, including archived
 *   (ENV-06), enforced via Prisma `mode: 'insensitive'` (LOWER comparison).
 * - Mutations are forbidden in closed months (MON-03) → MONTH_LOCKED; create/archive lock the working
 *   month row FOR UPDATE first and check its status under the lock (DATA-12).
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
    const envelope = await this.prisma
      .$transaction(async (tx) => {
        // DATA-12 / MON-03: lock the working month, then check its status under the lock; the
        // name check, display order and the initial-balance operation all run under the same lock.
        const month = await lockWorkingMonth(tx, { rejectClosed: false });

        if (month !== null && month.status === 'closed') {
          throw new ConflictException(
            'MONTH_LOCKED',
            `Месяц ${month.period} закрыт. Создание конвертов в закрытом месяце запрещено.`,
          );
        }

        const initialBalanceMinor =
          dto.initialBalance !== undefined ? parseMoneyMinor(dto.initialBalance) : 0;

        if (initialBalanceMinor > 0 && month === null) {
          // ENV-14 / API-19: no month at all is "not found"; MONTH_LOCKED is reserved for a closed month.
          throw new NotFoundException(
            'MONTH_NOT_FOUND',
            'Нет месяца для стартового остатка. Сначала создайте месяц.',
          );
        }

        const name = dto.name.trim();
        await this.assertNameAvailable(tx, name);

        const orderAggregate = await tx.envelope.aggregate({
          _max: { displayOrder: true },
        });
        const displayOrder = (orderAggregate._max.displayOrder ?? -1) + 1;
        const createdPeriod = month?.period ?? currentCalendarPeriod();

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

        return { ...created, balanceMinor: initialBalanceMinor };
      })
      .catch(rethrowDuplicateName(dto.name.trim()));

    return { envelope };
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

    const updated = await this.prisma.envelope
      .update({ where: { id }, data })
      .catch(rethrowDuplicateName(data.name ?? envelope.name));
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
    const existing = await this.prisma.envelope.findUnique({ where: { id } });
    if (existing === null) {
      throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${id}`);
    }
    // Archiving is irreversible, so this early exit needs no lock (and touches no month).
    if (existing.status === 'archived') {
      return { envelope: existing };
    }

    return this.prisma.$transaction(async (tx) => {
      // DATA-12 / MON-03: the working month is locked before status and balance are read, so no
      // operation can change the balance (or close the month) between the check and the update.
      const month = await lockWorkingMonth(tx, { rejectClosed: false });

      // Re-read under the lock: a concurrent archive of the same envelope has committed by now.
      const envelope = await tx.envelope.findUnique({ where: { id } });
      if (envelope === null) {
        throw new NotFoundException('ENVELOPE_NOT_FOUND', `Конверт не найден: ${id}`);
      }

      if (envelope.status === 'archived') {
        return { envelope };
      }

      if (month !== null && month.status === 'closed') {
        throw new ConflictException(
          'MONTH_LOCKED',
          `Месяц ${month.period} закрыт. Архивирование конвертов в закрытом месяце запрещено.`,
        );
      }

      const closingByEnvelope = await this.findLatestClosingBalances(tx, [id]);
      const balanceMinor = closingByEnvelope.get(id) ?? 0;
      if (balanceMinor !== 0) {
        throw new ConflictException(
          'ENVELOPE_NOT_EMPTY',
          `Невозможно архивировать конверт «${envelope.name}»: баланс ${formatMoneyMinorRu(balanceMinor)} ₽. Переведите остаток или сделайте отрицательную корректировку.`,
        );
      }

      const archivedPeriod = month?.period ?? currentCalendarPeriod();
      const archived = await tx.envelope.update({
        where: { id },
        data: { status: 'archived', archivedPeriod },
      });

      return { envelope: archived };
    });
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
