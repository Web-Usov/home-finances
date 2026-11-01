import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard for the generated client (API-01, API-02, API-12): Orval types a response without a schema as `void`, a body
 * without a request schema as no argument and a query parameter without a schema as `unknown`. Every such gap in the
 * committed `openapi.json` fails here, so it is fixed at the controller and never worked around in the client.
 */
interface Operation {
  parameters?: { name: string; in: string; schema?: Record<string, unknown> }[];
  requestBody?: { content?: Record<string, { schema?: Record<string, unknown> }> };
  responses?: Record<string, { content?: Record<string, { schema?: Record<string, unknown> }> }>;
}
interface Doc {
  paths: Record<string, Record<string, Operation>>;
}

const doc = JSON.parse(readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8')) as Doc;
const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ id: `${method.toUpperCase()} ${path}`, path, method, op })),
);

/** Bodiless mutations: close/reopen carry the version in `If-Match` only (API-25), archive acts on the path id. */
const BODYLESS = [/\/close$/, /\/reopen$/, /\/archive$/];

describe('openapi.json contract (typed generated client)', () => {
  it('has operations to check', () => {
    expect(operations.length).toBeGreaterThan(10);
  });

  it.each(operations)('API-01 / API-02: $id declares a schema for every 2xx response with a body', ({ op }) => {
    for (const [status, response] of Object.entries(op.responses ?? {})) {
      if (!status.startsWith('2') || status === '204') continue;
      const schema = response.content?.['application/json']?.schema;
      expect(schema && Object.keys(schema).length > 0).toBe(true);
    }
  });

  it.each(operations)('API-12: $id types every parameter (no `unknown` in the client)', ({ op }) => {
    for (const parameter of op.parameters ?? []) {
      expect({ name: parameter.name, typed: Object.keys(parameter.schema ?? {}).length > 0 }).toEqual({
        name: parameter.name,
        typed: true,
      });
    }
  });

  it.each(operations.filter(({ method }) => ['post', 'put', 'patch'].includes(method)))(
    'API-02: $id declares a request body schema unless it is bodiless by design',
    ({ path, op }) => {
      if (BODYLESS.some((pattern) => pattern.test(path))) return;
      const schema = op.requestBody?.content?.['application/json']?.schema;
      expect(schema && Object.keys(schema).length > 0).toBe(true);
    },
  );
});
