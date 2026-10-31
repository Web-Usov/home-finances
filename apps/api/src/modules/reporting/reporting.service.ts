import { Injectable } from '@nestjs/common';
import type { BudgetMonth, Envelope, EnvelopeMonthSnapshot, Prisma } from '@prisma/client';
import { formatMoneyMinor, formatSignedMoneyMinor } from '@family-budget/types';
import type {
  ApiWarning,
  DashboardEnvelopeSchema,
  DashboardMonthlyQuerySchema,
  DashboardMonthlyResponseSchema,
  DashboardUncoveredSchema,
  YearlyAnalyticsQuerySchema,
  YearlyAnalyticsResponseSchema,
} from '@family-budget/types';
import { z } from 'zod';
import { NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';

export type DashboardMonthlyQuery = z.infer<typeof DashboardMonthlyQuerySchema>;
export type DashboardMonthlyDto = z.infer<typeof DashboardMonthlyResponseSchema>;
export type YearlyAnalyticsQuery = z.infer<typeof YearlyAnalyticsQuerySchema>;
export type YearlyAnalyticsDto = z.infer<typeof YearlyAnalyticsResponseSchema>;
type DashboardEnvelopeDto = z.infer<typeof DashboardEnvelopeSchema>;
type DashboardUncoveredDto = z.infer<typeof DashboardUncoveredSchema>;

type UncoveredMinor = { expense: number; transfer: number; adjustment: number };

/** `uncoveredByType` is a JSON column written by the engine: { expense?, transfer?, adjustment? } in kopecks. */
function readUncovered(raw: Prisma.JsonValue): UncoveredMinor {
  const value = (raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const num = (key: string): number => (typeof value[key] === 'number' ? (value[key] as number) : 0);
  return { expense: num('expense'), transfer: num('transfer'), adjustment: num('adjustment') };
}

function formatUncovered(u: UncoveredMinor): DashboardUncoveredDto {
  return {
    total: formatMoneyMinor(u.expense + u.transfer + u.adjustment),
    expense: formatMoneyMinor(u.expense),
    transfer: formatMoneyMinor(u.transfer),
    adjustment: formatMoneyMinor(u.adjustment),
  };
}

/**
 * Reporting service — read-only views over derived data. Numbers come from `EnvelopeMonthSnapshot` rows written
 * by the engine (DATA-06); nothing is recalculated here. Each report is its own public method
 * (`monthlyDashboard`, `yearlyAnalytics`) built from small private helpers.
 */
@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * API-12: month dashboard. `period` defaults to the working month (open, then reopened, then draft;
   * falls back to the latest month); unknown period or no months at all → 404 MONTH_NOT_FOUND.
   */
  async monthlyDashboard(query: DashboardMonthlyQuery): Promise<DashboardMonthlyDto> {
    const month = await this.findMonthOrThrow(query.period);

    const [allocationAggregate, snapshots, envelopes] = await Promise.all([
      this.prisma.allocation.aggregate({ where: { monthId: month.id }, _sum: { amountMinor: true } }),
      this.prisma.envelopeMonthSnapshot.findMany({ where: { monthId: month.id } }),
      this.prisma.envelope.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const allocatedMinor = allocationAggregate._sum.amountMinor ?? 0;
    const snapshotByEnvelope = new Map(snapshots.map((s) => [s.envelopeId, s]));

    // An envelope without a snapshot had no movement and no balance in this month: all figures are 0.
    const rows = envelopes
      .filter((e) => snapshotByEnvelope.has(e.id) || this.isListedIn(e, month.period))
      .map((e) => this.toEnvelopeRow(e, snapshotByEnvelope.get(e.id)));

    const sum = (pick: (row: EnvelopeRow) => number): number => rows.reduce((acc, row) => acc + pick(row), 0);
    const uncovered: UncoveredMinor = {
      expense: sum((r) => r.uncovered.expense),
      transfer: sum((r) => r.uncovered.transfer),
      adjustment: sum((r) => r.uncovered.adjustment),
    };

    return {
      month: { id: month.id, period: month.period, status: month.status, version: month.version },
      summary: {
        income: formatMoneyMinor(month.incomeMinor),
        allocated: formatMoneyMinor(allocatedMinor),
        // FIN-11 / FIN-12: only income and allocations.
        free: formatSignedMoneyMinor(month.incomeMinor - allocatedMinor),
        replenished: formatMoneyMinor(sum((r) => r.replenished)),
        spent: formatMoneyMinor(sum((r) => r.spent)),
        adjustmentsApplied: formatSignedMoneyMinor(sum((r) => r.adjustmentApplied)),
        uncovered: formatUncovered(uncovered),
      },
      envelopes: rows.map((r) => r.dto),
      warnings: this.archivedWithBalanceWarnings(month.period, rows),
    };
  }

  /**
   * API-13: three yearly reports (REP-01) for a calendar year, read from `BudgetMonth`, `Allocation` and
   * `EnvelopeMonthSnapshot`; nothing is recalculated. Months that do not exist yield null / zero entries.
   */
  async yearlyAnalytics(query: YearlyAnalyticsQuery): Promise<YearlyAnalyticsDto> {
    const { year } = query;
    const periods = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const range = { gte: periods[0], lte: periods[11] };

    const [months, allocationSums, snapshots, envelopes] = await Promise.all([
      this.prisma.budgetMonth.findMany({ where: { period: range } }),
      this.prisma.allocation.groupBy({
        by: ['monthId'],
        where: { month: { period: range } },
        _sum: { amountMinor: true },
      }),
      this.prisma.envelopeMonthSnapshot.findMany({ where: { month: { period: range } }, include: { month: true } }),
      this.prisma.envelope.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const monthByPeriod = new Map(months.map((m) => [m.period, m]));
    const allocatedByMonth = new Map(allocationSums.map((a) => [a.monthId, a._sum.amountMinor ?? 0]));
    const snapshotByKey = new Map(snapshots.map((s) => [`${s.month.period}|${s.envelopeId}`, s]));

    return {
      year,
      incomeReport: this.incomeReport(periods, monthByPeriod, allocatedByMonth),
      envelopeBalances: this.envelopeBalances(periods, monthByPeriod, snapshotByKey, envelopes),
      uncoveredOperations: this.uncoveredReport(periods, monthByPeriod, snapshotByKey, envelopes),
    };
  }

  /** REP-02 / REP-03 / REP-04: income, allocation and free funds by month plus totals; free is not added to balances. */
  private incomeReport(
    periods: string[],
    monthByPeriod: Map<string, BudgetMonth>,
    allocatedByMonth: Map<string, number>,
  ): YearlyAnalyticsDto['incomeReport'] {
    const totals = { income: 0, allocated: 0 };
    const rows = periods.map((period) => {
      const month = monthByPeriod.get(period);
      if (month === undefined) return { period, status: null, income: null, allocated: null, free: null };
      const allocated = allocatedByMonth.get(month.id) ?? 0;
      totals.income += month.incomeMinor;
      totals.allocated += allocated;
      return {
        period,
        status: month.status,
        income: formatMoneyMinor(month.incomeMinor),
        allocated: formatMoneyMinor(allocated),
        // FIN-11: only income and allocations; operations never change free funds (FIN-12).
        free: formatSignedMoneyMinor(month.incomeMinor - allocated),
      };
    });
    return {
      months: rows,
      totals: {
        income: formatMoneyMinor(totals.income),
        allocated: formatMoneyMinor(totals.allocated),
        free: formatSignedMoneyMinor(totals.income - totals.allocated),
      },
    };
  }

  /** REP-05 / REP-06: closing balance per envelope and month; archived envelopes stay in with their status (ENV-12). */
  private envelopeBalances(
    periods: string[],
    monthByPeriod: Map<string, BudgetMonth>,
    snapshotByKey: Map<string, EnvelopeMonthSnapshot>,
    envelopes: Envelope[],
  ): YearlyAnalyticsDto['envelopeBalances'] {
    const rows = envelopes
      .map((envelope) => ({
        envelopeId: envelope.id,
        name: envelope.name,
        status: envelope.status,
        displayOrder: envelope.displayOrder,
        createdPeriod: envelope.createdPeriod,
        archivedPeriod: envelope.archivedPeriod,
        months: periods.map((period) => {
          const snapshot = snapshotByKey.get(`${period}|${envelope.id}`);
          // No snapshot: the envelope had no movement and no balance (0) if it is listed in an existing month.
          const listed = monthByPeriod.has(period) && this.isListedIn(envelope, period);
          return {
            period,
            closing: snapshot !== undefined ? formatMoneyMinor(snapshot.closing) : listed ? formatMoneyMinor(0) : null,
          };
        }),
      }))
      .filter((row) => row.months.some((m) => m.closing !== null));
    return { periods, envelopes: rows };
  }

  /**
   * REP-08 / REP-09 / REP-10 / REP-11: uncovered amounts by month and type, read per month from the snapshots
   * (the engine never carries an uncovered amount into a later month), with drill-down keys for the history.
   */
  private uncoveredReport(
    periods: string[],
    monthByPeriod: Map<string, BudgetMonth>,
    snapshotByKey: Map<string, EnvelopeMonthSnapshot>,
    envelopes: Envelope[],
  ): YearlyAnalyticsDto['uncoveredOperations'] {
    const yearTotal: UncoveredMinor = { expense: 0, transfer: 0, adjustment: 0 };
    const months = periods.map((period) => {
      const monthTotal: UncoveredMinor = { expense: 0, transfer: 0, adjustment: 0 };
      const byEnvelope: YearlyAnalyticsDto['uncoveredOperations']['months'][number]['envelopes'] = [];
      for (const envelope of envelopes) {
        const snapshot = snapshotByKey.get(`${period}|${envelope.id}`);
        if (snapshot === undefined) continue;
        const u = readUncovered(snapshot.uncoveredByType);
        monthTotal.expense += u.expense;
        monthTotal.transfer += u.transfer;
        monthTotal.adjustment += u.adjustment;
        if (u.expense + u.transfer + u.adjustment === 0) continue;
        byEnvelope.push({
          envelopeId: envelope.id,
          name: envelope.name,
          ...formatUncovered(u),
          drillDown: { period, envelopeId: envelope.id },
        });
      }
      yearTotal.expense += monthTotal.expense;
      yearTotal.transfer += monthTotal.transfer;
      yearTotal.adjustment += monthTotal.adjustment;
      return {
        period,
        exists: monthByPeriod.has(period),
        ...formatUncovered(monthTotal),
        drillDown: { period },
        drillDownByType: {
          expense: { period, type: 'expense' as const },
          transfer: { period, type: 'transfer' as const },
          adjustment: { period, type: 'adjustment' as const },
        },
        envelopes: byEnvelope,
      };
    });
    return { months, totals: formatUncovered(yearTotal) };
  }

  /** Requested period, or the working month: open > reopened > draft (MON-01, MON-02, MON-04), else the latest. */
  private async findMonthOrThrow(period: string | undefined): Promise<BudgetMonth> {
    if (period !== undefined) {
      const month = await this.prisma.budgetMonth.findUnique({ where: { period } });
      if (month === null) {
        throw new NotFoundException('MONTH_NOT_FOUND', `Месяц не найден: ${period}`);
      }
      return month;
    }
    const months = await this.prisma.budgetMonth.findMany({ orderBy: { period: 'desc' } });
    const current =
      months.find((m) => m.status === 'open') ??
      months.find((m) => m.status === 'reopened') ??
      months.find((m) => m.status === 'draft') ??
      months[0];
    if (current === undefined) {
      throw new NotFoundException('MONTH_NOT_FOUND', 'Нет ни одного месяца. Создайте первый месяц.');
    }
    return current;
  }

  /** Envelopes shown even without a snapshot: created by this month and not archived at or before it. */
  private isListedIn(envelope: Envelope, period: string): boolean {
    if (envelope.createdPeriod > period) return false;
    return envelope.archivedPeriod === null || envelope.archivedPeriod > period;
  }

  private toEnvelopeRow(envelope: Envelope, snapshot: EnvelopeMonthSnapshot | undefined): EnvelopeRow {
    const uncovered = readUncovered(snapshot?.uncoveredByType ?? null);
    const closing = snapshot?.closing ?? 0;
    const replenished = snapshot?.allocation ?? 0; // allocation inflow only: transfers are excluded (HIST-12)
    const spent = snapshot?.expensesRequested ?? 0; // OP-01: covered + uncovered part
    const adjustmentApplied = snapshot?.adjustmentApplied ?? 0;
    const dto: DashboardEnvelopeDto = {
      envelopeId: envelope.id,
      name: envelope.name,
      status: envelope.status,
      displayOrder: envelope.displayOrder,
      opening: formatMoneyMinor(snapshot?.opening ?? 0),
      initial: formatMoneyMinor(snapshot?.initial ?? 0),
      closing: formatMoneyMinor(closing),
      replenished: formatMoneyMinor(replenished),
      spent: formatMoneyMinor(spent),
      expensesCovered: formatMoneyMinor(snapshot?.expensesCovered ?? 0),
      adjustmentApplied: formatSignedMoneyMinor(adjustmentApplied),
      transfersIn: formatMoneyMinor(snapshot?.transfersIn ?? 0),
      transfersOut: formatMoneyMinor(snapshot?.transfersOut ?? 0),
      uncovered: formatUncovered(uncovered),
    };
    return { envelope, dto, closing, replenished, spent, adjustmentApplied, uncovered };
  }

  /** CALC-12: an archived envelope that still holds a balance (the engine reports it on recalculation only). */
  private archivedWithBalanceWarnings(period: string, rows: EnvelopeRow[]): ApiWarning[] {
    return rows
      .filter(
        (r) =>
          r.envelope.status === 'archived' &&
          r.envelope.archivedPeriod !== null &&
          period >= r.envelope.archivedPeriod &&
          r.closing !== 0,
      )
      .map((r) => ({
        code: 'ARCHIVED_ENVELOPE_WITH_BALANCE',
        message:
          `Конверт «${r.envelope.name}» архивирован, но в месяце ${period} его остаток равен ` +
          `${formatSignedMoneyMinor(r.closing)} ₽. Верните конверт из архива, обнулите его и архивируйте заново.`,
      }));
  }
}

interface EnvelopeRow {
  envelope: Envelope;
  dto: DashboardEnvelopeDto;
  closing: number;
  replenished: number;
  spent: number;
  adjustmentApplied: number;
  uncovered: UncoveredMinor;
}
