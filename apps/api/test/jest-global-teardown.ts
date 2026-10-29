import { PrismaClient } from '@prisma/client';
import { getTestDatabaseUrl, schemaName } from './test-env';

/** Drops every schema created by this run's globalSetup. */
export default async function globalTeardown(): Promise<void> {
  const runId = process.env.TEST_RUN_ID;
  if (!runId) return;
  const prisma = new PrismaClient({ datasourceUrl: getTestDatabaseUrl() });
  try {
    const rows = await prisma.$queryRaw<{ schema_name: string }[]>`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name LIKE ${`${schemaName(runId, '').replace(/_/g, '\\_')}%`}`;
    for (const { schema_name } of rows) {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
