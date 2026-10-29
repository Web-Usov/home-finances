import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { getTestDatabaseUrl, schemaName, withSchema } from './test-env';

const prismaCli = require.resolve('prisma/build/index.js');

function migrate(url: string): void {
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

/**
 * Creates one schema per jest worker (test_<runId>_w<n>) in the test DB and
 * applies all migrations to each. TEST_RUN_ID is inherited by the workers.
 * A unique runId keeps parallel runs / agents from touching each other's data.
 */
export default function globalSetup(globalConfig: { maxWorkers: number }): void {
  const base = getTestDatabaseUrl();
  const runId = randomBytes(4).toString('hex');
  process.env.TEST_RUN_ID = runId;

  const workers = Math.max(1, globalConfig.maxWorkers);
  for (let w = 1; w <= workers; w++) {
    migrate(withSchema(base, schemaName(runId, w)));
  }
}
