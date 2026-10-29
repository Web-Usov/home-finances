/* eslint-disable no-console */
// Starts the built API (apps/api/dist) against a dedicated schema of the test DB:
// drop schema -> prisma migrate deploy -> node dist/main. Drops the schema on exit.
// Requires `pnpm --filter @family-budget/api build` (the root e2e scripts do it).
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import pg from 'pg';
import { getE2eEnv, repoRoot } from './env.mjs';

const env = getE2eEnv();
const apiDir = resolve(repoRoot, 'apps/api');
const require = createRequire(resolve(apiDir, 'package.json'));

async function dropSchema() {
  const client = new pg.Client({ connectionString: env.baseDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${env.schema}" CASCADE`);
  } finally {
    await client.end();
  }
}

await dropSchema();
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: apiDir,
  env: { ...process.env, DATABASE_URL: env.databaseUrl },
  stdio: 'inherit',
});

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: apiDir,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: env.databaseUrl,
    API_PORT: env.apiPort,
  },
  stdio: 'inherit',
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
  await new Promise((r) => (child.exitCode === null ? child.once('exit', r) : r()));
  await dropSchema().catch((e) => console.error('schema cleanup failed:', e));
  process.exit(code);
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
child.on('exit', (code) => stop(code ?? 1));
