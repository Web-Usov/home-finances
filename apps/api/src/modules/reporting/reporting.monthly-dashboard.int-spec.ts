import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from '../operations/operations.module';
import { ReportingModule } from './reporting.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB + real engine: GET /dashboard/monthly (API-12) reads engine-written snapshots. */
describe('Monthly dashboard (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([ReportingModule, OperationsModule, AllocationsModule, EnvelopesModule, MonthsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const dashboard = (query = '') => http().get(`/api/v1/dashboard/monthly${query}`);

  async function monthVersion(id: string): Promise<number> {
    return (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id } })).version;
  }

  /** Open 2026-01 with income 100 000 ₽; Food 50 000 ₽ and Home 25 000 ₽ allocated through the API. */
  async function setup() {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food', displayOrder: 0 });
    const home = await createEnvelope(t.prisma, { name: 'Home', displayOrder: 1 });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '25000.00' }, version: month.version })
      .expect(200);
    return { month, food, home };
  }

  async function addOperation(monthId: string, body: object) {
    await http()
      .post('/api/v1/operations')
      .send({ ...body, version: await monthVersion(monthId) })
      .expect(201);
  }

  const envelopeOf = (body: { envelopes: { envelopeId: string }[] }, id: string) =>
    body.envelopes.find((e) => e.envelopeId === id);

  it('FIN-11 / AC-02: income 100000, allocated 75000 gives free 25000', async () => {
    const { month } = await setup();

    const response = await dashboard('?period=2026-01').expect(200);

    expect(response.body.month).toEqual({ id: month.id, period: '2026-01', status: 'open', version: expect.any(Number) });
    expect(response.body.summary).toMatchObject({ income: '100000.00', allocated: '75000.00', free: '25000.00' });
  });

  it('FIN-12: expenses, transfers and adjustments do not change free funds', async () => {
    const { month, food, home } = await setup();
    const before = (await dashboard('?period=2026-01').expect(200)).body.summary.free;

    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '1000.00' });
    await addOperation(month.id, { type: 'transfer', sourceEnvelopeId: food.id, destinationEnvelopeId: home.id, amount: '500.00' });
    await addOperation(month.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '+', amount: '300.00' });

    const after = (await dashboard('?period=2026-01').expect(200)).body.summary;
    expect(before).toBe('25000.00');
    expect(after.free).toBe('25000.00');
    expect(after.allocated).toBe('75000.00');
  });

  it('HIST-12 / AC-19: a transfer changes two balances but not replenished and spent', async () => {
    const { month, food, home } = await setup();
    const base = (await dashboard('?period=2026-01').expect(200)).body;

    await addOperation(month.id, { type: 'transfer', sourceEnvelopeId: food.id, destinationEnvelopeId: home.id, amount: '4000.00' });

    const body = (await dashboard('?period=2026-01').expect(200)).body;
    expect(envelopeOf(body, food.id)).toMatchObject({ closing: '46000.00', transfersOut: '4000.00', replenished: '50000.00', spent: '0.00' });
    expect(envelopeOf(body, home.id)).toMatchObject({ closing: '29000.00', transfersIn: '4000.00', replenished: '25000.00', spent: '0.00' });
    expect(body.summary.replenished).toBe(base.summary.replenished);
    expect(body.summary.replenished).toBe('75000.00');
    expect(body.summary.spent).toBe('0.00');
    expect(body.summary.adjustmentsApplied).toBe('0.00');
  });

  it('UI-09: adjustments are reported as a separate indicator', async () => {
    const { month, food, home } = await setup();
    await addOperation(month.id, { type: 'adjustment', sourceEnvelopeId: food.id, sign: '-', amount: '1000.00' });
    await addOperation(month.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '+', amount: '250.50' });
    await addOperation(month.id, { type: 'adjustment', sourceEnvelopeId: food.id, sign: '-', amount: '500.00' });

    const body = (await dashboard('?period=2026-01').expect(200)).body;

    expect(body.summary.adjustmentsApplied).toBe('-1249.50');
    expect(envelopeOf(body, food.id)).toMatchObject({ adjustmentApplied: '-1500.00', closing: '48500.00' });
    expect(envelopeOf(body, home.id)).toMatchObject({ adjustmentApplied: '250.50', closing: '25250.50' });
    // not mixed into income, allocation, replenished or spent
    expect(body.summary).toMatchObject({ income: '100000.00', allocated: '75000.00', replenished: '75000.00', spent: '0.00' });
  });

  it('OP-01: spent includes the uncovered part of an expense', async () => {
    const { month, home } = await setup();

    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '30000.00' });

    const body = (await dashboard('?period=2026-01').expect(200)).body;
    expect(envelopeOf(body, home.id)).toMatchObject({
      spent: '30000.00',
      expensesCovered: '25000.00',
      closing: '0.00',
      uncovered: { total: '5000.00', expense: '5000.00', transfer: '0.00', adjustment: '0.00' },
    });
    expect(body.summary.spent).toBe('30000.00');
    expect(body.summary.uncovered).toEqual({ total: '5000.00', expense: '5000.00', transfer: '0.00', adjustment: '0.00' });
  });

  it('UI-07: uncovered total is broken down by type across envelopes', async () => {
    const { month, food, home } = await setup();
    await addOperation(month.id, { type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: food.id, amount: '20000.00' });
    // lowering Home's allocation makes the cascade leave 10 000 of that transfer uncovered (OP-09)
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '10000.00' }, version: await monthVersion(month.id) })
      .expect(200);
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '1000.00' });
    await addOperation(month.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '-', amount: '200.00' });

    const body = (await dashboard('?period=2026-01').expect(200)).body;

    expect(body.summary.uncovered).toEqual({ total: '11200.00', expense: '1000.00', transfer: '10000.00', adjustment: '200.00' });
    expect(envelopeOf(body, home.id)).toMatchObject({ closing: '0.00', uncovered: { total: '11200.00' } });
  });

  it('UI-08: envelopes carry closing, allocation inflow and full expenses, including envelopes with no movement', async () => {
    const { month, food } = await setup();
    const idle = await createEnvelope(t.prisma, { name: 'Idle', displayOrder: 2 });
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '12000.00' });

    const body = (await dashboard('?period=2026-01').expect(200)).body;

    expect(body.envelopes.map((e: { name: string }) => e.name)).toEqual(['Food', 'Home', 'Idle']);
    expect(envelopeOf(body, food.id)).toMatchObject({ opening: '0.00', replenished: '50000.00', spent: '12000.00', closing: '38000.00' });
    expect(envelopeOf(body, idle.id)).toMatchObject({ closing: '0.00', replenished: '0.00', spent: '0.00', status: 'active' });
  });

  it('UI-08 / DATA-06: a later month shows opening carried over and its own allocation inflow', async () => {
    const { month, food } = await setup();
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '10000.00' });
    const next = (await http().post('/api/v1/months').send({ period: '2026-02', income: '100000.00' }).expect(201)).body.month;
    // month creation writes no snapshots; saving the allocation runs the cascade
    await http()
      .put('/api/v1/months/2026-02/allocations')
      .send({ allocations: { [food.id]: '30000.00' }, version: await monthVersion(next.id) })
      .expect(200);

    const body = (await dashboard('?period=2026-02').expect(200)).body;

    expect(body.month.status).toBe('draft');
    expect(body.month.id).toBe(next.id);
    expect(envelopeOf(body, food.id)).toMatchObject({ opening: '40000.00', replenished: '30000.00', closing: '70000.00', spent: '0.00' });
  });

  it('API-12: period defaults to the working month (open before draft)', async () => {
    await setup();
    await http().post('/api/v1/months').send({ period: '2026-02' }).expect(201);

    const body = (await dashboard().expect(200)).body;

    expect(body.month).toMatchObject({ period: '2026-01', status: 'open' });
  });

  it('API-12: unknown period returns 404 MONTH_NOT_FOUND; no months at all returns 404 too', async () => {
    const empty = await dashboard().expect(404);
    expect(empty.body.error).toBe('MONTH_NOT_FOUND');

    await setup();
    const unknown = await dashboard('?period=2030-05').expect(404);
    expect(unknown.body.error).toBe('MONTH_NOT_FOUND');
  });

  it('API-12 / API-17: invalid period returns 422 VALIDATION_ERROR', async () => {
    const response = await dashboard('?period=2026-1').expect(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('CALC-12: an archived envelope that still holds a balance yields a warning', async () => {
    const { food } = await setup();
    await t.prisma.envelope.update({ where: { id: food.id }, data: { status: 'archived', archivedPeriod: '2026-01' } });

    const body = (await dashboard('?period=2026-01').expect(200)).body;

    expect(body.warnings).toEqual([expect.objectContaining({ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE' })]);
    expect(envelopeOf(body, food.id)).toMatchObject({ status: 'archived', closing: '50000.00' });
  });
});
