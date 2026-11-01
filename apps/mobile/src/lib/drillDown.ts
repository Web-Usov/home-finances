/** REP-10: key of a report value, same shape as the API `drillDown` (period plus optional envelopeId / type). */
export interface DrillDownKey {
  period: string;
  envelopeId?: string;
  type?: string;
}

export interface HistoryLink {
  pathname: '/history';
  params: { period: string; envelopeId?: string; type?: string };
}

/**
 * The single place that turns an analytics drill-down key into a History tab link (route params `period`,
 * `envelopeId`, `type`). T-045 (pending spec PR #33) will extend it with `uncoveredOnly` / `role=source`.
 */
export function buildHistoryLink(key: DrillDownKey): HistoryLink {
  const params: HistoryLink['params'] = { period: key.period };
  if (key.envelopeId) params.envelopeId = key.envelopeId;
  if (key.type) params.type = key.type;
  return { pathname: '/history', params };
}
