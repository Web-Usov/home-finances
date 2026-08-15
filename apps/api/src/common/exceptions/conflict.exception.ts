import { ApiErrorCode } from '@family-budget/types';

export class ConflictException extends Error {
  readonly statusCode = 409 as const;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ConflictException';
  }
}
