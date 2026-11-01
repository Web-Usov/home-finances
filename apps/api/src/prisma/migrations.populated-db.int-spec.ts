import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { getTestDatabaseUrl, schemaName, withSchema } from '../../test/test-env';
import { CalculationEngineService } from '../modules/calculation-engine/calculation-engine.service';
import { PrismaService } from './prisma.service';

/**
 * NFR-29: migrations are verified on an empty AND a populated test database.
 *
 * The populated case applies only the baseline migration (`init`) into a private schema of the test
 * DB, seeds a realistic budget at that baseline (closed / reopened / draft months, an archived
 * envelope, allocations, every operation type incl. an uncovered one, derived results and
 * snapshots), then runs `prisma migrate deploy` with the full migration folder and checks that
 * nothing was lost, the MON-13 partial unique index (T-028 / T-036) exists, the schema matches
 * schema.prisma, and the calculation engine can recalculate the migrated data.
 *
 * Both schemas are named like the jest-worker ones (`test_<runId>_w...`), so global teardown drops
 * them even if this test is killed. The dev DB is never touched.
 */

const apiRoot = resolve(__dirname, '..', '..');
const prismaCli = require.resolve('prisma/build/index.js');
const allMigrationsDir = join(apiRoot, 'prisma', 'migrations');
const schemaFile = join(apiRoot, 'prisma', 'schema.prisma');
const BASELINE = '20260803194137_init';
const SINGLE_REOPENED_INDEX = 'budget_month_single_reopened_key';

