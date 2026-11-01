import type { MonthStatus } from '@family-budget/types';
import type { MonthsControllerListV1200MonthsItem, ReportingControllerMonthlyDashboardV1200 } from '../../api/model';

/** Brief month entry of GET /api/v1/months (generated type). */
export type MonthSummary = MonthsControllerListV1200MonthsItem;

export type Dashboard = ReportingControllerMonthlyDashboardV1200;
export type DashboardEnvelope = Dashboard['envelopes'][number];

export const STATUS_LABELS: Record<MonthStatus, string> = {
  draft: 'Черновик',
  open: 'Открыт',
  closed: 'Закрыт',
  reopened: 'Открыт повторно',
};
