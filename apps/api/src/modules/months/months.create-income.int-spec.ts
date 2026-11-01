import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { OperationsModule } from '../operations/operations.module';
import { ReportingModule } from '../reporting/reporting.module';
import { MonthsModule } from './months.module';
import { createEnvelope, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** MON-17: the income of a new month (HTTP + real DB + real engine). */
describe('Months creation copies income (integration)', () => {
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
  const versionOf = async (period: string) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } })).version;

  /** 2026-01 (open): income 100 000 ₽, Food 50 000 ₽ + Home 25 000 ₽ allocated. */
  async function seedJanuary() {
    await http().post('/api/v1/months').send({ period: '2026-01', income: '100000.00' }).expect(201);
    const food = await createEnvelope(t.prisma, { name: 'Food', displayOrder: 0 });
    const home = await createEnvelope(t.prisma, { name: 'Home', displayOrder: 1 });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await versionOf('2026-01')))
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '25000.00' } })
      .expect(200);
    return { food, home };
  }

  it('MON-17 / FIN-02 / SCOPE-29: a draft created without income copies the income and the allocations; free funds match the previous month', async () => {
    await seedJanuary();

    const res = await http().post('/api/v1/months').send({ period: '2026-02' }).expect(201);

    expect(res.body.month).toMatchObject({
      period: '2026-02',
      status: 'draft',
      incomeMinor: 10_000_000,
      totalAllocatedMinor: 7_500_000,
      freeFundsMinor: 2_500_000,
    });
    const feb = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period: '2026-02' } });
    expect(feb.incomeMinor).toBe(10_000_000);
    // snapshots are built on creation (T-032) and the engine bumped the version (ADR 0005)
    expect(feb.version).toBe(2);
    expect(res.body.month.version).toBe(feb.version);
    expect(await t.prisma.envelopeMonthSnapshot.count({ where: { monthId: feb.id } })).toBeGreaterThan(0);
  });

  it('MON-17: explicit income wins over the copied one', async () => {
    await seedJanuary();

    const res = await http().post('/api/v1/months').send({ period: '2026-02', income: '90000.00' }).expect(201);

    expect(res.body.month).toMatchObject({ incomeMinor: 9_000_000, freeFundsMinor: 1_500_000 });
  });

  it('MON-17 / FIN-02 / MSG-01: income below the copied allocations answers 422 ALLOCATION_EXCEEDS_INCOME and creates nothing', async () => {
    await seedJanuary();

    const res = await http().post('/api/v1/months').send({ period: '2026-02', income: '60000.00' }).expect(422);

    expect(res.body.error).toBe('ALLOCATION_EXCEEDS_INCOME');
    expect(res.body.message).toContain('15 000');
    expect(await t.prisma.budgetMonth.count({ where: { period: '2026-02' } })).toBe(0);
    expect(await t.prisma.allocation.count()).toBe(2);
  });

  it('MON-17: explicit income 0 is honoured (copied allocations then exceed it → 422)', async () => {
    await seedJanuary();

    await http().post('/api/v1/months').send({ period: '2026-02', income: '0.00' }).expect(422);
  });

  it('MON-17: the first month takes income from the request or 0', async () => {
    const withIncome = await http().post('/api/v1/months').send({ period: '2026-01', income: '45000.00' }).expect(201);
    expect(withIncome.body.month).toMatchObject({ status: 'open', incomeMinor: 4_500_000 });

    await resetDb(t.prisma);
    const without = await http().post('/api/v1/months').send({ period: '2026-01' }).expect(201);
    expect(without.body.month).toMatchObject({ status: 'open', incomeMinor: 0, freeFundsMinor: 0 });
  });

  it('MON-17 / MON-05: an open month created after a closed one copies the income too', async () => {
    await seedJanuary();
    await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await versionOf('2026-01')))
      .expect(200);

    const res = await http().post('/api/v1/months').send({ period: '2026-02' }).expect(201);

    expect(res.body.month).toMatchObject({ status: 'open', incomeMinor: 10_000_000, totalAllocatedMinor: 7_500_000 });
  });
});
