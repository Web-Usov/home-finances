import type { QueryClient } from '@tanstack/react-query';
import { getReportingControllerMonthlyDashboardV1QueryKey } from '../api/reporting/reporting';

/**
 * Optimistic locking on the client (API-25, API-26, ADR 0005 addendum). Every month-scoped mutation sends the month
 * version it was rendered from in `If-Match: "<version>"` (`ifMatch`), and every response carrying `ETag` refreshes
 * the cached dashboard of that month (`syncMonthVersionFromETag`). Both live here and nowhere else.
 */

/** Per-call request options of the generated client (second argument of `customAxiosInstance`). */
export function ifMatch(version: number): { headers: { 'If-Match': string } } {
  return { headers: { 'If-Match': `"${version}"` } };
}

/** `"7"` or `W/"7"` → 7; anything else → null. */
export function parseETag(etag: string): number | null {
  const match = /^(?:W\/)?"(\d+)"$/.exec(etag.trim());
  return match === null ? null : Number(match[1]);
}

/** Period and version of the month a response body is about (dashboard / preview `month`, mutation `data.summary|month`). */
function monthOf(body: unknown): { period: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  const data = typeof record.data === 'object' && record.data !== null ? (record.data as Record<string, unknown>) : {};
  const holder = [data.summary, data.month, record.month].find((x) => typeof x === 'object' && x !== null) as
    | { period?: unknown }
    | undefined;
  return typeof holder?.period === 'string' ? { period: holder.period } : null;
}

type Listener = (period: string, version: number) => void;
const listeners = new Set<Listener>();

/** Called by the axios response interceptor for every response that has an `ETag` header. */
export function notifyMonthETag(etag: string, body: unknown): void {
  const version = parseETag(etag);
  const month = monthOf(body);
  if (version === null || month === null) return;
  listeners.forEach((listener) => listener(month.period, version));
}

/** Subscribe the query cache to `ETag` headers; returns the unsubscribe function. */
export function syncMonthVersionFromETag(queryClient: QueryClient): () => void {
  const listener: Listener = (period, version) => {
    queryClient.setQueriesData<{ month?: { period: string; version: number } }>(
      { queryKey: getReportingControllerMonthlyDashboardV1QueryKey().slice(0, 1) },
      (cached) =>
        cached?.month !== undefined && cached.month.period === period && cached.month.version < version
          ? { ...cached, month: { ...cached.month, version } }
          : cached,
    );
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
