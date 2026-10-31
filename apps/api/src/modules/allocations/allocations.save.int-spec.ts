import request from 'supertest';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from '../operations/operations.module';
import { AllocationsModule } from './allocations.module';
import { createAllocation, createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB + real engine: PUT /months/:period/allocations (API-04, API-22) and the shared summary shape. */
describe('Allocations save and month mutation response shape (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([AllocationsModule, MonthsModule, OperationsModule, EnvelopesModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const put = (period: string, body: object) =>
    http().put(`/api/v1/months/${period}/allocations`).send(body);

  const SUMMARY_KEYS = ['freeFundsMinor', 'id', 'incomeMinor', 'period', 'status', 'totalAllocatedMinor', 'version'];

  /** Open 2026-01 (income 10 000 ₽, version 1) with two envelopes and no allocation. */
  async function setup() {
    const month = await createMonth(t.prisma, { period: '2026-01', status: 'open', incomeMinor: 1_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    return { month, food, home };
  }

  const monthRow = (id: string) => t.prisma.budgetMonth.findUniqueOrThrow({ where: { id } });

  it('API-22 / API-16: PATCH months, PUT allocations and POST/PATCH/DELETE operations return data.summary of MonthSummary', async () => {
    const { month, food } = await setup();

    const income = await http()
      .patch('/api/v1/months/2026-01')
      .send({ income: '20000.00', version: month.version })
      .expect(200);
    expect(Object.keys(income.body.data)).toEqual(['summary']);
    expect(Object.keys(income.body.data.summary).sort()).toEqual(SUMMARY_KEYS);
    expect(income.body.data.summary).toMatchObject({ id: month.id, incomeMinor: 2_000_000, status: 'open' });
    expect(income.body.warnings).toEqual([]);

    const allocations = await put('2026-01', {
      allocations: { [food.id]: '5000.00' },
      version: income.body.data.summary.version,
    }).expect(200);
    expect(Object.keys(allocations.body.data)).toEqual(['summary']);
    expect(Object.keys(allocations.body.data.summary).sort()).toEqual(SUMMARY_KEYS);
    expect(allocations.body.data.summary).toMatchObject({
      id: month.id,
      totalAllocatedMinor: 500_000,
      freeFundsMinor: 1_500_000,
      version: income.body.data.summary.version + 1,
    });

    const created = await http()
      .post('/api/v1/operations')
      .send({
        type: 'expense',
        sourceEnvelopeId: food.id,
        amount: '100.00',
        version: allocations.body.data.summary.version,
      })
      .expect(201);
    expect(Object.keys(created.body.data.summary).sort()).toEqual(SUMMARY_KEYS);

    const operationId = created.body.data.operation.id as string;
    const patched = await http()
      .patch(`/api/v1/operations/${operationId}`)
      .send({ amount: '200.00', version: created.body.data.summary.version })
      .expect(200);
    expect(Object.keys(patched.body.data.summary).sort()).toEqual(SUMMARY_KEYS);

    const deleted = await http()
      .delete(`/api/v1/operations/${operationId}?version=${patched.body.data.summary.version}`)
      .expect(200);
    expect(Object.keys(deleted.body.data)).toEqual(['summary']);
    expect(Object.keys(deleted.body.data.summary).sort()).toEqual(SUMMARY_KEYS);
  });

  it('API-22: PUT allocations response has no envelope snapshots', async () => {
    const { month, food, home } = await setup();

    const response = await put('2026-01', {
      allocations: { [food.id]: '3000.00', [home.id]: '2000.00' },
      version: month.version,
    }).expect(200);

    expect(response.body.data).not.toHaveProperty('envelopes');
    expect(response.body.data.summary).not.toHaveProperty('envelopes');
    expect(JSON.stringify(response.body)).not.toMatch(/envelopeName|closing|opening/);
    expect(response.body.data.summary).toMatchObject({ totalAllocatedMinor: 500_000, freeFundsMinor: 500_000 });
  });

  it('FIN-02 / UI-11 / API-04: income and allocations are saved atomically, version bumps once, one recalculation', async () => {
    const { month, food, home } = await setup();
    const recalc = jest.spyOn(t.app.get(CalculationEngineService), 'recalculateMonthAtomically');

    const response = await put('2026-01', {
      allocations: { [food.id]: '15000.00', [home.id]: '5000.00' },
      income: '20000.00', // above the stored 10 000.00: valid only against the NEW income
      version: month.version,
    }).expect(200);

    expect(response.body.warnings).toEqual([]);
    expect(response.body.data.summary).toMatchObject({
      incomeMinor: 2_000_000,
      totalAllocatedMinor: 2_000_000,
      freeFundsMinor: 0,
      version: month.version + 1,
    });
    expect(recalc).toHaveBeenCalledTimes(1);
    const row = await monthRow(month.id);
    expect(row).toMatchObject({ incomeMinor: 2_000_000, version: month.version + 1 });
    const stored = await t.prisma.allocation.findMany({ where: { monthId: month.id } });
    expect(Object.fromEntries(stored.map((a) => [a.envelopeId, a.amountMinor]))).toEqual({
      [food.id]: 1_500_000,
      [home.id]: 500_000,
    });
  });

  it('FIN-02: income and allocations may be lowered together below the previous allocation', async () => {
    const { month, food } = await setup();
    await createAllocation(t.prisma, { monthId: month.id, envelopeId: food.id, amountMinor: 1_000_000 });

    const response = await put('2026-01', {
      allocations: { [food.id]: '100.00' },
      income: '500.00',
      version: month.version,
    }).expect(200);

    expect(response.body.data.summary).toMatchObject({ incomeMinor: 50_000, totalAllocatedMinor: 10_000 });
  });

  it('FIN-02 / MSG-01: allocations above the NEW income return 422 and nothing is saved', async () => {
    const { month, food, home } = await setup();
    await createAllocation(t.prisma, { monthId: month.id, envelopeId: food.id, amountMinor: 400_000 });

    const response = await put('2026-01', {
      allocations: { [food.id]: '6000.00', [home.id]: '3000.01' }, // 9 000.01 fits the old income, not the new one
      income: '8000.00',
      version: month.version,
    }).expect(422);

    expect(response.body).toEqual({
      error: 'ALLOCATION_EXCEEDS_INCOME',
      message: 'Распределено на 1000.01 ₽ больше дохода. Уменьшите суммы по конвертам.',
    });
    expect(await monthRow(month.id)).toMatchObject({ incomeMinor: 1_000_000, version: month.version });
    const stored = await t.prisma.allocation.findMany({ where: { monthId: month.id } });
    expect(stored.map((a) => [a.envelopeId, a.amountMinor])).toEqual([[food.id, 400_000]]);
  });

  it('ADR 0005: income + allocations with a stale version return 409 VERSION_CONFLICT and change nothing', async () => {
    const { month, food } = await setup();

    const response = await put('2026-01', {
      allocations: { [food.id]: '100.00' },
      income: '9000.00',
      version: month.version + 1,
    }).expect(409);

    expect(response.body.error).toBe('VERSION_CONFLICT');
    expect(await monthRow(month.id)).toMatchObject({ incomeMinor: 1_000_000, version: month.version });
    expect(await t.prisma.allocation.count()).toBe(0);
  });

  it('MON-03: income + allocations into a closed month return 409 MONTH_LOCKED and change nothing', async () => {
    const closed = await createMonth(t.prisma, { period: '2025-12', status: 'closed', incomeMinor: 1_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });

    const response = await put('2025-12', {
      allocations: { [food.id]: '100.00' },
      income: '9000.00',
      version: closed.version,
    }).expect(409);

    expect(response.body.error).toBe('MONTH_LOCKED');
    expect(await monthRow(closed.id)).toMatchObject({ incomeMinor: 1_000_000, version: closed.version });
  });

  it('API-04: the request without `income` keeps the stored income', async () => {
    const { month, food } = await setup();

    const response = await put('2026-01', { allocations: { [food.id]: '100.00' }, version: month.version }).expect(200);

    expect(response.body.data.summary.incomeMinor).toBe(1_000_000);
    expect(await monthRow(month.id)).toMatchObject({ incomeMinor: 1_000_000 });
  });

  it('VALIDATION_ERROR: a malformed `income` returns 422 and changes nothing', async () => {
    const { month, food } = await setup();

    const response = await put('2026-01', {
      allocations: { [food.id]: '100.00' },
      income: '10,5',
      version: month.version,
    }).expect(422);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(await monthRow(month.id)).toMatchObject({ incomeMinor: 1_000_000, version: month.version });
  });
});
