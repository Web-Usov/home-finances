import { getTestDatabaseUrl, schemaName, withSchema } from './test-env';

// Runs in every worker before any test module is imported: points Prisma at
// this worker's private schema and away from the dev DB.
const runId = process.env.TEST_RUN_ID;
if (!runId) throw new Error('TEST_RUN_ID missing: integration tests must run via jest.int.config.js');
process.env.DATABASE_URL = withSchema(
  getTestDatabaseUrl(),
  schemaName(runId, process.env.JEST_WORKER_ID ?? '1'),
);
