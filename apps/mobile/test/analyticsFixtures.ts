import type { YearlyAnalytics } from '../src/components/analytics/types';

const PERIODS = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
const ZERO = { total: '0.00', expense: '0.00', transfer: '0.00', adjustment: '0.00' };
export const FOOD_ID = '11111111-1111-4111-8111-111111111111';
export const OLD_ID = '22222222-2222-4222-8222-222222222222';

/** Jan and Feb exist; Feb allocates more than it earns (negative free) and has uncovered amounts. */
export function makeYearly(): YearlyAnalytics {
  const drill = (period: string, type?: string) => ({ period, ...(type ? { type } : {}) });
  return {
    year: '2026',
    incomeReport: {
      months: PERIODS.map((period, i) => ({
        period,
        status: i < 2 ? 'open' : null,
        income: i === 0 ? '100000.00' : i === 1 ? '50000.00' : null,
        allocated: i === 0 ? '60000.00' : i === 1 ? '70000.00' : null,
        free: i === 0 ? '40000.00' : i === 1 ? '-20000.00' : null,
      })),
      totals: { income: '150000.00', allocated: '130000.00', free: '20000.00' },
    },
    envelopeBalances: {
      periods: PERIODS,
      envelopes: [
        {
          envelopeId: FOOD_ID,
          name: 'Продукты',
          status: 'active',
          displayOrder: 0,
          createdPeriod: '2026-01',
          archivedPeriod: null,
          months: PERIODS.map((period, i) => ({ period, closing: i < 2 ? '10000.00' : null })),
        },
        {
          envelopeId: OLD_ID,
          name: 'Старый конверт',
          status: 'archived',
          displayOrder: 1,
          createdPeriod: '2026-02',
          archivedPeriod: '2026-02',
          months: PERIODS.map((period, i) => ({ period, closing: i === 1 ? '5000.00' : null })),
        },
      ],
    },
    uncoveredOperations: {
      months: PERIODS.map((period, i) => ({
        period,
        exists: i < 2,
        ...(i === 1 ? { total: '1500.00', expense: '1000.00', transfer: '500.00', adjustment: '0.00' } : ZERO),
        drillDown: drill(period),
        drillDownByType: { expense: drill(period, 'expense'), transfer: drill(period, 'transfer'), adjustment: drill(period, 'adjustment') },
        envelopes:
          i === 1
            ? [{ envelopeId: FOOD_ID, name: 'Продукты', total: '1500.00', expense: '1000.00', transfer: '500.00', adjustment: '0.00', drillDown: { period, envelopeId: FOOD_ID } }]
            : [],
      })),
      totals: { total: '1500.00', expense: '1000.00', transfer: '500.00', adjustment: '0.00' },
    },
  } as unknown as YearlyAnalytics;
}
