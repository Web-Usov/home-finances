/**
 * Zod validation schemas for all domain entities.
 * These schemas enforce the constraints from SPECIFICATION.md § Constraints (lines 449-459).
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

export const CreateOperationRequestSchema = z.object({
  type: OperationTypeSchema,
  sourceEnvelopeId: z.string().uuid(),
  destinationEnvelopeId: z.string().uuid().optional(),
  amount: MoneyStringSchema,
  sign: z.enum(['+', '-']).optional(),
  comment: z.string().max(500).optional(),
});

export const UpdateOperationRequestSchema = z.object({
  amount: MoneyStringSchema.optional(),
  sourceEnvelopeId: z.string().uuid().optional(),
  destinationEnvelopeId: z.string().uuid().optional(),
  comment: z.string().max(500).optional(),
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

// ---------------------------------------------------------------------------
// Cross-field validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the sum of allocations does not exceed income.
 * SPECIFICATION.md line 68: Σ allocation ≤ income
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
 * SPECIFICATION.md line 82: sums stored as integer kopecks.
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
