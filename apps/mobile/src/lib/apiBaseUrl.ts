export const DEFAULT_API_URL = 'http://localhost:3000';

/** `EXPO_PUBLIC_API_URL` values meaning "the API is served from the page's own origin" (preview environment). */
const SAME_ORIGIN_VALUES = ['same-origin', '/'];

/**
 * Resolves the axios `baseURL` from `EXPO_PUBLIC_API_URL`.
 * - unset/empty: local dev default;
 * - `same-origin` or `/`: empty base, so generated `/api/v1/...` paths resolve against the current origin
 *   (works from any hostname behind a reverse proxy);
 * - otherwise the API origin as given, without a trailing slash.
 */
export function resolveApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_API_URL;
  if (SAME_ORIGIN_VALUES.includes(value)) return '';
  return value.replace(/\/+$/, '');
}
