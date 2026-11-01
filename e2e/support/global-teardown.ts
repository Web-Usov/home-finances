import pg from 'pg';
import { releaseE2eLock } from './e2e-lock.mjs';
import { getE2eEnv } from './env.mjs';

/** Drops the run's schema even if the API process was killed before it could. */
export default async function globalTeardown(): Promise<void> {
  try {
    await dropSchema();
  } finally {
    releaseE2eLock();
  }
}

async function dropSchema(): Promise<void> {
  const { baseDatabaseUrl, schema } = getE2eEnv();
  const client = new pg.Client({ connectionString: baseDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}
