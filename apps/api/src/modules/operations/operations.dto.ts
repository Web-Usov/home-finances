import { z } from 'zod';
import {
  CreateOperationRequestSchema,
  OperationTypeSchema,
  PeriodSchema,
  UpdateOperationRequestSchema,
} from '@family-budget/types';

/**
 * Local request schemas for the Operations module.
 *
 * The shared package schemas carry no optimistic-lock `version`; every
 * mutation needs one (SPECIFICATION.md line 457), so the module extends them
 * locally — packages/types is owned by another workstream and must stay
 * untouched here.
 */
export const CreateOperationSchema = CreateOperationRequestSchema.extend({
  version: z.number().int().nonnegative(),
});

export const UpdateOperationSchema = UpdateOperationRequestSchema.extend({
  version: z.number().int().nonnegative(),
});

/** History filters (SPECIFICATION.md lines 323-325): period, envelope, type. */
export const OperationListQuerySchema = z.object({
  period: PeriodSchema.optional(),
  envelopeId: z.string().uuid().optional(),
  type: OperationTypeSchema.optional(),
});

export type CreateOperationRequest = z.infer<typeof CreateOperationSchema>;
export type UpdateOperationRequest = z.infer<typeof UpdateOperationSchema>;
export type OperationListQuery = z.infer<typeof OperationListQuerySchema>;
