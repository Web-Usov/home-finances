import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from '../operations/operations.module';
import { ReportingModule } from './reporting.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB + real engine: GET /analytics/yearly (API-13) reads engine-written snapshots. */
describe('Yearly analytics (integration)', () => {
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
  const yearly = (query = '?year=2026') => http().get(`/api/v1/analytics/yearly${query}`);

  async function monthVersion(id: string): Promise<number> {
    return (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id } })).version;
  }

  async function allocate(period: string, monthId: string, allocations: Record<string, string>) {
    await http()
      .put(`/api/v1/months/${period}/allocations`)
      .send({ allocations, version: await monthVersion(monthId) })
      .expect(200);
  }

  async function addOperation(monthId: string, body: object) {
    await http()
      .post('/api/v1/operations')
      .send({ ...body, version: await monthVersion(monthId) })
      .expect(201);
  }

  /** Open 2026-01 (income 100 000, Food 50 000, Home 25 000) with a draft 2026-02 (income 90 000, Food 30 000). */
  async function setup() {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food', displayOrder: 0 });
    const home = await createEnvelope(t.prisma, { name: 'Home', displayOrder: 1 });
    await allocate('2026-01', jan.id, { [food.id]: '50000.00', [home.id]: '25000.00' });
    return { jan, food, home };
  }

  async function createFebruary(food: { id: string }) {
    const feb = (await http().post('/api/v1/months').send({ period: '2026-02', income: '90000.00' }).expect(201)).body
      .month;
    // month creation writes no snapshots; saving the allocation runs the cascade
    await allocate('2026-02', feb.id, { [food.id]: '30000.00' });
    return feb;
  }

  const row = (body: { envelopeBalances: { envelopes: { envelopeId: string }[] } }, id: string) =>
    body.envelopeBalances.envelopes.find((e) => e.envelopeId === id) as unknown as {
      status: string;
      archivedPeriod: string | null;
      months: { period: string; closing: string | null }[];
    };

  it('REP-01 / AC-20: response contains all three reports with 12 months', async () => {
    await setup();
    const body = (await yearly().expect(200)).body;
    expect(body.year).toBe('2026');
    expect(body.incomeReport.months.map((m: { period: string }) => m.period)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
    );
    expect(body.envelopeBalances.periods).toHaveLength(12);
    expect(body.envelopeBalances.envelopes[0].months).toHaveLength(12);
    expect(body.uncoveredOperations.months).toHaveLength(12);
    expect(body.incomeReport.totals).toBeDefined();
    expect(body.uncoveredOperations.totals).toBeDefined();
  });

  it('REP-02 / REP-03: income, allocated and free per month with yearly totals; missing months are null', async () => {
    const { food } = await setup();
    await createFebruary(food);
    const { incomeReport } = (await yearly().expect(200)).body;
    expect(incomeReport.months[0]).toEqual({
      period: '2026-01',
      status: 'open',
      income: '100000.00',
      allocated: '75000.00',
      free: '25000.00',
    });
    expect(incomeReport.months[1]).toMatchObject({ status: 'draft', income: '90000.00', allocated: '30000.00', free: '60000.00' });
    expect(incomeReport.months[2]).toEqual({ period: '2026-03', status: null, income: null, allocated: null, free: null });
    expect(incomeReport.totals).toEqual({ income: '190000.00', allocated: '105000.00', free: '85000.00' });
  });

  it('REP-03 / FIN-11: free is negative when allocations exceed income', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    // the allocation validation guards the API, so write the over-allocated state directly
    await t.prisma.allocation.create({ data: { monthId: jan.id, envelopeId: food.id, amountMinor: 12_000_000 } });
    const { incomeReport } = (await yearly().expect(200)).body;
    expect(incomeReport.months[0].free).toBe('-20000.00');
    expect(incomeReport.totals.free).toBe('-20000.00');
  });

  it('REP-04: free funds are historical and not added to envelope balances', async () => {
    const { jan, food, home } = await setup();
    await createFebruary(food);
    const body = (await yearly().expect(200)).body;
    // January free 25 000 and February free 60 000 stay in the income report only
    expect(body.incomeReport.months.map((m: { free: string | null }) => m.free).slice(0, 2)).toEqual(['25000.00', '60000.00']);
    expect(row(body, food.id).months.slice(0, 2).map((m) => m.closing)).toEqual(['50000.00', '80000.00']);
    expect(row(body, home.id).months.slice(0, 2).map((m) => m.closing)).toEqual(['25000.00', '25000.00']);
    const total = (id: string, i: number) => Number(row(body, id).months[i]?.closing);
    expect(total(food.id, 0) + total(home.id, 0)).toBe(75000); // = allocated, not allocated + free
    const month = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } });
    expect(month.incomeMinor).toBe(10_000_000);
  });

  it('REP-05: closing balances follow expenses and carry over to later months', async () => {
    const { jan, food } = await setup();
    await addOperation(jan.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '10000.00' });
    await createFebruary(food);
    const body = (await yearly().expect(200)).body;
    expect(row(body, food.id).months.slice(0, 3).map((m) => m.closing)).toEqual(['40000.00', '70000.00', null]);
  });

  it('REP-06 / ENV-12: archived envelopes are included and flagged', async () => {
    const { food, home } = await setup();
    await createFebruary(food);
    await t.prisma.envelope.update({ where: { id: home.id }, data: { status: 'archived', archivedPeriod: '2026-02' } });
    const body = (await yearly().expect(200)).body;
    expect(row(body, home.id)).toMatchObject({ status: 'archived', archivedPeriod: '2026-02' });
    expect(row(body, home.id).months[0]?.closing).toBe('25000.00');
    expect(row(body, food.id).status).toBe('active');
  });

  it('REP-08 / REP-09: uncovered amounts split by expense, transfer and negative adjustment', async () => {
    const { jan, food, home } = await setup();
    await addOperation(jan.id, { type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: food.id, amount: '20000.00' });
    // lowering Home's allocation makes the cascade leave 10 000 of that transfer uncovered (OP-09)
    await allocate('2026-01', jan.id, { [food.id]: '50000.00', [home.id]: '10000.00' });
    await addOperation(jan.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '1000.00' });
    await addOperation(jan.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '-', amount: '200.00' });
    const { uncoveredOperations } = (await yearly().expect(200)).body;
    expect(uncoveredOperations.months[0]).toMatchObject({
      period: '2026-01',
      exists: true,
      total: '11200.00',
      expense: '1000.00',
      transfer: '10000.00',
      adjustment: '200.00',
    });
    expect(uncoveredOperations.months[0].envelopes).toEqual([
      expect.objectContaining({ envelopeId: home.id, total: '11200.00', expense: '1000.00', transfer: '10000.00', adjustment: '200.00' }),
    ]);
    expect(uncoveredOperations.totals).toEqual({ total: '11200.00', expense: '1000.00', transfer: '10000.00', adjustment: '200.00' });
    expect(uncoveredOperations.months[5]).toMatchObject({ exists: false, total: '0.00' });
  });

  it('REP-10: every uncovered value carries a history drill-down key (period, envelope, type)', async () => {
    const { jan, home } = await setup();
    await addOperation(jan.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '30000.00' });
    const { uncoveredOperations } = (await yearly().expect(200)).body;
    const month = uncoveredOperations.months[0];
    expect(month.drillDown).toEqual({ period: '2026-01' });
    expect(month.drillDownByType).toEqual({
      expense: { period: '2026-01', type: 'expense' },
      transfer: { period: '2026-01', type: 'transfer' },
      adjustment: { period: '2026-01', type: 'adjustment' },
    });
    expect(month.envelopes[0].drillDown).toEqual({ period: '2026-01', envelopeId: home.id });
    // the keys are valid GET /operations filters (HIST-11) and lead to the uncovered operation
    const history = await http().get('/api/v1/operations').query(month.envelopes[0].drillDown).expect(200);
    expect(history.body.operations).toEqual([
      expect.objectContaining({ type: 'expense', sourceEnvelopeId: home.id, result: expect.objectContaining({ uncoveredMinor: 500_000 }) }),
    ]);
  });

  it('REP-11: uncovered amounts do not appear in later months', async () => {
    const { jan, food, home } = await setup();
    await addOperation(jan.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '30000.00' });
    await createFebruary(food);
    const body = (await yearly().expect(200)).body;
    expect(body.uncoveredOperations.months[0].total).toBe('5000.00');
    expect(body.uncoveredOperations.months[1]).toMatchObject({ exists: true, total: '0.00', envelopes: [] });
    // the shortfall is no debt: Home stays at 0 in January and is not reduced in February
    expect(row(body, home.id).months.slice(0, 2).map((m) => m.closing)).toEqual(['0.00', '0.00']);
    expect(body.uncoveredOperations.totals.total).toBe('5000.00');
  });

  it('API-13: a year without months returns empty entries, not an error', async () => {
    await setup();
    const body = (await yearly('?year=2030').expect(200)).body;
    expect(body.incomeReport.months.every((m: { income: string | null }) => m.income === null)).toBe(true);
    expect(body.incomeReport.totals).toEqual({ income: '0.00', allocated: '0.00', free: '0.00' });
    expect(body.envelopeBalances.envelopes).toEqual([]);
    expect(body.uncoveredOperations.totals.total).toBe('0.00');
  });

  it('API-13 / API-17: missing or invalid year returns 422 VALIDATION_ERROR', async () => {
    for (const query of ['', '?year=26', '?year=abcd', '?year=2026-01']) {
      const response = await yearly(query).expect(422);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }
  });
});
