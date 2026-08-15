import { NotFoundException } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from './calculation-engine.service';

/**
 * Integration tests for CalculationEngineService.recalculateMonthAtomically
 * against a real PostgreSQL instance (docker compose `family-budget-db`).
 *
 * Covers todo 8 of .omo/plans/domain-modules-impl.md:
 *   S1 — happy path: derived rows recreated, version +1 for all affected months
 *   S2 — rollback: failure inside the transaction leaves all state intact
 *   S3 — 404 domain error for an unknown month id
 *
 * Fixtures use periods 2099-01 / 2099-02 so they never collide with real data.
 * Every test cleans up its own rows (BudgetMonth first via cascade, then Envelope).
 */

const PERIOD_1 = '2099-01';
const PERIOD_2 = '2099-02';
const SUFFIX = 'a4f2'; // uuid-style suffix keeps names unique across re-runs

describe('CalculationEngineService.recalculateMonthAtomically (integration)', () => {
  let prisma: PrismaService;
  let service: CalculationEngineService;
  let envId: string;
  let month1Id: string;
  let month2Id: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new CalculationEngineService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(): Promise<void> {
    // BudgetMonth cascades to Allocation, Operation, OperationResult, EnvelopeMonthSnapshot.
    await prisma.budgetMonth.deleteMany({ where: { period: { in: [PERIOD_1, PERIOD_2] } } });
    await prisma.envelope.deleteMany({ where: { name: { contains: SUFFIX } } });
  }

  async function seed(): Promise<void> {
    await cleanup();

    const env = await prisma.envelope.create({
      data: {
        name: `Еда-${SUFFIX}`,
        createdPeriod: PERIOD_1,
        displayOrder: 0,
      },
    });
    envId = env.id;

    const month1 = await prisma.budgetMonth.create({
      data: {
        period: PERIOD_1,
        status: 'open',
        incomeMinor: 1_000_000, // 10 000.00 RUB
        version: 1,
      },
    });
    month1Id = month1.id;

    const month2 = await prisma.budgetMonth.create({
      data: {
        period: PERIOD_2,
        status: 'open',
        incomeMinor: 1_000_000,
        version: 1,
      },
    });
    month2Id = month2.id;

    // Allocation in month 1: 5 000.00 RUB into the envelope.
    await prisma.allocation.create({
      data: { monthId: month1.id, envelopeId: env.id, amountMinor: 500_000 },
    });

    // Operation in month 1: an uncovered expense of 7 000.00 RUB (only 5 000 covered).
    await prisma.operation.create({
      data: {
        monthId: month1.id,
        sequenceNo: 1,
        type: 'expense',
        sourceEnvelopeId: env.id,
        requestedMinor: 700_000,
        sign: null,
        isInitial: false,
      },
    });

    // Operation in month 2: a small covered expense of 1 000.00 RUB.
    await prisma.operation.create({
      data: {
        monthId: month2.id,
        sequenceNo: 1,
        type: 'expense',
        sourceEnvelopeId: env.id,
        requestedMinor: 100_000,
        sign: null,
        isInitial: false,
      },
    });
  }

  afterEach(async () => {
    await cleanup();
  });

  // -------------------------------------------------------------------------
  // S1 — happy path
  // -------------------------------------------------------------------------

  it('S1: recreates derived rows and increments version of every affected month', async () => {
    await seed();

    const result = await service.recalculateMonthAtomically(month1Id);

    expect(result.recalculatedFrom).toBe(PERIOD_1);
    expect(Array.isArray(result.warnings)).toBe(true);

    // Both months had their derived rows recreated.
    const results1 = await prisma.operationResult.findMany({
      where: { operation: { monthId: month1Id } },
    });
    const results2 = await prisma.operationResult.findMany({
      where: { operation: { monthId: month2Id } },
    });
    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);

    const snaps1 = await prisma.envelopeMonthSnapshot.findMany({
      where: { monthId: month1Id },
    });
    const snaps2 = await prisma.envelopeMonthSnapshot.findMany({
      where: { monthId: month2Id },
    });
    expect(snaps1).toHaveLength(1);
    expect(snaps2).toHaveLength(1);

    // Month 1: opening 0, allocation 500_000, expense covered 500_000, uncovered 200_000, closing 0.
    expect(snaps1[0]?.opening).toBe(0);
    expect(snaps1[0]?.allocation).toBe(500_000);
    expect(snaps1[0]?.expensesCovered).toBe(500_000);
    expect(snaps1[0]?.closing).toBe(0);

    // Month 2: opening carried = 0, no allocation, expense 100_000 covered, closing 0.
    expect(snaps2[0]?.opening).toBe(0);
    expect(snaps2[0]?.allocation).toBe(0);
    expect(snaps2[0]?.expensesCovered).toBe(0);
    expect(snaps2[0]?.closing).toBe(0);

    // version incremented by exactly 1 on BOTH affected months.
    const m1 = await prisma.budgetMonth.findUnique({ where: { id: month1Id } });
    const m2 = await prisma.budgetMonth.findUnique({ where: { id: month2Id } });
    expect(m1?.version).toBe(2);
    expect(m2?.version).toBe(2);
  });

  // -------------------------------------------------------------------------
  // S2 — rollback
  // -------------------------------------------------------------------------

  it('S2: rolls back all changes when the transaction fails mid-cascade', async () => {
    await seed();

    // Pre-call baseline: versions.
    const m1Before = await prisma.budgetMonth.findUnique({ where: { id: month1Id } });
    const m2Before = await prisma.budgetMonth.findUnique({ where: { id: month2Id } });
    const v1Before = m1Before?.version ?? -1;
    const v2Before = m2Before?.version ?? -1;

    // Seed a pre-existing snapshot so we can assert it survives the rollback
    // (the delete phase inside the transaction must be rolled back too).
    await prisma.envelopeMonthSnapshot.create({
      data: {
        monthId: month1Id,
        envelopeId: envId,
        opening: 0,
        initial: 0,
        allocation: 0,
        expensesRequested: 0,
        expensesCovered: 0,
        adjustmentApplied: 0,
        transfersIn: 0,
        transfersOut: 0,
        closing: 0,
        uncoveredByType: {},
      },
    });
    const snapsBefore = await prisma.envelopeMonthSnapshot.findMany({
      where: { monthId: month1Id },
    });
    expect(snapsBefore).toHaveLength(1);

    // Inject a failure on the 2nd replayMonth call: the 1st call runs the real
    // replay for month 1 (deletes + creates derived rows), then the 2nd throws
    // — forcing the whole $transaction to roll back.
    type ReplayFn = (args: never) => Promise<Map<string, number>>;
    const internals = service as unknown as { replayMonth: ReplayFn };
    const protoInternals = CalculationEngineService.prototype as unknown as {
      replayMonth: ReplayFn;
    };
    let callCount = 0;
    const spy = jest.spyOn(internals, 'replayMonth').mockImplementation(async (args) => {
      callCount += 1;
      if (callCount >= 2) {
        throw new Error('INJECTED_ROLLBACK_FAILURE');
      }
      return protoInternals.replayMonth.call(service, args);
    });

    await expect(service.recalculateMonthAtomically(month1Id)).rejects.toThrow(
      'INJECTED_ROLLBACK_FAILURE',
    );

    spy.mockRestore();

    // Versions unchanged — the increment was rolled back.
    const m1After = await prisma.budgetMonth.findUnique({ where: { id: month1Id } });
    const m2After = await prisma.budgetMonth.findUnique({ where: { id: month2Id } });
    expect(m1After?.version).toBe(v1Before);
    expect(m2After?.version).toBe(v2Before);

    // Pre-existing snapshot survived (the delete was rolled back).
    const snapsAfter = await prisma.envelopeMonthSnapshot.findMany({
      where: { monthId: month1Id },
    });
    expect(snapsAfter).toHaveLength(1);
    expect(snapsAfter[0]?.closing).toBe(0);

    // No OperationResult rows leaked (none existed before; none after).
    const resultsAfter = await prisma.operationResult.findMany({
      where: { operation: { monthId: { in: [month1Id, month2Id] } } },
    });
    expect(resultsAfter).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // S3 — unknown month id
  // -------------------------------------------------------------------------

  it('S3: throws NotFoundException for an unknown month id', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000';
    await expect(service.recalculateMonthAtomically(unknownId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});