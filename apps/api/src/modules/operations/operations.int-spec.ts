import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { OperationsModule } from './operations.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB + real engine: POST/GET /operations (API-10) with the cascade in one transaction. */
describe('Operations list and create (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([OperationsModule, AllocationsModule, EnvelopesModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const post = (body: object) => http().post('/api/v1/operations').send(body);

  /** Open 2026-01 month (income 10 000 ₽) with an envelope allocated `allocatedMinor`, via the API. */
  async function setup(allocatedMinor = 1_000_000, monthOverrides: Parameters<typeof createMonth>[1] = {}) {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 1_000_000, ...monthOverrides });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    const amount = (allocatedMinor / 100).toFixed(2);
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .send({ allocations: { [food.id]: amount }, version: month.version })
      .expect(200);
    const fresh = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } });
    return { month: fresh, food, home };
  }

  it('OP-05 / AC-05: expense within balance leaves 7000', async () => {
    const { month, food } = await setup();

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '3000.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.result).toMatchObject({
      coveredMinor: 300_000,
      uncoveredMinor: 0,
      sourceBalanceBefore: 1_000_000,
      sourceBalanceAfter: 700_000,
    });
    expect(response.body.warnings).toEqual([]);
  });

  it('OP-05 / AC-06: expense above balance is saved in full, covered 10000, uncovered 5000', async () => {
    const { month, food } = await setup();

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '15000.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.operation.requestedMinor).toBe(1_500_000);
    expect(response.body.data.result).toMatchObject({
      coveredMinor: 1_000_000,
      uncoveredMinor: 500_000,
      sourceBalanceAfter: 0,
    });
    expect(response.body.warnings.map((w: { code: string }) => w.code)).toEqual(['EXPENSE_EXCEEDS_BALANCE']);
  });

  it('API-15 / API-16 / ADR 0005: response carries the fresh month summary; version is bumped in the DB', async () => {
    const { month, food } = await setup();

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '1.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.summary).toEqual({
      id: month.id,
      period: '2026-01',
      status: 'open',
      incomeMinor: 1_000_000,
      version: month.version + 1,
      totalAllocatedMinor: 1_000_000,
      freeFundsMinor: 0,
    });
    const row = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } });
    expect(row.version).toBe(month.version + 1);
  });

  it('OP-07 / AC-07: transfer above available balance is rejected with TRANSFER_EXCEEDS_BALANCE', async () => {
    const { month, food, home } = await setup(600_000);

    const response = await post({
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '10000.00',
      version: month.version,
    }).expect(409);

    expect(response.body).toEqual({
      error: 'TRANSFER_EXCEEDS_BALANCE',
      message: 'Доступно 6\u00A0000,00 ₽. Перевести только 6\u00A0000,00 ₽?',
    });
    expect(await t.prisma.operation.count()).toBe(0);
    expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } })).version).toBe(month.version);
  });

  it('OP-02: a covered transfer moves money from source to destination', async () => {
    const { month, food, home } = await setup(600_000);

    const response = await post({
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '2000.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.result).toMatchObject({
      coveredMinor: 200_000,
      uncoveredMinor: 0,
      sourceBalanceAfter: 400_000,
      destinationBalanceAfter: 200_000,
    });
  });

  it('OP-03 / AC-09: positive adjustment increases balance and leaves income and free funds unchanged', async () => {
    const { month, food } = await setup(1_000_000);

    const response = await post({
      type: 'adjustment',
      sign: '+',
      sourceEnvelopeId: food.id,
      amount: '5000.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.result).toMatchObject({
      sourceBalanceBefore: 1_000_000,
      sourceBalanceAfter: 1_500_000,
    });
    expect(response.body.data.summary).toMatchObject({ incomeMinor: 1_000_000, freeFundsMinor: 0 });
    expect(response.body.warnings).toEqual([]);
  });

  it('OP-14 / AC-10: negative adjustment above balance applies only the balance', async () => {
    const { month, food } = await setup(1_000_000);

    const response = await post({
      type: 'adjustment',
      sign: '-',
      sourceEnvelopeId: food.id,
      amount: '15000.00',
      version: month.version,
    }).expect(201);

    expect(response.body.data.result).toMatchObject({
      coveredMinor: 1_000_000,
      uncoveredMinor: 500_000,
      sourceBalanceAfter: 0,
    });
    expect(response.body.warnings.map((w: { code: string }) => w.code)).toEqual(['ADJUSTMENT_EXCEEDS_BALANCE']);
    const snapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId: food.id },
    });
    expect(snapshot.adjustmentApplied).toBe(-1_000_000);
  });

  it('OP-10 / AC-11: initial balance is not part of month indicators', async () => {
    const month = await createMonth(t.prisma, { period: '2026-01' });
    const created = await http()
      .post('/api/v1/envelopes')
      .send({ name: 'Еда', initialBalance: '1500.00' })
      .expect(201);
    const envelopeId = created.body.envelope.id as string;
    const version = (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } })).version;

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: envelopeId,
      amount: '500.00',
      version,
    }).expect(201);

    // the initial balance feeds the balance...
    expect(response.body.data.result).toMatchObject({ sourceBalanceBefore: 150_000, sourceBalanceAfter: 100_000 });
    // ...but not the monthly indicators
    const snapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: month.id, envelopeId },
    });
    expect(snapshot).toMatchObject({ initial: 150_000, adjustmentApplied: 0, expensesRequested: 50_000 });
    expect(response.body.data.summary.freeFundsMinor).toBe(1_000_000);
  });

  it('OP-17: new operation gets the next sequence_no', async () => {
    const { month, food } = await setup();

    const first = await post({ type: 'expense', sourceEnvelopeId: food.id, amount: '1.00', version: month.version }).expect(201);
    const second = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '2.00',
      version: first.body.data.summary.version,
    }).expect(201);

    expect(first.body.data.operation.sequenceNo).toBe(1);
    expect(second.body.data.operation.sequenceNo).toBe(2);
  });

  it('HIST-10: create in a closed month returns MONTH_LOCKED', async () => {
    const { month, food } = await setup();
    await t.prisma.budgetMonth.update({ where: { id: month.id }, data: { status: 'closed' } });

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '1.00',
      version: month.version,
    }).expect(409);

    expect(response.body.error).toBe('MONTH_LOCKED');
    expect(await t.prisma.operation.count()).toBe(0);
  });

  it('DATA-12: stale version returns 409 VERSION_CONFLICT and writes nothing', async () => {
    const { month, food } = await setup();

    const response = await post({
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '1.00',
      version: month.version - 1,
    }).expect(409);

    expect(response.body.error).toBe('VERSION_CONFLICT');
    expect(await t.prisma.operation.count()).toBe(0);
  });

  it('DATA-12: of two concurrent creations with the same version exactly one wins', async () => {
    const { month, food } = await setup();
    const body = { type: 'expense', sourceEnvelopeId: food.id, amount: '1.00', version: month.version };

    const [a, b] = await Promise.all([post(body), post(body)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await t.prisma.operation.count()).toBe(1);
  });

  it('DATA-11: unknown envelope returns 404 ENVELOPE_NOT_FOUND; no month returns 404 MONTH_NOT_FOUND', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const noMonth = await post({ type: 'expense', sourceEnvelopeId: missing, amount: '1.00', version: 1 }).expect(404);
    expect(noMonth.body.error).toBe('MONTH_NOT_FOUND');

    const { month } = await setup();
    const response = await post({
      type: 'expense',
      sourceEnvelopeId: missing,
      amount: '1.00',
      version: month.version,
    }).expect(404);
    expect(response.body.error).toBe('ENVELOPE_NOT_FOUND');
  });

  it('API-17 / DATA-09: invalid bodies return 422 VALIDATION_ERROR', async () => {
    const { month, food } = await setup();
    const base = { sourceEnvelopeId: food.id, amount: '1.00', version: month.version };

    const bodies = [
      { ...base, type: 'expense', amount: 'abc' },
      { ...base, type: 'expense', amount: '-5.00' },
      { type: 'expense', sourceEnvelopeId: food.id, amount: '1.00' }, // no version
      { ...base, type: 'transfer' }, // no destination
      { ...base, type: 'transfer', destinationEnvelopeId: food.id }, // same envelope
      { ...base, type: 'adjustment' }, // no sign
      { ...base, type: 'initial_balance' }, // OP-10: only with envelope creation
      { ...base, type: 'expense', comment: 'x'.repeat(501) }, // HIST-05
    ];
    for (const body of bodies) {
      const response = await post(body).expect(422);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }
    expect(await t.prisma.operation.count()).toBe(0);
  });

  describe('GET /operations (HIST-11)', () => {
    async function seed() {
      const { month, food, home } = await setup(600_000);
      const v1 = await post({ type: 'expense', sourceEnvelopeId: food.id, amount: '10.00', version: month.version }).expect(201);
      const v2 = await post({
        type: 'transfer',
        sourceEnvelopeId: food.id,
        destinationEnvelopeId: home.id,
        amount: '20.00',
        version: v1.body.data.summary.version,
      }).expect(201);
      await post({
        type: 'adjustment',
        sign: '+',
        sourceEnvelopeId: home.id,
        amount: '30.00',
        version: v2.body.data.summary.version,
      }).expect(201);
      return { food, home };
    }

    it('HIST-11: returns operations in sequence order with results and period', async () => {
      await seed();

      const response = await http().get('/api/v1/operations').expect(200);

      const ops = response.body.operations;
      expect(ops.map((o: { type: string }) => o.type)).toEqual(['expense', 'transfer', 'adjustment']);
      expect(ops.map((o: { sequenceNo: number }) => o.sequenceNo)).toEqual([1, 2, 3]);
      expect(ops[0]).toMatchObject({ period: '2026-01', requestedMinor: 1_000 });
      expect(ops[0].result).toMatchObject({ coveredMinor: 1_000, uncoveredMinor: 0 });
    });

    it('HIST-11: filters by type, envelope (either side of a transfer) and period', async () => {
      const { home } = await seed();

      const byType = await http().get('/api/v1/operations?type=transfer').expect(200);
      expect(byType.body.operations).toHaveLength(1);

      const byEnvelope = await http().get(`/api/v1/operations?envelopeId=${home.id}`).expect(200);
      expect(byEnvelope.body.operations.map((o: { type: string }) => o.type)).toEqual(['transfer', 'adjustment']);

      const otherPeriod = await http().get('/api/v1/operations?period=2025-12').expect(200);
      expect(otherPeriod.body.operations).toEqual([]);
      const samePeriod = await http().get('/api/v1/operations?period=2026-01&type=expense').expect(200);
      expect(samePeriod.body.operations).toHaveLength(1);
    });

    it('HIST-11 / API-17: malformed filters return 422 VALIDATION_ERROR', async () => {
      for (const query of ['period=2026-1', 'type=gift', 'envelopeId=not-a-uuid']) {
        const response = await http().get(`/api/v1/operations?${query}`).expect(422);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
    });
  });
});
