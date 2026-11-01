import { isAxiosError } from 'axios';
import type { ApiErrorResponse } from '../components/envelopes/types';

/** MSG-06: shown whenever the API refuses a change because the month is closed. */
export const MONTH_LOCKED_MESSAGE = 'Месяц закрыт. Откройте его повторно, чтобы внести изменения.';

/** API-27: a missing `If-Match` is a client bug (the helper always sends it); the user only sees a generic hint. */
export const PRECONDITION_REQUIRED_MESSAGE = 'Не удалось выполнить действие. Обновите страницу и повторите.';

export interface DescribedError {
  code: string | null;
  message: string;
}

/**
 * Turn a failed month request into a Russian message. `MONTH_LOCKED` always shows the verbatim MSG-06 text;
 * other 409/422 responses carry their own Russian message (`VERSION_CONFLICT` asks to refresh and retry,
 * `ALLOCATION_EXCEEDS_INCOME` is MSG-01). The month mutation hooks refetch the month data after every settled request (`useMonthMutation`).
 */
export function describeMonthError(error: unknown, fallback: string): DescribedError {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const code = error.response?.data?.error ?? null;
    if (code === 'MONTH_LOCKED') return { code, message: MONTH_LOCKED_MESSAGE };
    if (code === 'PRECONDITION_REQUIRED') return { code, message: PRECONDITION_REQUIRED_MESSAGE };
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.length > 0) return { code, message };
    return { code, message: fallback };
  }
  return { code: null, message: fallback };
}
