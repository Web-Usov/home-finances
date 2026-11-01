import { PeriodSchema } from '@family-budget/types';
import { PeriodParamPipe } from './period-param.pipe';

describe('PeriodSchema (ADR 0006)', () => {
  it.each(['2026-01', '2026-09', '2026-10', '2026-12', '1999-06'])('ADR 0006: accepts %s', (period) => {
    expect(PeriodSchema.safeParse(period).success).toBe(true);
  });

  it.each(['2026-13', '2026-00', '2026-99', '2026-1', '2026-01-15', '26-01', '2026/01', ' 2026-01', ''])(
    'API-17: period %j is rejected',
    (period) => {
      expect(PeriodSchema.safeParse(period).success).toBe(false);
    },
  );

  it('API-17: period 2026-13 / 2026-00 is rejected with 422 (VALIDATION_ERROR) by the path param pipe', () => {
    for (const period of ['2026-13', '2026-00']) {
      expect(() => PeriodParamPipe.transform(period, { type: 'param' })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 422 }),
      );
    }
    expect(PeriodParamPipe.transform('2026-12', { type: 'param' })).toBe('2026-12');
  });
});
