import { ApiErrorCode } from '@family-budget/types';

export class ValidationException extends Error {
  readonly statusCode = 422 as const;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ValidationException';
  }
}
