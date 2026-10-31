import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ZodRecordDef, ZodTypeAny } from 'zod';
import { ZodFirstPartyTypeKind } from 'zod';
import { ignoreOverride, parseDef, zodToJsonSchema } from 'zod-to-json-schema';
import type { Options } from 'zod-to-json-schema';

type JsonSchemaObject = Record<string, unknown> & { $schema?: string };
type Override = NonNullable<Options['override']>;

/**
 * OpenAPI 3.0 has no `propertyNames`, so the `openApi3` target drops the key schema of `z.record(keySchema, ...)`.
 * The key constraint is documented as the vendor extension `x-propertyNames` (same shape as JSON Schema
 * `propertyNames`); Orval and swagger-ui ignore unknown `x-` keys without warnings.
 */
const KEY_SCHEMA_EXTENSION = 'x-propertyNames';

/** Zod's `z.string().uuid()` etc. are rendered by the converter itself; reuse that for the key schema. */
const documentRecordKeys: Override = (anyDef, refs) => {
  if ((anyDef as { typeName?: unknown }).typeName !== ZodFirstPartyTypeKind.ZodRecord) return ignoreOverride;
  const def = anyDef as ZodRecordDef;
  // Convert this node with the default behaviour (nested nodes still go through this override).
  const outer = refs.override;
  const schema = parseDef(def, {
    ...refs,
    override: (d, r, s, f) => (d === anyDef ? ignoreOverride : (outer as Override)(d, r, s, f)),
  }) as JsonSchemaObject | undefined;
  if (!schema) return ignoreOverride;
  const keySchema = parseDef(def.keyType._def, { ...refs, currentPath: [...refs.currentPath, 'propertyNames'] }) as
    | JsonSchemaObject
    | undefined;
  if (keySchema && Object.keys(keySchema).some((key) => key !== 'type')) {
    const { type: _type, ...constraints } = keySchema;
    schema[KEY_SCHEMA_EXTENSION] = constraints;
  }
  return schema as ReturnType<Override>;
};

/**
 * Convert a Zod request schema into an OpenAPI SchemaObject for `@ApiBody`.
 * Keeps `@family-budget/types` Zod schemas the single source of truth —
 * swagger request schemas are derived, never hand-written.
 */
export function zodOpenApiSchema(schema: ZodTypeAny): SchemaObject {
  const { $schema: _drop, ...rest } = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'openApi3',
    override: documentRecordKeys,
  }) as JsonSchemaObject;
  return rest as unknown as SchemaObject;
}
