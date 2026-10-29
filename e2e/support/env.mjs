// Shared by playwright.config.ts, start-api.mjs and the fixtures.
// Everything is derived from env so that the config process, the web servers and
// the test workers (which inherit env) agree on ports, DB and schema.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Base URL of the TEST database (no `schema` param). Refuses names not ending in `_test`. */
export function getTestDatabaseUrl() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const file = resolve(repoRoot, 'apps/api/.env.test');
    if (!existsSync(file)) {
      throw new Error('Set TEST_DATABASE_URL or create apps/api/.env.test (copy .env.test.example)');
    }
    const line = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('DATABASE_URL='));
    url = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  if (!url) throw new Error('No test database URL found');
  const parsed = new URL(url);
  parsed.searchParams.delete('schema');
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e against "${dbName}": database name must end with _test`);
  }
  return parsed.toString();
}

function freePort() {
  const script =
    "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})";
  return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
}

/**
 * Resolves (and caches in process.env, so child processes and workers see the
 * same values) the ports, the dedicated DB schema and derived URLs.
 */
export function getE2eEnv() {
  process.env.E2E_API_PORT ??= freePort();
  process.env.E2E_WEB_PORT ??= freePort();
  process.env.E2E_SCHEMA ??= `e2e_${randomBytes(3).toString('hex')}`;
  const base = getTestDatabaseUrl();
  const dbUrl = new URL(base);
  dbUrl.searchParams.set('schema', process.env.E2E_SCHEMA);
  return {
    apiPort: process.env.E2E_API_PORT,
    webPort: process.env.E2E_WEB_PORT,
    schema: process.env.E2E_SCHEMA,
    baseDatabaseUrl: base,
    databaseUrl: dbUrl.toString(),
    apiUrl: `http://127.0.0.1:${process.env.E2E_API_PORT}`,
    webUrl: `http://127.0.0.1:${process.env.E2E_WEB_PORT}`,
  };
}
