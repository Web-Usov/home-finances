import { buildHistoryLink } from './drillDown';

describe('REP-10: buildHistoryLink', () => {
  it('REP-10: passes period, envelopeId and type as History route params', () => {
    expect(buildHistoryLink({ period: '2026-02', envelopeId: 'e1', type: 'expense' })).toEqual({
      pathname: '/history',
      params: { period: '2026-02', envelopeId: 'e1', type: 'expense' },
    });
  });

  it('REP-10: omits absent filters', () => {
    expect(buildHistoryLink({ period: '2026-02' })).toEqual({ pathname: '/history', params: { period: '2026-02' } });
  });
});
