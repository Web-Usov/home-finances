import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { OperationsModule } from '../operations/operations.module';
import { MonthsModule } from './months.module';
import { createEnvelope, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB: which statuses POST /months assigns and which periods it accepts (MON-02, MON-05..MON-07). */
describe('Months creation rules and the open status (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([MonthsModule, AllocationsModule, OperationsModule, EnvelopesModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const createMonth = (body: object) => http().post('/api/v1/months').send(body);
  const row = (period: string) => t.prisma.budgetMonth.findUnique({ where: { period } });
  const versionOf = async (period: string) => (await row(period))!.version;

  it('MON-05: the first created month is open, with or without income', async () => {
    const withIncome = await createMonth({ period: '2026-01', income: '100000.00' }).expect(201);
    expect(withIncome.body.month).toMatchObject({ period: '2026-01', status: 'open', incomeMinor: 10_000_000 });

    await resetDb(t.prisma);
    const withoutIncome = await createMonth({ period: '2026-05' }).expect(201);
    expect(withoutIncome.body.month).toMatchObject({ period: '2026-05', status: 'open', incomeMinor: 0 });
  });

  it('MON-06: only the period right after the latest month is accepted; gaps, repeats and the past are INVALID_PERIOD', async () => {
    await createMonth({ period: '2026-11' }).expect(201);

    for (const period of ['2027-01', '2026-11', '2026-10', '2025-12']) {
      const response = await createMonth({ period }).expect(422);
      expect(response.body.error).toBe('INVALID_PERIOD');
    }
    expect(await t.prisma.budgetMonth.count()).toBe(1);

    // year boundary is the "next" month too
    const next = await createMonth({ period: '2026-12' }).expect(201);
    expect(next.body.month.status).toBe('draft');
    const wrap = await createMonth({ period: '2027-01' }).expect(409); // a draft already exists, see MON-07
    expect(wrap.body.error).toBe('INVALID_STATUS_TRANSITION');
  });

  it('MON-07: next to an open month a new month is a draft; a second future draft is refused', async () => {
    await createMonth({ period: '2026-01', income: '1000.00' }).expect(201);

    const draft = await createMonth({ period: '2026-02' }).expect(201);
    expect(draft.body.month).toMatchObject({ period: '2026-02', status: 'draft' });

    const second = await createMonth({ period: '2026-03' }).expect(409);
    expect(second.body.error).toBe('INVALID_STATUS_TRANSITION');
    expect(await row('2026-03')).toBeNull();
    expect((await row('2026-01'))!.status).toBe('open');
    expect((await row('2026-02'))!.status).toBe('draft');
  });

  it('MON-02: an open month accepts income, allocation and operations, and can be closed', async () => {
    await createMonth({ period: '2026-01', income: '1000.00' }).expect(201);
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });

    await http()
      .patch('/api/v1/months/2026-01')
      .set('If-Match', etag(await versionOf('2026-01')))
      .send({ income: '2000.00' })
      .expect(200);
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await versionOf('2026-01')))
      .send({ allocations: { [envelope.id]: '500.00' } })
      .expect(200);
    await http()
      .post('/api/v1/operations')
      .set('If-Match', etag(await versionOf('2026-01')))
      .send({ type: 'expense', sourceEnvelopeId: envelope.id, amount: '100.00' })
      .expect(201);
    expect((await row('2026-01'))!.status).toBe('open');

    const closed = await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await versionOf('2026-01')))
      .expect(200);
    expect(closed.body.data.month).toMatchObject({ period: '2026-01', status: 'closed' });
  });
});
