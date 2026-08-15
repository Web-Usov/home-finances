import { ApiErrorCode } from '@family-budget/types';

export class NotFoundException extends Error {
  readonly statusCode = 404 as const;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'NotFoundException';
  }
}
