import { ApiErrorCode } from '@family-budget/types';

export class PreconditionRequiredException extends Error {
  readonly statusCode = 428 as const;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PreconditionRequiredException';
  }
}
