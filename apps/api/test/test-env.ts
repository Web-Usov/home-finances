import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolves the base URL of the TEST database (no `schema` param).
 * Priority: TEST_DATABASE_URL env (CI) > DATABASE_URL in apps/api/.env.test.
 * The ambient DATABASE_URL (dev DB) is deliberately ignored.
 */
export function getTestDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const file = resolve(__dirname, '..', '.env.test');
    if (!existsSync(file)) {
      throw new Error('apps/api/.env.test is missing: copy apps/api/.env.test.example');
    }
    const line = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('DATABASE_URL='));
    url = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  if (!url) throw new Error('DATABASE_URL is not set in apps/api/.env.test');

  const parsed = new URL(url);
  parsed.searchParams.delete('schema');
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests against "${dbName}": name must end with _test`);
  }
  return parsed.toString();
}

/** Schema owned by one jest worker of one test run: test_<runId>_w<workerId>. */
export function schemaName(runId: string, workerId: string | number): string {
  return `test_${runId}_w${workerId}`;
}

export function withSchema(baseUrl: string, schema: string): string {
  const u = new URL(baseUrl);
  u.searchParams.set('schema', schema);
  return u.toString();
}
