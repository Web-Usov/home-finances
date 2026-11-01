import { isAxiosError } from 'axios';
import type { EnvelopesControllerListV1200EnvelopesItem } from '../../api/model';

/** Envelope with its current balance in integer kopecks (generated type of GET /api/v1/envelopes). */
export type EnvelopeWithBalance = EnvelopesControllerListV1200EnvelopesItem;

/** Backend error body on 409/422: { error: ApiErrorCode, message: string }; `available` only on TRANSFER_EXCEEDS_BALANCE (OP-07). */
export interface ApiErrorResponse {
  error: string;
  message: string;
  available?: string;
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