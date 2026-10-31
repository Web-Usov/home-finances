import type { Dashboard, MonthSummary } from '../src/components/month/types';

const ZERO = { total: '0.00', expense: '0.00', transfer: '0.00', adjustment: '0.00' };

export function makeDashboard(overrides: Partial<Dashboard['month']> = {}): Dashboard {
  return {
    month: { id: 'm-2026-01', period: '2026-01', status: 'open', version: 3, ...overrides },
    summary: {
      income: '100000.00',
      allocated: '60000.00',
      free: '40000.00',
      replenished: '60000.00',
      spent: '5000.50',
      adjustmentsApplied: '-200.00',
      uncovered: { total: '300.00', expense: '300.00', transfer: '0.00', adjustment: '0.00' },
    },
    envelopes: [
      {
        envelopeId: 'e-food',
        name: 'Продукты',
        status: 'active',
        displayOrder: 0,
        opening: '0.00',
        initial: '0.00',
        closing: '54999.50',
        replenished: '60000.00',
        spent: '5000.50',
        expensesCovered: '4700.50',
        adjustmentApplied: '0.00',
        transfersIn: '0.00',
        transfersOut: '0.00',
        uncovered: { ...ZERO, total: '300.00', expense: '300.00' },
      },
    ],
    warnings: [],
  };
}

export function makeMonth(period: string, status: MonthSummary['status'], version = 3): MonthSummary {
  return {
    id: `m-${period}`,
    period,
    status,
    incomeMinor: 10_000_000,
    version,
    totalAllocatedMinor: 6_000_000,
    freeFundsMinor: 4_000_000,
  };
}
