import { isAxiosError } from 'axios';
import type { Envelope } from '@family-budget/types';

/**
 * Envelope with its current balance in integer kopecks.
 * Mirrors `EnvelopeWithBalance` from apps/api envelopes.service.list() — the
 * shape returned by GET /api/v1/envelopes. The OpenAPI spec has no response
 * schema, so the orval client types the response as `void`; we re-type it via
 * the hook's `TData` generic and this interface.
 */
export interface EnvelopeWithBalance extends Envelope {
  balanceMinor: number;
}

/** Response body of GET /api/v1/envelopes — see envelopes.service.list(). */
export interface EnvelopesListResponse {
  envelopes: EnvelopeWithBalance[];
}

/** Backend error body on 409/422: { error: ApiErrorCode, message: string }. */
export interface ApiErrorResponse {
  error: string;
  message: string;
}

/**
 * Extract the Russian-language message from a backend error.
 *
 * The backend returns `{ error, message }` on 409/422; axios throws an
 * AxiosError carrying that body on `response.data`. Falls back to `fallback`
 * when the shape is unexpected (network error, non-axios throw, missing body).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}