import { ApiErrorCode } from '@family-budget/types';

export class ConflictException extends Error {
  readonly statusCode = 409 as const;
  readonly code: ApiErrorCode;
  /** Structured fields merged into the error body next to `error` and `message` (e.g. `available`, OP-07). */
  readonly extras: { available?: string };

  constructor(code: ApiErrorCode, message: string, extras: { available?: string } = {}) {
    super(message);
    this.code = code;
    this.extras = extras;
    this.name = 'ConflictException';
  }
}
