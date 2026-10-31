/**
 * Zod validation schemas for all domain entities.
 * These schemas enforce the constraints from DATA-08..DATA-13.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format');

export const MoneyMinorSchema = z
  .number()
  .int()
  .nonnegative('Money amount in kopecks must be non-negative');

export const MoneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Money string must be a decimal with up to 2 fractional digits');

/** Decimal string that may be negative (net adjustments): "-150.50". */
export const SignedMoneyStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Signed money string must be a decimal with up to 2 fractional digits');

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const MonthStatusSchema = z.enum(['draft', 'open', 'closed', 'reopened']);

export const EnvelopeStatusSchema = z.enum(['active', 'archived']);

export const OperationTypeSchema = z.enum([
  'expense',
  'transfer',
  'adjustment',
  'initial_balance',
]);

// ---------------------------------------------------------------------------
// Entity schemas
// ---------------------------------------------------------------------------

export const BudgetMonthSchema = z.object({
  id: z.string().uuid(),
  period: PeriodSchema,
  status: MonthStatusSchema,
  incomeMinor: MoneyMinorSchema,
  version: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const EnvelopeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  status: EnvelopeStatusSchema,
  createdPeriod: PeriodSchema,
  archivedPeriod: PeriodSchema.nullable(),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const AllocationSchema = z.object({
  id: z.string().uuid(),
  monthId: z.string().uuid(),
  envelopeId: z.string().uuid(),
  amountMinor: MoneyMinorSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const OperationSchema = z.object({
  id: z.string().uuid(),
  monthId: z.string().uuid(),
  sequenceNo: z.number().int().nonnegative(),
  type: OperationTypeSchema,
  sourceEnvelopeId: z.string().uuid(),
  destinationEnvelopeId: z.string().uuid().nullable(),
  requestedMinor: MoneyMinorSchema,
  sign: z.enum(['+', '-']).nullable(),
  isInitial: z.boolean(),
  comment: z.string().max(500).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const OperationResultSchema = z.object({
  id: z.string().uuid(),
  operationId: z.string().uuid(),
  coveredMinor: MoneyMinorSchema,
  uncoveredMinor: MoneyMinorSchema,
  sourceBalanceBefore: MoneyMinorSchema,
  sourceBalanceAfter: MoneyMinorSchema,
  destinationBalanceBefore: MoneyMinorSchema.nullable(),
  destinationBalanceAfter: MoneyMinorSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const EnvelopeMonthSnapshotSchema = z.object({
  id: z.string().uuid(),
  monthId: z.string().uuid(),
  envelopeId: z.string().uuid(),
  opening: MoneyMinorSchema,
  initial: MoneyMinorSchema,
  allocation: MoneyMinorSchema,
  expensesRequested: MoneyMinorSchema,
  expensesCovered: MoneyMinorSchema,
  adjustmentApplied: z.number().int(), // can be negative
  transfersIn: MoneyMinorSchema,
  transfersOut: MoneyMinorSchema,
  closing: MoneyMinorSchema,
  uncoveredByType: z.record(z.string(), MoneyMinorSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const AppSettingsSchema = z.object({
  id: z.string().uuid(),
  currency: z.string().default('RUB'),
  locale: z.string().default('ru-RU'),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// Request / DTO schemas
// ---------------------------------------------------------------------------

export const CreateMonthRequestSchema = z.object({
  period: PeriodSchema,
  income: MoneyStringSchema.optional(),
});

export const UpdateIncomeRequestSchema = z.object({
  income: MoneyStringSchema,
  version: z.number().int().nonnegative(),
});

export const SaveAllocationsRequestSchema = z.object({
  allocations: z.record(z.string().uuid(), MoneyStringSchema),
  /** Optional new month income, saved atomically with the allocations (FIN-02 is checked against it). */
  income: MoneyStringSchema.optional(),
  version: z.number().int().nonnegative(),
});

export const CreateEnvelopeRequestSchema = z.object({
  name: z.string().min(1).max(100),
  initialBalance: MoneyStringSchema.optional(),
});

export const UpdateEnvelopeRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

export const CreateOperationRequestSchema = z
  .object({
    type: OperationTypeSchema,
    sourceEnvelopeId: z.string().uuid(),
    destinationEnvelopeId: z.string().uuid().optional(),
    amount: MoneyStringSchema,
    sign: z.enum(['+', '-']).optional(),
    comment: z.string().max(500).optional(),
    /** Target month (API-21); absent = the working month (MON-16). */
    period: PeriodSchema.optional(),
    /** Optimistic-lock counter of the target month (ADR 0005). */
    version: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    // OP-10: the initial balance is created only together with an envelope.
    if (value.type === 'initial_balance') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'initial_balance is created only together with an envelope',
      });
    }
    // OP-02 / DATA-09: a transfer needs a destination different from the source.
    if (value.type === 'transfer') {
      if (value.destinationEnvelopeId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationEnvelopeId'],
          message: 'Required for a transfer',
        });
      } else if (value.destinationEnvelopeId === value.sourceEnvelopeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationEnvelopeId'],
          message: 'Must differ from sourceEnvelopeId',
        });
      }
    }
    // OP-03 / OP-04: an adjustment carries a sign.
    if (value.type === 'adjustment' && value.sign === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sign'],
        message: "Required for an adjustment ('+' or '-')",
      });
    }
  });

export const UpdateOperationRequestSchema = z.object({
  amount: MoneyStringSchema.optional(),
  sourceEnvelopeId: z.string().uuid().optional(),
  destinationEnvelopeId: z.string().uuid().optional(),
  comment: z.string().max(500).optional(),
  version: z.number().int().nonnegative(),
});

/** API-11: DELETE /operations/:id carries the month `version` as a query parameter (ADR 0005). */
export const DeleteOperationQuerySchema = z.object({
  version: z.coerce.number().int().nonnegative(),
});

/** HIST-11: history filters (the month is selected by `period`). */
export const OperationListQuerySchema = z.object({
  period: PeriodSchema.optional(),
  envelopeId: z.string().uuid().optional(),
  type: OperationTypeSchema.optional(),
});

export const ReopenMonthRequestSchema = z.object({
  version: z.number().int().nonnegative(),
});

export const CloseMonthRequestSchema = z.object({
  version: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Response schemas (declared in Swagger so the generated client is typed)
// ---------------------------------------------------------------------------

export const ApiWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/** Brief per-month totals returned by the months API. */
export const MonthSummarySchema = z.object({
  id: z.string().uuid(),
  period: PeriodSchema,
  status: MonthStatusSchema,
  incomeMinor: z.number().int(),
  version: z.number().int(),
  totalAllocatedMinor: z.number().int(),
  freeFundsMinor: z.number().int(),
});

/** Envelope `{ data, warnings }` of every mutation response (API-16). */
export function mutationResponseSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, warnings: z.array(ApiWarningSchema) });
}

/** API-22: `data.summary` is the short summary of the affected month; envelope balances come from the dashboard (API-12). */
export const MonthSummaryResultSchema = z.object({ summary: MonthSummarySchema });

/** API-22: response of `PATCH /months/{period}` and `PUT /months/{period}/allocations`. */
export const MonthSummaryResponseSchema = mutationResponseSchema(MonthSummaryResultSchema);

export const OperationHistoryItemSchema = OperationSchema.extend({
  period: PeriodSchema,
  result: OperationResultSchema.nullable(),
});

/** API-10: history response. */
export const OperationListResponseSchema = z.object({
  operations: z.array(OperationHistoryItemSchema),
});

/** API-10 / API-16: operation, its result and the affected month summary, with warnings. */
export const OperationMutationResponseSchema = mutationResponseSchema(
  z.object({
    operation: OperationSchema,
    result: OperationResultSchema,
    summary: MonthSummarySchema,
  }),
);

/** API-11 / API-16: delete returns the recalculated month summary (the operation is gone). */
export const DeleteOperationResponseSchema = MonthSummaryResponseSchema;

/** API-05: the closed month and the draft promoted to open (null when none or MON-15). */
export const CloseMonthResultSchema = z.object({
  month: MonthSummarySchema,
  promotedDraft: MonthSummarySchema.nullable(),
});

/** API-06 / MON-12: the reopened month and the inclusive range of months recalculated. */
export const ReopenMonthResultSchema = z.object({
  month: MonthSummarySchema,
  recalcRange: z.object({ from: PeriodSchema, to: PeriodSchema }),
});

/** API-20 / MON-12: read-only preview of a reopen; same `recalcRange` as `ReopenMonthResultSchema`, no version. */
export const ReopenPreviewSchema = ReopenMonthResultSchema;

// ---------------------------------------------------------------------------
// Reporting: monthly dashboard (API-12, UI-06..09)
// ---------------------------------------------------------------------------

/** API-12: `period` defaults to the working month (open, then reopened, then draft). */
export const DashboardMonthlyQuerySchema = z.object({
  period: PeriodSchema.optional(),
});

/** Uncovered amounts by operation type (OP-05, OP-09, OP-14); amounts are decimal strings. */
export const DashboardUncoveredSchema = z.object({
  total: MoneyStringSchema,
  expense: MoneyStringSchema,
  transfer: MoneyStringSchema,
  adjustment: MoneyStringSchema,
});

/** UI-07: summary indicators of the month. Adjustments are a separate indicator (UI-09). */
export const DashboardSummarySchema = z.object({
  income: MoneyStringSchema,
  allocated: MoneyStringSchema,
  /** FIN-11 / FIN-12: income minus allocated, independent of operations; negative when allocations exceed income. */
  free: SignedMoneyStringSchema,
  /** "Пополнено": sum of allocations; transfers are excluded (HIST-12). */
  replenished: MoneyStringSchema,
  /** "Списано": full requested expenses, covered and uncovered part (OP-01); transfers are excluded (HIST-12). */
  spent: MoneyStringSchema,
  /** UI-09: net applied adjustments (signed). */
  adjustmentsApplied: SignedMoneyStringSchema,
  uncovered: DashboardUncoveredSchema,
});

/** UI-08: per-envelope figures of the month, read from `EnvelopeMonthSnapshot` (DATA-06). */
export const DashboardEnvelopeSchema = z.object({
  envelopeId: z.string().uuid(),
  name: z.string(),
  status: EnvelopeStatusSchema,
  displayOrder: z.number().int().nonnegative(),
  opening: MoneyStringSchema,
  initial: MoneyStringSchema,
  /** Balance at the end of the month (the current balance while the month is open). */
  closing: MoneyStringSchema,
  /** Allocation inflow of the month (not transfers, HIST-12). */
  replenished: MoneyStringSchema,
  /** Full expenses of the month, including the uncovered part (OP-01). */
  spent: MoneyStringSchema,
  expensesCovered: MoneyStringSchema,
  adjustmentApplied: SignedMoneyStringSchema,
  transfersIn: MoneyStringSchema,
  transfersOut: MoneyStringSchema,
  uncovered: DashboardUncoveredSchema,
});

/** API-12: month dashboard — summary, envelopes, warnings. */
export const DashboardMonthlyResponseSchema = z.object({
  month: MonthSummarySchema.pick({ id: true, period: true, status: true, version: true }),
  summary: DashboardSummarySchema,
  envelopes: z.array(DashboardEnvelopeSchema),
  warnings: z.array(ApiWarningSchema),
});

// ---------------------------------------------------------------------------
// Reporting: yearly analytics (API-13, REP-01..REP-11)
// ---------------------------------------------------------------------------

/** API-13: calendar year, four digits. */
export const YearlyAnalyticsQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Year must be YYYY format'),
});

/**
 * REP-10: history deep link for a report value. Same keys as `OperationListQuerySchema`
 * (`GET /operations?period&envelopeId&type`), so the client opens the history rows behind the number.
 */
export const AnalyticsDrillDownSchema = OperationListQuerySchema.required({ period: true });

/** REP-02 / REP-03: income, allocation and free funds of one month; every value is null when the month does not exist. */
export const YearlyIncomeMonthSchema = z.object({
  period: PeriodSchema,
  status: MonthStatusSchema.nullable(),
  income: MoneyStringSchema.nullable(),
  allocated: MoneyStringSchema.nullable(),
  /** FIN-11: income minus allocated; negative when allocations exceed income. REP-04: never added to envelope balances. */
  free: SignedMoneyStringSchema.nullable(),
});

/** REP-03: yearly totals over the months that exist. */
export const YearlyIncomeTotalsSchema = z.object({
  income: MoneyStringSchema,
  allocated: MoneyStringSchema,
  free: SignedMoneyStringSchema,
});

/** REP-05: closing balance of one envelope in one month; null when the envelope does not exist in that month. */
export const YearlyEnvelopeBalanceSchema = z.object({
  period: PeriodSchema,
  closing: MoneyStringSchema.nullable(),
});

/** REP-05 / REP-06: one row of the "envelope x month" table; archived envelopes stay in the report (ENV-12). */
export const YearlyEnvelopeRowSchema = z.object({
  envelopeId: z.string().uuid(),
  name: z.string(),
  status: EnvelopeStatusSchema,
  displayOrder: z.number().int().nonnegative(),
  createdPeriod: PeriodSchema,
  archivedPeriod: PeriodSchema.nullable(),
  /** Always 12 entries, January to December. */
  months: z.array(YearlyEnvelopeBalanceSchema),
});

/** REP-08 / REP-09: uncovered amounts by type, with the history link (REP-10). Never carried over (REP-11). */
export const YearlyUncoveredValueSchema = z.object({
  total: MoneyStringSchema,
  expense: MoneyStringSchema,
  transfer: MoneyStringSchema,
  adjustment: MoneyStringSchema,
});

/** REP-10: uncovered amount of one envelope in one month, with one drill-down key per non-zero type. */
export const YearlyUncoveredEnvelopeSchema = YearlyUncoveredValueSchema.extend({
  envelopeId: z.string().uuid(),
  name: z.string(),
  drillDown: AnalyticsDrillDownSchema,
});

export const YearlyUncoveredMonthSchema = YearlyUncoveredValueSchema.extend({
  period: PeriodSchema,
  /** False when the month does not exist (all amounts are zero). */
  exists: z.boolean(),
  /** REP-10: month-level link (period only); per type see `drillDown`. */
  drillDown: AnalyticsDrillDownSchema,
  /** REP-10: links for the type columns: expense, transfer (OP-09) and negative adjustment (OP-14). */
  drillDownByType: z.object({
    expense: AnalyticsDrillDownSchema,
    transfer: AnalyticsDrillDownSchema,
    adjustment: AnalyticsDrillDownSchema,
  }),
  envelopes: z.array(YearlyUncoveredEnvelopeSchema),
});

/** API-13: the three mandatory reports for a calendar year (REP-01). */
export const YearlyAnalyticsResponseSchema = z.object({
  year: z.string(),
  incomeReport: z.object({
    months: z.array(YearlyIncomeMonthSchema),
    totals: YearlyIncomeTotalsSchema,
  }),
  envelopeBalances: z.object({
    periods: z.array(PeriodSchema),
    envelopes: z.array(YearlyEnvelopeRowSchema),
  }),
  uncoveredOperations: z.object({
    months: z.array(YearlyUncoveredMonthSchema),
    totals: YearlyUncoveredValueSchema,
  }),
});

// ---------------------------------------------------------------------------
// Cross-field validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the sum of allocations does not exceed income.
 * FIN-02: Σ allocation ≤ income
 */
export function validateAllocations(
  incomeMinor: number,
  allocations: Record<string, number>,
): { valid: boolean; excessMinor: number } {
  const total = Object.values(allocations).reduce((sum, a) => sum + a, 0);
  const excess = total - incomeMinor;
  return { valid: excess <= 0, excessMinor: Math.max(0, excess) };
}

/**
 * Convert decimal ruble string to integer kopecks.
 * FIN-08: sums stored as integer kopecks.
 */
export function parseMoneyMinor(value: string): number {
  const parts = value.split('.');
  const rubles = parts[0] ?? '0';
  const kopecks = parts[1] ?? '00';
  const k = kopecks.padEnd(2, '0').slice(0, 2);
  return parseInt(rubles, 10) * 100 + parseInt(k, 10);
}

/**
 * Convert integer kopecks to decimal ruble string.
 */
export function formatMoneyMinor(minor: number): string {
  const rubles = Math.floor(minor / 100);
  const kopecks = minor % 100;
  return `${rubles}.${String(kopecks).padStart(2, '0')}`;
}

/**
 * Kopecks to ru-RU text for server messages (MSG-07): comma decimal separator, always two kopeck digits, thousands
 * separated by U+00A0, no currency sign (the message template adds " ₽"). Negative amounts keep a U+2212 minus.
 * Not a transport format: API amount fields stay decimal strings ("15000.00", API-14) via `formatMoneyMinor`.
 */
export function formatMoneyMinorRu(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const rubles = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  const kopecks = String(abs % 100).padStart(2, '0');
  return `${negative ? '\u2212' : ''}${rubles},${kopecks}`;
}

/** Like `formatMoneyMinor` but accepts negative amounts: -150 -> "-1.50". */
export function formatSignedMoneyMinor(minor: number): string {
  return minor < 0 ? `-${formatMoneyMinor(-minor)}` : formatMoneyMinor(minor);
}
