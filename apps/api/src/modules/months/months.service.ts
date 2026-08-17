import { Injectable } from '@nestjs/common';
import type { BudgetMonth, Prisma } from '@prisma/client';
import {
  CreateMonthRequestSchema,
  parseMoneyMinor,
} from '@family-budget/types';
import type { MonthStatus } from '@family-budget/types';
import { z } from 'zod';
import { ConflictException, ValidationException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateMonthRequest = z.infer<typeof CreateMonthRequestSchema>;

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
  constructor(private readonly prisma: PrismaService) {}

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
   * Income defaults to 0. Allocation copying from the previous month: todo 20.
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
    const created = await this.prisma.budgetMonth.create({
      data: { period: dto.period, status, incomeMinor },
    });

    return { month: toSummary(created, 0) };
  }

  private async sumAllocations(db: DbClient, monthId: string): Promise<number> {
    const aggregate = await db.allocation.aggregate({
      where: { monthId },
      _sum: { amountMinor: true },
    });
    return aggregate._sum.amountMinor ?? 0;
  }

  updateIncome(period: string, dto: unknown) {
    // TODO(todo 15): update income, trigger cascade recalculation
    return { period, dto, message: 'Not implemented' };
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
