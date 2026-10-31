import { planReopen } from './reopen-plan';

describe('planReopen (API-06, API-20)', () => {
  it('MON-12 / MON-14: the range runs from the month to the last existing month', () => {
    expect(planReopen({ period: '2026-01', status: 'closed' }, null, { period: '2026-04' })).toEqual({
      from: '2026-01',
      to: '2026-04',
    });
  });

  it('MON-12: a lone closed month recalculates only itself', () => {
    expect(planReopen({ period: '2026-01', status: 'closed' }, null, null)).toEqual({
      from: '2026-01',
      to: '2026-01',
    });
  });

  it.each(['draft', 'open', 'reopened'] as const)(
    'API-19: a %s month answers INVALID_STATUS_TRANSITION',
    (status) => {
      expect(() => planReopen({ period: '2026-01', status }, null, { period: '2026-02' })).toThrow(
        expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
      );
    },
  );

  it('MON-13: another reopened month answers INVALID_STATUS_TRANSITION', () => {
    expect(() =>
      planReopen({ period: '2026-01', status: 'closed' }, { period: '2026-02' }, { period: '2026-03' }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }));
  });
});
