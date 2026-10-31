import { SaveAllocationsRequestSchema } from '@family-budget/types';
import { z } from 'zod';
import { zodOpenApiSchema } from './swagger-zod';

type Schema = { properties: Record<string, (Record<string, unknown> & { properties?: Record<string, Record<string, unknown>> }) | undefined> };

describe('zodOpenApiSchema', () => {
  it('API-04: documents uuid keys of the allocations map via x-propertyNames (propertyNames is invalid in OpenAPI 3.0)', () => {
    const body = zodOpenApiSchema(SaveAllocationsRequestSchema) as unknown as Schema;
    expect(body.properties.allocations).toMatchObject({
      type: 'object',
      additionalProperties: { type: 'string' },
      'x-propertyNames': { format: 'uuid' },
    });
    expect(JSON.stringify(body)).not.toContain('"propertyNames"');
  });

  it('keeps nested records documented and leaves plain records untouched', () => {
    const schema = zodOpenApiSchema(
      z.object({ nested: z.object({ m: z.record(z.string().uuid(), z.number()) }), plain: z.record(z.string(), z.number()) }),
    ) as unknown as Schema;
    expect(schema.properties.nested?.properties?.m?.['x-propertyNames']).toEqual({ format: 'uuid' });
    expect(schema.properties.plain?.['x-propertyNames']).toBeUndefined();
  });
});
