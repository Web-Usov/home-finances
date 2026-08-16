import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type JsonSchemaObject = Record<string, unknown> & { $schema?: string };

/**
 * Convert a Zod request schema into an OpenAPI SchemaObject for `@ApiBody`.
 * Keeps `@family-budget/types` Zod schemas the single source of truth —
 * swagger request schemas are derived, never hand-written.
 */
export function zodOpenApiSchema(schema: ZodTypeAny): SchemaObject {
  const { $schema: _drop, ...rest } = zodToJsonSchema(schema) as JsonSchemaObject;
  return rest as unknown as SchemaObject;
}
