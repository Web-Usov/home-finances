import { buildHistoryLink } from './drillDown';

describe('REP-10: buildHistoryLink', () => {
  it('REP-10: passes period, envelopeId, type and the HIST-15 filters (uncoveredOnly=true, role=source) as History route params', () => {
    expect(buildHistoryLink({ period: '2026-02', envelopeId: 'e1', type: 'expense' })).toEqual({
      pathname: '/history',
      params: { period: '2026-02', envelopeId: 'e1', type: 'expense', uncoveredOnly: 'true', role: 'source' },
    });
  });

  it('REP-10: omits absent filters', () => {
    expect(buildHistoryLink({ period: '2026-02' })).toEqual({
      pathname: '/history',
      params: { period: '2026-02', uncoveredOnly: 'true' },
    });
  });

  it('HIST-15: never sends role=source without envelopeId (the API answers 422)', () => {
    expect(buildHistoryLink({ period: '2026-02', type: 'expense' }).params).not.toHaveProperty('role');
  });
});
