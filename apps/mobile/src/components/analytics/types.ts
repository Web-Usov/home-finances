import type { ReportingControllerYearlyAnalyticsV1200 } from '../../api/model';

export type YearlyAnalytics = ReportingControllerYearlyAnalyticsV1200;
export type IncomeMonth = YearlyAnalytics['incomeReport']['months'][number];
export type EnvelopeRow = YearlyAnalytics['envelopeBalances']['envelopes'][number];
export type UncoveredMonth = YearlyAnalytics['uncoveredOperations']['months'][number];
