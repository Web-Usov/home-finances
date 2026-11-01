/** REP-10: key of a report value, same shape as the API `drillDown` (period plus optional envelopeId / type). */
export interface DrillDownKey {
  period: string;
  envelopeId?: string;
  type?: string;
}

export interface HistoryLink {
  pathname: '/history';
  params: { period: string; envelopeId?: string; type?: string; uncoveredOnly: 'true'; role: 'source' };
}

/**
 * The single place that turns an analytics drill-down key into a History tab link (route params `period`,
 * `envelopeId`, `type`). Every key comes from the uncovered report, so the link also carries `uncoveredOnly=true` and
 * `role=source` (HIST-15): the history then lists exactly the rows behind the number.
 */
export function buildHistoryLink(key: DrillDownKey): HistoryLink {
  const params: HistoryLink['params'] = { period: key.period, uncoveredOnly: 'true', role: 'source' };
  if (key.envelopeId) params.envelopeId = key.envelopeId;
  if (key.type) params.type = key.type;
  return { pathname: '/history', params };
}
