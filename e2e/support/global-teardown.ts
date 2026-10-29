import pg from 'pg';
import { getE2eEnv } from './env.mjs';

/** Drops the run's schema even if the API process was killed before it could. */
export default async function globalTeardown(): Promise<void> {
  const { baseDatabaseUrl, schema } = getE2eEnv();
  const client = new pg.Client({ connectionString: baseDatabaseUrl });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}
