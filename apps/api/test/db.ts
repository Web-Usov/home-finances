import { PrismaClient } from '@prisma/client';
import type { Allocation, BudgetMonth, Envelope, Operation } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration-test helpers. DATABASE_URL already points at this jest worker's
 * private schema (see jest-setup-env.ts), so these functions are safe to use
 * in parallel with other workers and other agents.
 *
 *   const prisma = createTestPrisma();
 *   beforeAll(() => prisma.$connect());
 *   beforeEach(() => resetDb(prisma));
 *   afterAll(() => prisma.$disconnect());
 */
export function createTestPrisma(): PrismaService {
  return new PrismaService();
}

/** Truncates every table of the current schema (except Prisma's migration table). */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let envelopeCounter = 0;

export function createMonth(
  prisma: PrismaClient,
  overrides: Partial<Omit<BudgetMonth, 'id'>> = {},
): Promise<BudgetMonth> {
  return prisma.budgetMonth.create({
    data: { period: '2026-01', status: 'open', incomeMinor: 1_000_000, version: 1, ...overrides },
  });
}

export function createEnvelope(
  prisma: PrismaClient,
  overrides: Partial<Omit<Envelope, 'id'>> = {},
): Promise<Envelope> {
  envelopeCounter += 1;
  return prisma.envelope.create({
    data: { name: `Envelope ${envelopeCounter}`, createdPeriod: '2026-01', displayOrder: 0, ...overrides },
  });
}

export function createAllocation(
  prisma: PrismaClient,
  data: Pick<Allocation, 'monthId' | 'envelopeId' | 'amountMinor'>,
): Promise<Allocation> {
  return prisma.allocation.create({ data });
}

export function createOperation(
  prisma: PrismaClient,
  data: Pick<Operation, 'monthId' | 'sequenceNo' | 'type' | 'sourceEnvelopeId' | 'requestedMinor'> &
    Partial<Operation>,
): Promise<Operation> {
  return prisma.operation.create({ data: { sign: null, isInitial: false, ...data } });
}
