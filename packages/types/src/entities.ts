/**
 * Domain entities for the family budget application.
 * Derived from DATA-01..DATA-07.
 *
 * All monetary values are stored as integer kopecks (minor units) in the database
 * and API, but displayed as decimal rubles in the UI.
 */

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------

export type MonthStatus = 'draft' | 'open' | 'closed' | 'reopened';

export type EnvelopeStatus = 'active' | 'archived';

export type OperationType = 'expense' | 'transfer' | 'adjustment' | 'initial_balance';

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface BudgetMonth {
  id: string;
  period: string; // YYYY-MM
  status: MonthStatus;
  incomeMinor: number;
  version: number; // optimistic locking
  createdAt: Date;
  updatedAt: Date;
}

export interface Envelope {
  id: string;
  name: string;
  status: EnvelopeStatus;
  createdPeriod: string; // YYYY-MM
  archivedPeriod: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Allocation {
  id: string;
  monthId: string;
  envelopeId: string;
  amountMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Operation {
  id: string;
  monthId: string;
  sequenceNo: number;
  type: OperationType;
  sourceEnvelopeId: string;
  destinationEnvelopeId: string | null;
  requestedMinor: number;
  sign: '+' | '-' | null; // for adjustments: '+' increase, '-' decrease
  isInitial: boolean;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationResult {
  id: string;
  operationId: string;
  coveredMinor: number;
  uncoveredMinor: number;
  sourceBalanceBefore: number;
  sourceBalanceAfter: number;
  destinationBalanceBefore: number | null;
  destinationBalanceAfter: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvelopeMonthSnapshot {
  id: string;
  monthId: string;
  envelopeId: string;
  opening: number;
  initial: number;
  allocation: number;
  expensesRequested: number;
  expensesCovered: number;
  adjustmentApplied: number;
  transfersIn: number;
  transfersOut: number;
  closing: number;
  uncoveredByType: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  id: string;
  currency: string; // 'RUB' in MVP
  locale: string; // 'ru-RU' in MVP
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Aggregate / DTO types
// ---------------------------------------------------------------------------

export interface YearlyAnalytics {
  year: number;
  months: MonthAnalytics[];
  envelopes: EnvelopeYearlyBalance[];
  uncoveredOperations: UncoveredByMonth[];
}

export interface MonthAnalytics {
  period: string;
  incomeMinor: number;
  totalAllocatedMinor: number;
  freeFundsMinor: number;
}

export interface EnvelopeYearlyBalance {
  envelopeId: string;
  envelopeName: string;
  balances: Record<string, number>; // period -> closing balance
}

export interface UncoveredByMonth {
  period: string;
  uncoveredExpenses: number;
  uncoveredTransfers: number;
  uncoveredAdjustments: number;
}

// ---------------------------------------------------------------------------
// API response / error types
// ---------------------------------------------------------------------------

export interface ApiWarning {
  code: string;
  message: string;
}

export interface MutationResponse<T> {
  data: T;
  warnings: ApiWarning[];
}

export type ApiErrorCode =
  | 'ALLOCATION_EXCEEDS_INCOME'
  | 'MONTH_LOCKED'
  | 'TRANSFER_EXCEEDS_BALANCE'
  | 'ENVELOPE_NOT_EMPTY'
  | 'ENVELOPE_NOT_FOUND'
  | 'OPERATION_NOT_FOUND'
  | 'MONTH_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'INVALID_STATUS_TRANSITION'
  | 'INVALID_PERIOD'
  | 'ENVELOPE_NAME_DUPLICATE'
  | 'VALIDATION_ERROR';
