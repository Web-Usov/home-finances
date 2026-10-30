import { Injectable } from '@nestjs/common';
import type { BudgetMonth, Prisma } from '@prisma/client';
import {
  CreateMonthRequestSchema,
  UpdateIncomeRequestSchema,
  formatMoneyMinor,
  parseMoneyMinor,
} from '@family-budget/types';
import type { MonthStatus, MutationResponse } from '@family-budget/types';
import { z } from 'zod';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';

export type CreateMonthRequest = z.infer<typeof CreateMonthRequestSchema>;
export type UpdateIncomeRequest = z.infer<typeof UpdateIncomeRequestSchema>;

/** Brief per-month totals — the "краткие итоги" of the months API (spec line 465). */
export interface MonthSummaryDto {
  id: string;
  period: string;
  status: MonthStatus;
  incomeMinor: number;
  version: number;
  totalAllocatedMinor: number;
  freeFundsMinor: number;
}

/** Satisfied by both PrismaService and an interactive transaction client. */
type DbClient = Prisma.TransactionClient;

/** Next calendar period in YYYY-MM — '2026-12' rolls over to '2027-01'. */
function nextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, month ?? 1, 1)); // 1-based month overflows into January
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toSummary(month: BudgetMonth, totalAllocatedMinor: number): MonthSummaryDto {
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

/**
 * Months service — month lifecycle: creation, income, close/reopen transitions.
 * Implemented per SPECIFICATION.md § Life Cycle of Month (lines 198-232).
 *
 * Notes:
 * - All monetary values are integer kopecks (never float).
 * - Periods are YYYY-MM strings; lexicographic order == chronological order.
 * - Optimistic locking via `version` (spec line 457).
 */
@Injectable()
export class MonthsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CalculationEngineService,
  ) {}

  /** All months in chronological order with brief summaries (spec line 465). */
  async list(): Promise<{ months: MonthSummaryDto[] }> {
    const months = await this.prisma.budgetMonth.findMany({
      orderBy: { period: 'asc' },
    });
    if (months.length === 0) {
      return { months: [] };
    }

    const allocations = await this.prisma.allocation.findMany({
      select: { monthId: true, amountMinor: true },
    });
    const totalByMonth = new Map<string, number>();
    for (const allocation of allocations) {
      totalByMonth.set(
        allocation.monthId,
        (totalByMonth.get(allocation.monthId) ?? 0) + allocation.amountMinor,
      );
    }

    return {
      months: months.map((month) => toSummary(month, totalByMonth.get(month.id) ?? 0)),
    };
  }

  /**
   * Create the first or the next month (spec lines 209-217):
   * - no months at all → the new month is 'open';
   * - an open month exists → the new month is a 'draft' (only one draft allowed);
   * - latest month closed and no draft → the new month is 'open'.
   * The period must be the immediate next month — gaps are rejected (line 211).
   * Income defaults to 0. Allocations of the previous month are copied for
   * active envelopes only, as editable values (lines 293, 356), atomically
   * with the month row.
   */
  async create(dto: CreateMonthRequest): Promise<{ month: MonthSummaryDto }> {
    const months = await this.prisma.budgetMonth.findMany({
      orderBy: { period: 'asc' },
    });
    const latest = months[months.length - 1];

    let status: MonthStatus = 'open';
    if (latest !== undefined) {
      const expected = nextPeriod(latest.period);
      if (dto.period !== expected) {
        throw new ValidationException(
          'INVALID_PERIOD',
          `Месяц ${dto.period} не является следующим. Ожидается: ${expected}.`,
        );
      }
      const draft = months.find((m) => m.status === 'draft');
      if (draft !== undefined) {
        throw new ConflictException(
          'INVALID_STATUS_TRANSITION',
          `Уже существует черновик месяца ${draft.period}. Одновременно допускается только один черновик.`,
        );
      }
      status = months.some((m) => m.status === 'open') ? 'draft' : 'open';
    }

    const incomeMinor = dto.income !== undefined ? parseMoneyMinor(dto.income) : 0;

    const { created, copiedTotalMinor } = await this.prisma.$transaction(async (tx) => {
      const month = await tx.budgetMonth.create({
        data: { period: dto.period, status, incomeMinor },
      });
      const copied = latest === undefined ? 0 : await this.copyAllocations(tx, latest.id, month.id);
      return { created: month, copiedTotalMinor: copied };
    });

    return { month: toSummary(created, copiedTotalMinor) };
  }

  /**
   * Copy the previous month's allocations into the new month for ACTIVE
   * envelopes only — archived envelopes never enter new distributions
   * (spec line 293). Returns the copied total for the summary.
   */
  private async copyAllocations(
    db: DbClient,
    fromMonthId: string,
    toMonthId: string,
  ): Promise<number> {
    const previous = await db.allocation.findMany({
      where: { monthId: fromMonthId },
      select: { envelopeId: true, amountMinor: true, envelope: { select: { status: true } } },
    });
    const active = previous.filter((allocation) => allocation.envelope.status === 'active');
    if (active.length === 0) {
      return 0;
    }

    await db.allocation.createMany({
      data: active.map((allocation) => ({
        monthId: toMonthId,
        envelopeId: allocation.envelopeId,
        amountMinor: allocation.amountMinor,
      })),
    });
    return active.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
  }

  /**
   * Change the income of a non-closed month (API-03). Optimistic
   * locking via `version` (DATA-12) is checked before the closed-month lock
   * (MON-03, NFR-18). The income update and the cascade recalculation commit in one
   * transaction (API-15); the engine increments `version` on all affected
   * months, so the returned summary is re-read after the recalc.
   */
  async updateIncome(
    period: string,
    dto: UpdateIncomeRequest,
  ): Promise<MutationResponse<MonthSummaryDto>> {
    const month = await this.findMonthOrThrow(period);
    this.assertVersion(month, dto.version);
    if (month.status === 'closed') {
      throw new ConflictException(
        'MONTH_LOCKED',
        'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
      );
    }

    const incomeMinor = parseMoneyMinor(dto.income);
    return this.prisma.$transaction(async (tx) => {
      // FIN-02: income may not drop below what is already allocated (MSG-01).
      const allocatedMinor = await this.sumAllocations(tx, month.id);
      if (incomeMinor < allocatedMinor) {
        throw new ValidationException(
          'ALLOCATION_EXCEEDS_INCOME',
          `Распределено на ${formatMoneyMinor(allocatedMinor - incomeMinor)} ₽ больше дохода. Уменьшите суммы по конвертам.`,
        );
      }
      await tx.budgetMonth.update({ where: { id: month.id }, data: { incomeMinor } });
      const recalc = await this.engine.recalculateMonthAtomically(month.id, tx);
      const refreshed = await this.refreshMonth(tx, month.id);
      const totalAllocatedMinor = await this.sumAllocations(tx, month.id);
      return { data: toSummary(refreshed, totalAllocatedMinor), warnings: recalc.warnings };
    });
  }

  private async findMonthOrThrow(period: string): Promise<BudgetMonth> {
    const month = await this.prisma.budgetMonth.findUnique({ where: { period } });
    if (month === null) {
      throw new NotFoundException('MONTH_NOT_FOUND', `Месяц не найден: ${period}`);
    }
    return month;
  }

  private assertVersion(month: BudgetMonth, version: number): void {
    if (month.version !== version) {
      throw new ConflictException(
        'VERSION_CONFLICT',
        `Месяц ${month.period} был изменён (version ${month.version}). Обновите данные и повторите.`,
      );
    }
  }

  /** Re-read inside the recalc transaction — the engine bumps `version`. */
  private async refreshMonth(db: DbClient, id: string): Promise<BudgetMonth> {
    const refreshed = await db.budgetMonth.findUnique({ where: { id } });
    if (refreshed === null) {
      throw new Error(`Budget month disappeared during recalculation: ${id}`);
    }
    return refreshed;
  }

  private async sumAllocations(db: DbClient, monthId: string): Promise<number> {
    const aggregate = await db.allocation.aggregate({
      where: { monthId },
      _sum: { amountMinor: true },
    });
    return aggregate._sum.amountMinor ?? 0;
  }

  close(period: string) {
    // TODO(todo 16): validate month is open, promote draft to open
    return { period, status: 'closed', message: 'Not implemented' };
  }

  reopen(period: string, dto: unknown) {
    // TODO(todo 16): validate month is closed, warn about recalculation range
    return { period, status: 'reopened', recalcRange: [], dto, message: 'Not implemented' };
  }
}
