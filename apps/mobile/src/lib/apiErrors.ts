import { isAxiosError } from 'axios';
import type { ApiErrorResponse } from '../components/envelopes/types';

/** MSG-06: shown whenever the API refuses a change because the month is closed. */
export const MONTH_LOCKED_MESSAGE = 'Месяц закрыт. Откройте его повторно, чтобы внести изменения.';

export interface DescribedError {
  code: string | null;
  message: string;
}

/**
 * Turn a failed month request into a Russian message. `MONTH_LOCKED` always shows the verbatim MSG-06 text;
 * other 409/422 responses carry their own Russian message (`VERSION_CONFLICT` asks to refresh and retry,
 * `ALLOCATION_EXCEEDS_INCOME` is MSG-01). Callers refetch on `VERSION_CONFLICT`.
 */
export function describeMonthError(error: unknown, fallback: string): DescribedError {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const code = error.response?.data?.error ?? null;
    if (code === 'MONTH_LOCKED') return { code, message: MONTH_LOCKED_MESSAGE };
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.length > 0) return { code, message };
    return { code, message: fallback };
  }
  return { code: null, message: fallback };
}
