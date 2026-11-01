import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from './operations.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB + real engine: how adjustments, transfers and the application order change balances (OP-04..OP-16, FIN-06). */
describe('Operations balance rules (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([OperationsModule, AllocationsModule, EnvelopesModule, MonthsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const versionOf = async (monthId: string) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: monthId } })).version;
  const resultOf = (operationId: string) => t.prisma.operationResult.findUniqueOrThrow({ where: { operationId } });

  /** Create an operation with the CURRENT month version; returns the API `data` (operation, result, summary). */
  async function addOperation(monthId: string, body: object) {
    const response = await http()
      .post('/api/v1/operations')
      .set('If-Match', etag(await versionOf(monthId)))
      .send({ ...body })
      .expect(201);
    return response.body.data as {
    operation: { id: string; sequenceNo: number; requestedMinor: number; comment: string | null };
    summary: { incomeMinor: number; totalAllocatedMinor: number; freeFundsMinor: number };
  };
  }

  async function allocate(monthId: string, period: string, allocations: Record<string, string>) {
    await http()
      .put(`/api/v1/months/${period}/allocations`)
      .set('If-Match', etag(await versionOf(monthId)))
      .send({ allocations })
      .expect(200);
  }

  /** Open 2026-01 (income 20 000 ₽); Food allocated `foodAmount`, Home allocated `homeAmount` (when given). */
  async function setup(foodAmount = '10000.00', homeAmount?: string) {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 2_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await allocate(month.id, '2026-01', {
      [food.id]: foodAmount,
      ...(homeAmount === undefined ? {} : { [home.id]: homeAmount }),
    });
    return { month, food, home };
  }

  it('OP-04: a negative adjustment stores the absolute amount, never drives the balance below zero and keeps the excess apart', async () => {
    const { month, food } = await setup();

    const within = await addOperation(month.id, { type: 'adjustment', sign: '-', sourceEnvelopeId: food.id, amount: '3000.00' });
    expect(within.operation.requestedMinor).toBe(300_000); // absolute value, not -300 000
    expect(await resultOf(within.operation.id)).toMatchObject({
      coveredMinor: 300_000,
      uncoveredMinor: 0,
      sourceBalanceAfter: 700_000,
    });

    const above = await addOperation(month.id, { type: 'adjustment', sign: '-', sourceEnvelopeId: food.id, amount: '9000.00' });
    expect(above.operation.requestedMinor).toBe(900_000);
    expect(await resultOf(above.operation.id)).toMatchObject({
      sourceBalanceBefore: 700_000,
      coveredMinor: 700_000,
      uncoveredMinor: 200_000, // the excess is stored separately
      sourceBalanceAfter: 0, // not below zero
    });

    // a separate indicator: applied adjustments only, not expenses, and the excess is not in it
    const snapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId: food.id },
    });
    expect(snapshot).toMatchObject({ adjustmentApplied: -1_000_000, expensesRequested: 0, closing: 0 });
  });

  it('OP-09: a transfer made uncovered by a cascade moves only the covered part from the source and the FULL amount to the destination', async () => {
    const { month, food, home } = await setup('10000.00', '1000.00');
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '10000.00',
    });
    expect(await resultOf(transfer.operation.id)).toMatchObject({ coveredMinor: 1_000_000, uncoveredMinor: 0 });

    // the past changes: only 6 000 ₽ are left in the source
    await allocate(month.id, '2026-01', { [food.id]: '6000.00', [home.id]: '1000.00' });

    expect((await t.prisma.operation.findUniqueOrThrow({ where: { id: transfer.operation.id } })).requestedMinor).toBe(
      1_000_000,
    );
    expect(await resultOf(transfer.operation.id)).toMatchObject({
      sourceBalanceBefore: 600_000,
      coveredMinor: 600_000, // min(source_balance_before, transfer_amount)
      uncoveredMinor: 400_000, // transfer_amount - covered, no debt created
      sourceBalanceAfter: 0, // source_balance_before - covered
      destinationBalanceAfter: 1_100_000, // destination_balance_before (1 000) + the whole 10 000
    });
  });

  it('OP-11: a later positive adjustment grows the envelope and is shown separately, income / allocation / free funds stay', async () => {
    const { month, food } = await setup('4000.00');
    const before = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } });

    const op = await addOperation(month.id, { type: 'adjustment', sign: '+', sourceEnvelopeId: food.id, amount: '2500.00' });

    expect(await resultOf(op.operation.id)).toMatchObject({ sourceBalanceBefore: 400_000, sourceBalanceAfter: 650_000 });
    const snapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId: food.id },
    });
    expect(snapshot).toMatchObject({ adjustmentApplied: 250_000, closing: 650_000 });
    expect(op.summary).toMatchObject({ incomeMinor: 2_000_000, totalAllocatedMinor: 400_000, freeFundsMinor: 1_600_000 });
    const after = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } });
    expect(after.incomeMinor).toBe(before.incomeMinor);
    const allocations = await t.prisma.allocation.findMany({ where: { monthId: month.id } });
    expect(allocations.map((a) => a.amountMinor)).toEqual([400_000]);
  });

  it('OP-13: the comment is optional for every adjustment sign and is kept when given', async () => {
    const { month, food } = await setup('4000.00');

    const plusNoComment = await addOperation(month.id, { type: 'adjustment', sign: '+', sourceEnvelopeId: food.id, amount: '1.00' });
    const minusNoComment = await addOperation(month.id, { type: 'adjustment', sign: '-', sourceEnvelopeId: food.id, amount: '1.00' });
    const plusWithComment = await addOperation(month.id, {
      type: 'adjustment',
      sign: '+',
      sourceEnvelopeId: food.id,
      amount: '1.00',
      comment: 'found cash',
    });
    const minusWithComment = await addOperation(month.id, {
      type: 'adjustment',
      sign: '-',
      sourceEnvelopeId: food.id,
      amount: '1.00',
      comment: 'lost cash',
    });

    expect([plusNoComment, minusNoComment].map((d) => d.operation.comment)).toEqual([null, null]);
    expect([plusWithComment, minusWithComment].map((d) => d.operation.comment)).toEqual(['found cash', 'lost cash']);
  });

  it('OP-15: the allocation is applied before every operation, whenever it was entered', async () => {
    const { month, food } = await setup('5000.00');
    const expense = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '8000.00' });
    expect(await resultOf(expense.operation.id)).toMatchObject({ sourceBalanceBefore: 500_000, uncoveredMinor: 300_000 });

    // the allocation is raised AFTER the operation was saved: the operation still sees it first
    await allocate(month.id, '2026-01', { [food.id]: '10000.00' });

    expect(await resultOf(expense.operation.id)).toMatchObject({
      sourceBalanceBefore: 1_000_000,
      coveredMinor: 800_000,
      uncoveredMinor: 0,
      sourceBalanceAfter: 200_000,
    });
  });

  it('OP-16: operations run in sequence_no order (order of adding), not in any other order', async () => {
    const { month, food, home } = await setup('10000.00');
    // Home has no money yet: the first expense is uncovered, the later transfer into Home cannot help it
    const expense = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '6000.00' });
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '10000.00',
    });
    const later = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '6000.00' });

    expect([expense, transfer, later].map((d) => d.operation.sequenceNo)).toEqual([1, 2, 3]);
    expect(await resultOf(expense.operation.id)).toMatchObject({ sourceBalanceBefore: 0, coveredMinor: 0, uncoveredMinor: 600_000 });
    expect(await resultOf(transfer.operation.id)).toMatchObject({ coveredMinor: 1_000_000, destinationBalanceAfter: 1_000_000 });
    expect(await resultOf(later.operation.id)).toMatchObject({
      sourceBalanceBefore: 1_000_000,
      coveredMinor: 600_000,
      sourceBalanceAfter: 400_000,
    });
  });

  it('FIN-06: a new operation recalculates the following month and bumps its version', async () => {
    const { month, food } = await setup('10000.00');
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'draft', incomeMinor: 0 });
    // the first operation builds the following month's snapshots
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '1000.00' });
    const febOpening = () =>
      t.prisma.envelopeMonthSnapshot
        .findFirstOrThrow({ where: { monthId: feb.id, envelopeId: food.id } })
        .then((s) => s.opening);
    expect(await febOpening()).toBe(900_000);
    const febVersion = await versionOf(feb.id);

    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '2500.00' });

    expect(await febOpening()).toBe(650_000);
    expect(await versionOf(feb.id)).toBe(febVersion + 1);
  });
});
