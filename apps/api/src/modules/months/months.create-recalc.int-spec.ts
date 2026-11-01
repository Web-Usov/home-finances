import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { OperationsModule } from '../operations/operations.module';
import { ReportingModule } from '../reporting/reporting.module';
import { MonthsModule } from './months.module';
import { createEnvelope, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB + real engine: month creation and draft promotion keep snapshots consistent. */
describe('Months create / promote recalculation (integration)', () => {
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
  const dashboard = async (period: string) => (await http().get(`/api/v1/dashboard/monthly?period=${period}`).expect(200)).body;
  const versionOf = async (period: string) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } })).version;
  const envelopeOf = (body: { envelopes: { envelopeId: string }[] }, id: string) =>
    body.envelopes.find((e) => e.envelopeId === id);

  /** 2026-01 (open, income 100 000 ₽): Food 50 000 ₽ and Home 25 000 ₽ allocated, Food spends 10 000 ₽. */
  async function seedJanuary() {
    await http().post('/api/v1/months').send({ period: '2026-01', income: '100000.00' }).expect(201);
    const food = await createEnvelope(t.prisma, { name: 'Food', displayOrder: 0 });
    const home = await createEnvelope(t.prisma, { name: 'Home', displayOrder: 1 });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await versionOf('2026-01')))
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '25000.00' } })
      .expect(200);
    const jan = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period: '2026-01' } });
    await http()
      .post('/api/v1/operations')
      .set('If-Match', etag(jan.version))
      .send({ type: 'expense', sourceEnvelopeId: food.id, amount: '10000.00' })
      .expect(201);
    return { food, home };
  }

  function expectCarried(body: Awaited<ReturnType<typeof dashboard>>, food: { id: string }, home: { id: string }) {
    expect(envelopeOf(body, food.id)).toMatchObject({
      opening: '40000.00',
      replenished: '50000.00',
      spent: '0.00',
      closing: '90000.00',
    });
    expect(envelopeOf(body, home.id)).toMatchObject({
      opening: '25000.00',
      replenished: '25000.00',
      closing: '50000.00',
    });
    expect(body.summary).toMatchObject({ allocated: '75000.00', replenished: '75000.00' });
  }

  it('FIN-04 / DATA-06: a freshly created month shows carried openings and copied allocations as replenished', async () => {
    const { food, home } = await seedJanuary();

    await http().post('/api/v1/months').send({ period: '2026-02', income: '100000.00' }).expect(201);

    const body = await dashboard('2026-02');
    expect(body.month).toMatchObject({ period: '2026-02', status: 'draft' });
    expectCarried(body, food, home);
    const snapshots = await t.prisma.envelopeMonthSnapshot.findMany({
      where: { month: { period: '2026-02' } },
    });
    expect(snapshots).toHaveLength(2);
  });

  it('DATA-12 / ADR 0005: the response carries the post-recalculation version, matching the DB', async () => {
    await seedJanuary();

    const response = await http().post('/api/v1/months').send({ period: '2026-02' }).expect(201);

    expect(response.body.month.version).toBe(await versionOf('2026-02'));
    expect(response.body.month.totalAllocatedMinor).toBe(7_500_000);
  });

  it('FIN-04: the first month (no previous) is created with an empty, consistent dashboard', async () => {
    const created = await http().post('/api/v1/months').send({ period: '2026-01', income: '1000.00' }).expect(201);

    const body = await dashboard('2026-01');

    expect(created.body.month).toMatchObject({ status: 'open', totalAllocatedMinor: 0 });
    expect(body.envelopes).toEqual([]);
    expect(body.summary).toMatchObject({ income: '1000.00', allocated: '0.00', free: '1000.00' });
  });

  it('MON-08 / FIN-04 / DATA-06: the draft promoted by closing the month has a consistent dashboard', async () => {
    const { food, home } = await seedJanuary();
    await http().post('/api/v1/months').send({ period: '2026-02', income: '100000.00' }).expect(201);
    const before = await dashboard('2026-02');

    const closed = await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await versionOf('2026-01')))
      .expect(200);

    expect(closed.body.data.promotedDraft).toMatchObject({ period: '2026-02', status: 'open' });
    const after = await dashboard('2026-02');
    expect(after.month.status).toBe('open');
    expectCarried(after, food, home);
    expect(after.envelopes).toEqual(before.envelopes);
    expect(after.summary).toEqual(before.summary);
  });
});
