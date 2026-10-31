import type { z } from 'zod';
import type { CreateMonthRequestSchema, MonthStatus, MonthSummarySchema } from '@family-budget/types';
import type { ReportingControllerMonthlyDashboardV1200 } from '../../api/model';

/** Brief month entry of GET /api/v1/months (the OpenAPI document has no response schema for it, so Orval types it `void`). */
export type MonthSummary = z.infer<typeof MonthSummarySchema>;

/** Response body of GET /api/v1/months — see MonthsService.list(). */
export interface MonthsListResponse {
  months: MonthSummary[];
}

/** Body of POST /api/v1/months (no `@ApiBody` in the OpenAPI document, so the generated hook sends none). */
export type CreateMonthBody = z.infer<typeof CreateMonthRequestSchema>;

export type Dashboard = ReportingControllerMonthlyDashboardV1200;
export type DashboardEnvelope = Dashboard['envelopes'][number];

export const STATUS_LABELS: Record<MonthStatus, string> = {
  draft: 'Черновик',
  open: 'Открыт',
  closed: 'Закрыт',
  reopened: 'Открыт повторно',
};
