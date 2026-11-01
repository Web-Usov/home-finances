import request from 'supertest';
import { AllocationsModule } from '../modules/allocations/allocations.module';
import { CalculationEngineService } from '../modules/calculation-engine/calculation-engine.service';
import { EnvelopesModule } from '../modules/envelopes/envelopes.module';
import { MonthsModule } from '../modules/months/months.module';
import { OperationsModule } from '../modules/operations/operations.module';
import { ReportingModule } from '../modules/reporting/reporting.module';
import { createEnvelope, createMonth, resetDb } from '../../test/db';
import { createTestApp, TestApp, etag } from '../../test/http';

const MODULES = [MonthsModule, AllocationsModule, EnvelopesModule, OperationsModule, ReportingModule];

/**
 * API-level acceptance scenarios (DOD-02) for the ACs that no lower-level test proves end to end. Everything runs over
 * HTTP against the real database and the real calculation engine. ACs proved elsewhere carry their id in the test name
 * there (`pnpm spec:check --verbose` lists the coverage); the UI-only AC is listed in scripts/spec-coverage-deferred.json.
 */
describe('MVP acceptance scenarios (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp(MODULES);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const versionOf = async (period: string) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } })).version;
  const allocate = async (period: string, allocations: Record<string, string>) =>
    http().put(`/api/v1/months/${period}/allocations`).set('If-Match', etag(await versionOf(period))).send({ allocations });
  const operate = async (period: string, body: object) =>
    http()
      .post('/api/v1/operations')
      .set('If-Match', etag(await versionOf(period)))
      .send({ ...body });
  const balances = async () =>
    Object.fromEntries(
      (await http().get('/api/v1/envelopes').expect(200)).body.envelopes.map(
        (e: { name: string; balanceMinor: number }) => [e.name, e.balanceMinor],
      ),
    );

  it('AC-01: first launch: choose the start month, create envelopes with current balances, get an open month without past history', async () => {
    const month = await http().post('/api/v1/months').send({ period: '2026-03', income: '100000.00' }).expect(201);
    expect(month.body.month).toMatchObject({ period: '2026-03', status: 'open', incomeMinor: 10_000_000 });

    await http().post('/api/v1/envelopes').send({ name: 'Еда', initialBalance: '15000.00' }).expect(201);
    await http().post('/api/v1/envelopes').send({ name: 'Дом', initialBalance: '2500.50' }).expect(201);
    await http().post('/api/v1/envelopes').send({ name: 'Отпуск' }).expect(201);

    expect(await balances()).toEqual({ Еда: 1_500_000, Дом: 250_050, Отпуск: 0 });
    // no past history is restored: one month, only the initial-balance operations of the start month
    expect(await t.prisma.budgetMonth.findMany({ select: { period: true, status: true } })).toEqual([
      { period: '2026-03', status: 'open' },
    ]);
    expect((await t.prisma.operation.findMany()).map((o) => [o.type, o.isInitial])).toEqual([
      ['initial_balance', true],
      ['initial_balance', true],
    ]);
    const months = (await http().get('/api/v1/months').expect(200)).body.months;
    expect(months).toHaveLength(1);
    // the start balances are not month income/spend indicators
    const dash = await http().get('/api/v1/dashboard/monthly?period=2026-03').expect(200);
    expect(dash.body.summary).toMatchObject({ income: '100000.00', allocated: '0.00', free: '100000.00' });
  });

  it('AC-03: income 100000, distribution 100000.01 is not saved and the excess 0.01 is shown', async () => {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await allocate('2026-01', { [food.id]: '40000.00', [home.id]: '60000.00' }).then((r) => expect(r.status).toBe(200));
    const before = await versionOf('2026-01');

    const response = await allocate('2026-01', { [food.id]: '40000.01', [home.id]: '60000.00' });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('ALLOCATION_EXCEEDS_INCOME');
    expect(response.body.message).toContain('0,01 ₽');
    const saved = await t.prisma.allocation.findMany({ where: { monthId: month.id }, orderBy: { amountMinor: 'asc' } });
    expect(saved.map((a) => a.amountMinor)).toEqual([4_000_000, 6_000_000]);
    expect(await versionOf('2026-01')).toBe(before);
  });

  it('AC-04: the next month gets the previous distribution as an editable draft', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await allocate('2026-01', { [food.id]: '50000.00', [home.id]: '25000.00' }).then((r) => expect(r.status).toBe(200));

    const created = await http().post('/api/v1/months').send({ period: '2026-02', income: '100000.00' }).expect(201);

    expect(created.body.month).toMatchObject({ period: '2026-02', status: 'draft' });
    const copied = await t.prisma.allocation.findMany({ where: { month: { period: '2026-02' } } });
    expect(Object.fromEntries(copied.map((a) => [a.envelopeId, a.amountMinor]))).toEqual({
      [food.id]: 5_000_000,
      [home.id]: 2_500_000,
    });
    // the source month keeps its own distribution
    expect(await t.prisma.allocation.count({ where: { monthId: jan.id } })).toBe(2);
    // the copy is a draft that can be edited
    await allocate('2026-02', { [food.id]: '60000.00', [home.id]: '25000.00' }).then((r) => expect(r.status).toBe(200));
    const edited = await t.prisma.allocation.findFirstOrThrow({
      where: { month: { period: '2026-02' }, envelopeId: food.id },
    });
    expect(edited.amountMinor).toBe(6_000_000);
    expect(
      (await t.prisma.allocation.findFirstOrThrow({ where: { monthId: jan.id, envelopeId: food.id } })).amountMinor,
    ).toBe(5_000_000);
  });

  it('AC-14: after closing, income, distribution, expense, transfer, adjustment and envelope management are locked', async () => {
    await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await allocate('2026-01', { [food.id]: '5000.00', [home.id]: '0.00' }).then((r) => expect(r.status).toBe(200));
    await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await versionOf('2026-01')))
      .expect(200);
    const version = await versionOf('2026-01');
    const operationsBefore = await t.prisma.operation.count();

    // concurrent on purpose: all seven are rejected by the same lock-protected closed-month check. They go through the
    // listened server (t.listen): supertest on the unlistened one fails parallel requests with ECONNRESET.
    const live = request(await t.listen());
    const operateLive = (body: object) => live.post('/api/v1/operations').set('If-Match', etag(version)).send({ ...body });
    const attempts = [
      () => live.patch('/api/v1/months/2026-01').set('If-Match', etag(version)).send({ income: '1.00' }),
      () => live.put('/api/v1/months/2026-01/allocations').set('If-Match', etag(version)).send({ allocations: { [food.id]: '1.00' } }),
      () => operateLive({ type: 'expense', sourceEnvelopeId: food.id, amount: '1.00' }),
      () => operateLive({
        type: 'transfer',
        sourceEnvelopeId: food.id,
        destinationEnvelopeId: home.id,
        amount: '1.00',
      }),
      () => operateLive({ type: 'adjustment', sign: '+', sourceEnvelopeId: food.id, amount: '1.00' }),
      () => live.post('/api/v1/envelopes').send({ name: 'New', initialBalance: '10.00' }),
      () => live.post(`/api/v1/envelopes/${home.id}/archive`).send({}),
    ];
    const responses = await Promise.all(attempts.map((attempt) => attempt()));

    expect(responses.map((r) => [r.status, r.body.error])).toEqual(responses.map(() => [409, 'MONTH_LOCKED']));
    expect(responses).toHaveLength(7);
    expect(await t.prisma.operation.count()).toBe(operationsBefore);
    expect(await t.prisma.envelope.count()).toBe(2);
    expect((await t.prisma.envelope.findUniqueOrThrow({ where: { id: home.id } })).status).toBe('active');
    expect(await versionOf('2026-01')).toBe(version);
  });

  it('AC-18: an envelope with a non-zero balance is not archived; with a zero balance it is archived and stays in analytics', async () => {
    await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const full = (await http().post('/api/v1/envelopes').send({ name: 'Full', initialBalance: '100.00' }).expect(201))
      .body.envelope;
    const empty = (await http().post('/api/v1/envelopes').send({ name: 'Empty' }).expect(201)).body.envelope;
    await allocate('2026-01', { [empty.id]: '300.00' }).then((r) => expect(r.status).toBe(200));
    await operate('2026-01', { type: 'expense', sourceEnvelopeId: empty.id, amount: '300.00' }).then((r) =>
      expect(r.status).toBe(201),
    );

    const refused = await http().post(`/api/v1/envelopes/${full.id}/archive`).send({}).expect(409);
    expect(refused.body.error).toBe('ENVELOPE_NOT_EMPTY');
    expect((await t.prisma.envelope.findUniqueOrThrow({ where: { id: full.id } })).status).toBe('active');

    const archived = await http().post(`/api/v1/envelopes/${empty.id}/archive`).send({}).expect(201);
    expect(archived.body.envelope).toMatchObject({ status: 'archived', archivedPeriod: '2026-01' });

    // history and analytics keep the archived envelope
    const yearly = (await http().get('/api/v1/analytics/yearly?year=2026').expect(200)).body;
    const row = yearly.envelopeBalances.envelopes.find((e: { envelopeId: string }) => e.envelopeId === empty.id);
    expect(row).toMatchObject({ status: 'archived', archivedPeriod: '2026-01' });
    expect(row.months[0].closing).toBe('0.00');
    const history = (await http().get('/api/v1/operations?period=2026-01').expect(200)).body;
    expect(JSON.stringify(history)).toContain(empty.id);
  });

  it('AC-22: derived data is identical after rebuilding from source', async () => {
    await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await allocate('2026-01', { [food.id]: '10000.00', [home.id]: '6000.00' }).then((r) => expect(r.status).toBe(200));
    await operate('2026-01', { type: 'expense', sourceEnvelopeId: food.id, amount: '15000.00' });
    await operate('2026-01', { type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: food.id, amount: '2000.00' });
    await operate('2026-01', { type: 'adjustment', sign: '-', sourceEnvelopeId: home.id, amount: '5000.00' });
    await http().post('/api/v1/months').send({ period: '2026-02', income: '90000.00' }).expect(201);
    await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await versionOf('2026-01')))
      .expect(200);

    // rebuilt derived rows get new surrogate ids and timestamps; everything else must match
    const stable = <T extends { id: string; createdAt: Date; updatedAt: Date }>(rows: T[]) =>
      rows.map(({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest);
    const snapshotState = async () => ({
      months: (await t.prisma.budgetMonth.findMany({ orderBy: { period: 'asc' } })).map((m) => [m.period, m.status]),
      operations: (await t.prisma.operation.findMany({ orderBy: { sequenceNo: 'asc' } })).map((o) => [
        o.sequenceNo,
        o.type,
        o.requestedMinor,
      ]),
      results: stable(await t.prisma.operationResult.findMany({ orderBy: { operationId: 'asc' } })),
      snapshots: stable(
        await t.prisma.envelopeMonthSnapshot.findMany({ orderBy: [{ monthId: 'asc' }, { envelopeId: 'asc' }] }),
      ),
      balances: await balances(),
      dashboard: (await http().get('/api/v1/dashboard/monthly?period=2026-01').expect(200)).body,
    });
    const before = await snapshotState();
    expect(before.results.length).toBeGreaterThan(0);
    expect(before.snapshots.length).toBeGreaterThan(0);
    // January closes at Food 2000 (10000 - 15000 covered 10000, + 2000 transfer) and Home 0 (6000 - 2000 - 4000, the
    // -5000 adjustment is capped); the copied February allocation adds 10000 / 6000.
    expect(before.balances).toEqual({ Food: 1_200_000, Home: 600_000 });

    // "restart": a fresh application instance over the same database
    await t.close();
    t = await createTestApp(MODULES);
    expect(await snapshotState()).toEqual(before);

    // rebuild every derived row from the source data (DATA-13): the result is identical
    await t.app.get(CalculationEngineService, { strict: false }).recalculateFrom('2026-01');
    expect(await snapshotState()).toEqual(before);
  });
});
