import { PeriodSchema } from '@family-budget/types';
import { ZodValidationPipe } from './zod-validation.pipe';

/** API-17: a malformed `:period` path param (e.g. "2026-13") is a 422 VALIDATION_ERROR, not a 404 after a DB miss. */
export const PeriodParamPipe = new ZodValidationPipe(PeriodSchema);