function prismaCmd(args: string[], url: string): string {
  return execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** `prisma migrate deploy` of a prisma dir holding only `migrations` (all when omitted). */
function deploy(url: string, migrations?: string[]): void {
  if (migrations === undefined) {
    prismaCmd(['migrate', 'deploy', '--schema', schemaFile], url);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'nfr29-'));
  try {
    const prismaDir = join(dir, 'prisma');
    mkdirSync(join(prismaDir, 'migrations'), { recursive: true });
    cpSync(schemaFile, join(prismaDir, 'schema.prisma'));
    cpSync(join(allMigrationsDir, 'migration_lock.toml'), join(prismaDir, 'migrations', 'migration_lock.toml'));
    for (const name of migrations) {
      cpSync(join(allMigrationsDir, name), join(prismaDir, 'migrations', name), { recursive: true });
    }
    prismaCmd(['migrate', 'deploy', '--schema', join(prismaDir, 'schema.prisma')], url);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Statements `migrate diff` needs to turn the migrated schema into schema.prisma (none when in sync; partial indexes are invisible to it). */
function schemaDrift(url: string): string[] {
  const script = prismaCmd(
    ['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schemaFile, '--script'],
    url,
  );
  return script
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('--'))
    .join(' ')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

interface Seed {
  food: string;
  fun: string;
  rent: string;
  months: Record<'jan' | 'feb' | 'mar' | 'apr', string>;
}

// Derived values below were computed by hand from the seeded source data (CALC-04 / FIN-13 / OP-15).
async function seedBaseline(prisma: PrismaService): Promise<Seed> {
  const [food, fun, rent] = await Promise.all([
    prisma.envelope.create({ data: { name: 'Еда', createdPeriod: '2026-01', displayOrder: 0 } }),
    prisma.envelope.create({ data: { name: 'Развлечения', createdPeriod: '2026-01', displayOrder: 1 } }),
    prisma.envelope.create({
      data: { name: 'Аренда', createdPeriod: '2026-01', displayOrder: 2, status: 'archived', archivedPeriod: '2026-03' },
    }),
  ]);
  const mk = (period: string, status: 'draft' | 'open' | 'closed' | 'reopened', incomeMinor: number, version: number) =>
    prisma.budgetMonth.create({ data: { period, status, incomeMinor, version } });
  const [jan, feb, mar, apr] = [
    await mk('2026-01', 'closed', 10_000_000, 4),
    await mk('2026-02', 'closed', 10_000_000, 3),
    await mk('2026-03', 'reopened', 10_000_000, 5),
    await mk('2026-04', 'draft', 8_000_000, 1),
  ];

  const alloc = (monthId: string, envelopeId: string, amountMinor: number) => ({ monthId, envelopeId, amountMinor });
  await prisma.allocation.createMany({
    data: [
      alloc(jan.id, food.id, 5_000_000),
      alloc(jan.id, fun.id, 2_000_000),
      alloc(jan.id, rent.id, 3_000_000),
      alloc(feb.id, food.id, 5_000_000),
      alloc(feb.id, fun.id, 2_000_000),
      alloc(feb.id, rent.id, 3_000_000),
      alloc(mar.id, food.id, 5_000_000),
      alloc(mar.id, fun.id, 2_000_000),
      alloc(apr.id, food.id, 4_000_000),
    ],
  });

  const ops = await Promise.all([
    prisma.operation.create({
      data: { monthId: jan.id, sequenceNo: 1, type: 'initial_balance', sourceEnvelopeId: food.id, requestedMinor: 500_000, isInitial: true },
    }),
    prisma.operation.create({
      data: { monthId: jan.id, sequenceNo: 2, type: 'expense', sourceEnvelopeId: food.id, requestedMinor: 2_000_000, comment: 'Продукты' },
    }),
    prisma.operation.create({
      data: { monthId: feb.id, sequenceNo: 1, type: 'transfer', sourceEnvelopeId: fun.id, destinationEnvelopeId: food.id, requestedMinor: 1_000_000 },
    }),
    prisma.operation.create({
      data: { monthId: mar.id, sequenceNo: 1, type: 'adjustment', sign: '-', sourceEnvelopeId: rent.id, requestedMinor: 6_000_000 },
    }),
    prisma.operation.create({
      // uncovered: Развлечения holds 50 000.00 but 80 000.00 is requested
      data: { monthId: mar.id, sequenceNo: 2, type: 'expense', sourceEnvelopeId: fun.id, requestedMinor: 8_000_000 },
    }),
  ]);
  const [opInit, opFood, opTransfer, opAdjust, opUncovered] = ops;

  const res = (
    operationId: string,
    coveredMinor: number,
    uncoveredMinor: number,
    sourceBalanceBefore: number,
    sourceBalanceAfter: number,
    destinationBalanceBefore: number | null = null,
    destinationBalanceAfter: number | null = null,
  ) => ({
    operationId,
    coveredMinor,
    uncoveredMinor,
    sourceBalanceBefore,
    sourceBalanceAfter,
    destinationBalanceBefore,
    destinationBalanceAfter,
  });
  await prisma.operationResult.createMany({
    data: [
      res(opInit.id, 500_000, 0, 0, 500_000),
      res(opFood.id, 2_000_000, 0, 5_500_000, 3_500_000),
      res(opTransfer.id, 1_000_000, 0, 4_000_000, 3_000_000, 8_500_000, 9_500_000),
      res(opAdjust.id, 6_000_000, 0, 6_000_000, 0),
      res(opUncovered.id, 5_000_000, 3_000_000, 5_000_000, 0),
    ],
  });

  const snap = (
    monthId: string,
    envelopeId: string,
    v: Partial<Record<'opening' | 'initial' | 'allocation' | 'expensesRequested' | 'expensesCovered' | 'adjustmentApplied' | 'transfersIn' | 'transfersOut', number>> & {
      closing: number;
      uncoveredByType?: Prisma.InputJsonObject;
    },
  ): Prisma.EnvelopeMonthSnapshotCreateManyInput => ({
    monthId,
    envelopeId,
    opening: 0,
    initial: 0,
    allocation: 0,
    expensesRequested: 0,
    expensesCovered: 0,
    adjustmentApplied: 0,
    transfersIn: 0,
    transfersOut: 0,
    uncoveredByType: {},
    ...v,
  });
  await prisma.envelopeMonthSnapshot.createMany({
    data: [
      snap(jan.id, food.id, { initial: 500_000, allocation: 5_000_000, expensesRequested: 2_000_000, expensesCovered: 2_000_000, closing: 3_500_000 }),
      snap(jan.id, fun.id, { allocation: 2_000_000, closing: 2_000_000 }),
      snap(jan.id, rent.id, { allocation: 3_000_000, closing: 3_000_000 }),
      snap(feb.id, food.id, { opening: 3_500_000, allocation: 5_000_000, transfersIn: 1_000_000, closing: 9_500_000 }),
      snap(feb.id, fun.id, { opening: 2_000_000, allocation: 2_000_000, transfersOut: 1_000_000, closing: 3_000_000 }),
      snap(feb.id, rent.id, { opening: 3_000_000, allocation: 3_000_000, closing: 6_000_000 }),
      snap(mar.id, food.id, { opening: 9_500_000, allocation: 5_000_000, closing: 14_500_000 }),
      snap(mar.id, fun.id, {
        opening: 3_000_000,
        allocation: 2_000_000,
        expensesRequested: 8_000_000,
        expensesCovered: 5_000_000,
        closing: 0,
        uncoveredByType: { expense: 3_000_000 },
      }),
      snap(mar.id, rent.id, { opening: 6_000_000, adjustmentApplied: -6_000_000, closing: 0 }),
      snap(apr.id, food.id, { opening: 14_500_000, allocation: 4_000_000, closing: 18_500_000 }),
    ],
  });

  return { food: food.id, fun: fun.id, rent: rent.id, months: { jan: jan.id, feb: feb.id, mar: mar.id, apr: apr.id } };
}

/** Everything a user could see, keyed by stable names (ids of derived rows are rebuilt by the engine). */
async function readState(prisma: PrismaService) {
  const [months, envelopes, allocations, operations, results, snapshots] = await Promise.all([
    prisma.budgetMonth.findMany({ orderBy: { period: 'asc' } }),
    prisma.envelope.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.allocation.findMany({ include: { month: true, envelope: true } }),
    prisma.operation.findMany({ include: { month: true, sourceEnvelope: true, destinationEnvelope: true }, orderBy: [{ month: { period: 'asc' } }, { sequenceNo: 'asc' }] }),
    prisma.operationResult.findMany({ include: { operation: { include: { month: true } } } }),
    prisma.envelopeMonthSnapshot.findMany({ include: { month: true, envelope: true } }),
  ]);
  const byKey = <T extends { key: string }>(rows: T[]) => rows.sort((a, b) => a.key.localeCompare(b.key));
  return {
    months: months.map((m) => ({ period: m.period, status: m.status, incomeMinor: m.incomeMinor, version: m.version })),
    envelopes: envelopes.map((e) => ({ name: e.name, status: e.status, createdPeriod: e.createdPeriod, archivedPeriod: e.archivedPeriod })),
    allocations: byKey(allocations.map((a) => ({ key: `${a.month.period}/${a.envelope.name}`, amountMinor: a.amountMinor }))),
    operations: operations.map((o) => ({
      period: o.month.period,
      sequenceNo: o.sequenceNo,
      type: o.type,
      sign: o.sign,
      source: o.sourceEnvelope.name,
      destination: o.destinationEnvelope?.name ?? null,
      requestedMinor: o.requestedMinor,
      comment: o.comment,
    })),
    results: byKey(
      results.map((r) => ({
        key: `${r.operation.month.period}#${r.operation.sequenceNo}`,
        covered: r.coveredMinor,
        uncovered: r.uncoveredMinor,
        before: r.sourceBalanceBefore,
        after: r.sourceBalanceAfter,
        destBefore: r.destinationBalanceBefore,
        destAfter: r.destinationBalanceAfter,
      })),
    ),
    snapshots: byKey(
      snapshots.map((s) => ({
        key: `${s.month.period}/${s.envelope.name}`,
        opening: s.opening,
        initial: s.initial,
        allocation: s.allocation,
        expensesRequested: s.expensesRequested,
        expensesCovered: s.expensesCovered,
        adjustmentApplied: s.adjustmentApplied,
        transfersIn: s.transfersIn,
        transfersOut: s.transfersOut,
        closing: s.closing,
        uncoveredByType: s.uncoveredByType,
      })),
    ),
  };
}

describe('migrations on empty and populated databases', () => {
  const runId = process.env.TEST_RUN_ID as string;
  const base = getTestDatabaseUrl();
  const emptyUrl = withSchema(base, schemaName(runId, 'nfr29_empty'));
  const populatedUrl = withSchema(base, schemaName(runId, 'nfr29_populated'));
  const clients: PrismaService[] = [];
  const client = (url: string): PrismaService => {
    const c = new PrismaService({ datasourceUrl: url });
    clients.push(c);
    return c;
  };

  afterAll(async () => {
    await Promise.all(clients.map((c) => c.$disconnect()));
    const admin = new PrismaService({ datasourceUrl: base });
    try {
      for (const schema of [schemaName(runId, 'nfr29_empty'), schemaName(runId, 'nfr29_populated')]) {
        await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
    } finally {
      await admin.$disconnect();
    }
  });

  const indexDefs = (prisma: PrismaService) =>
    prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = ${SINGLE_REOPENED_INDEX}`;

  it('NFR-29: all migrations apply from scratch on an empty database', async () => {
    const migrations = readdirSync(allMigrationsDir).filter((n) => n !== 'migration_lock.toml');
    expect(migrations.length).toBeGreaterThan(1);

    deploy(emptyUrl);

    const prisma = client(emptyUrl);
    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name`;
    expect(applied.map((m) => m.migration_name)).toEqual([...migrations].sort());
    expect(applied.every((m) => m.finished_at !== null)).toBe(true);
    expect(await prisma.budgetMonth.count()).toBe(0);
    expect(await indexDefs(prisma)).toHaveLength(1);
    expect(schemaDrift(emptyUrl)).toEqual([]);
  }, 120_000);

  it('NFR-29: migrations apply on a populated database; data survives and the engine recalculates it', async () => {
    const later = readdirSync(allMigrationsDir).filter((n) => n !== 'migration_lock.toml' && n !== BASELINE);
    expect(later.length).toBeGreaterThan(0);

    // 1. Baseline schema only, no MON-13 index yet.
    deploy(populatedUrl, [BASELINE]);
    const prisma = client(populatedUrl);
    expect(await indexDefs(prisma)).toHaveLength(0);

    // 2. Populate at the baseline.
    const seed = await seedBaseline(prisma);
    const before = await readState(prisma);
    expect(before.months.map((m) => m.status)).toEqual(['closed', 'closed', 'reopened', 'draft']);
    expect(before.operations).toHaveLength(5);
    expect(before.snapshots).toHaveLength(10);

    // 3. Apply every remaining migration on top of the data.
    deploy(populatedUrl);

    // 4. Nothing lost or changed.
    const after = await readState(prisma);
    expect(after).toEqual(before);
    expect(after.allocations).toHaveLength(9);
    expect(after.results).toHaveLength(5);
    expect(after.months.find((m) => m.period === '2026-03')).toMatchObject({ status: 'reopened', version: 5 });
    expect(after.snapshots.find((s) => s.key === '2026-03/Развлечения')).toMatchObject({
      closing: 0,
      uncoveredByType: { expense: 3_000_000 },
    });
    expect(after.snapshots.find((s) => s.key === '2026-04/Еда')?.closing).toBe(18_500_000);

    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations`;
    expect(applied).toHaveLength(later.length + 1);
    expect(applied.every((m) => m.finished_at !== null)).toBe(true);

    // 5. Schema matches schema.prisma (`migrate diff` is empty) and MON-13 is enforced on the migrated data.
    expect(await indexDefs(prisma)).toHaveLength(1);
    expect(schemaDrift(populatedUrl)).toEqual([]);
    await expect(prisma.budgetMonth.update({ where: { id: seed.months.apr }, data: { status: 'reopened' } })).rejects.toThrow();
    expect((await prisma.budgetMonth.findUniqueOrThrow({ where: { id: seed.months.apr } })).status).toBe('draft');

    // 6. The engine rebuilds the derived rows of the migrated data to the same values (CALC-01).
    const engine = new CalculationEngineService(prisma);
    const { warnings } = await engine.recalculateMonthAtomically(seed.months.jan);
    expect(warnings).toEqual([]);
    const recalculated = await readState(prisma);
    expect(recalculated.months.map((m) => m.version)).toEqual([5, 4, 6, 2]);
    expect({ ...recalculated, months: before.months }).toEqual(before);
  }, 120_000);
});
