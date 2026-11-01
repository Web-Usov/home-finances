import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { MonthsModule } from './months.module';
import { createAllocation, createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB: POST /months/:period/close and /reopen (API-05, API-06). */
describe('Months close / reopen (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([MonthsModule, AllocationsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  /** POST close / reopen: no body, `version` is the expected month version sent as `If-Match` (API-25). */
  const post = (path: string, { version }: { version: number }) =>
    request(t.app.getHttpServer()).post(`/api/v1/months/${path}`).set('If-Match', etag(version));
  const preview = (period: string) =>
    request(t.app.getHttpServer()).get(`/api/v1/months/${period}/reopen-preview`);
  const statusOf = async (period: string) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } })).status;

  it('MON-08 / AC-17: closing the current month promotes the existing draft to open', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'open' });
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'draft' });

    const response = await post('2026-01/close', { version: 1 }).expect(200);

    expect(response.body.warnings).toEqual([]);
    expect(response.body.data.month).toMatchObject({ period: '2026-01', status: 'closed', version: 2 });
    expect(response.body.data.promotedDraft).toMatchObject({ period: '2026-02', status: 'open', version: 2 });
    expect(await statusOf('2026-01')).toBe('closed');
    expect(await statusOf('2026-02')).toBe('open');
    expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } })).version).toBe(2);
    expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: feb.id } })).version).toBe(2);
  });

  it('MON-01 / AC-16: a draft accepts allocations but cannot be closed', async () => {
    await createMonth(t.prisma, { period: '2026-01', status: 'open' });
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'draft' });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });

    await request(t.app.getHttpServer())
      .put('/api/v1/months/2026-02/allocations')
      .set('If-Match', etag(1))
      .send({ allocations: { [envelope.id]: '100.00' } })
      .expect(200);
    const response = await post('2026-02/close', { version: feb.version + 1 }).expect(409);

    expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    expect(await statusOf('2026-02')).toBe('draft');
  });

  it('MON-13: a second month cannot be reopened while one is reopened', async () => {
    await createMonth(t.prisma, { period: '2026-01', status: 'closed' });
    await createMonth(t.prisma, { period: '2026-02', status: 'reopened' });
    await createMonth(t.prisma, { period: '2026-03', status: 'open' });

    const response = await post('2026-01/reopen', { version: 1 }).expect(409);

    expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
    expect(await statusOf('2026-01')).toBe('closed');
  });

  it('MON-15: closing a reopened month does not promote the draft', async () => {
    await createMonth(t.prisma, { period: '2026-01', status: 'reopened' });
    await createMonth(t.prisma, { period: '2026-02', status: 'open' });
    await createMonth(t.prisma, { period: '2026-03', status: 'draft' });

    const response = await post('2026-01/close', { version: 1 }).expect(200);

    expect(response.body.data.month.status).toBe('closed');
    expect(response.body.data.promotedDraft).toBeNull();
    expect(await statusOf('2026-03')).toBe('draft');
    expect(await statusOf('2026-02')).toBe('open');
  });

  it('MON-14 / MON-12 / AC-15: reopen recalculates later months, keeps their statuses and returns the range', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'closed', incomeMinor: 1_000_000 });
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'closed', incomeMinor: 1_000_000 });
    const mar = await createMonth(t.prisma, { period: '2026-03', status: 'open', incomeMinor: 1_000_000 });
    const apr = await createMonth(t.prisma, { period: '2026-04', status: 'draft', incomeMinor: 1_000_000 });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });
    await createAllocation(t.prisma, { monthId: jan.id, envelopeId: envelope.id, amountMinor: 300_000 });

    const response = await post('2026-01/reopen', { version: 1 }).expect(200);

    expect(response.body.data.recalcRange).toEqual({ from: '2026-01', to: '2026-04' });
    expect(response.body.data.month).toMatchObject({ period: '2026-01', status: 'reopened', version: 2 });
    expect(await statusOf('2026-02')).toBe('closed');
    expect(await statusOf('2026-03')).toBe('open');
    expect(await statusOf('2026-04')).toBe('draft');
    for (const month of [feb, mar, apr]) {
      expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } })).version).toBe(2);
    }
    // derived rows of the closed later month were rebuilt from the source data
    const febSnapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: feb.id, envelopeId: envelope.id },
    });
    expect(febSnapshot.opening).toBe(300_000);
  });

  it('MON-03 / AC-14: mutations in a closed month return MONTH_LOCKED', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'open' });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });
    await post('2026-01/close', { version: 1 }).expect(200);

    const income = await request(t.app.getHttpServer())
      .patch('/api/v1/months/2026-01')
      .set('If-Match', etag(2))
      .send({ income: '1.00' })
      .expect(409);
    const allocations = await request(t.app.getHttpServer())
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(2))
      .send({ allocations: { [envelope.id]: '1.00' } })
      .expect(409);

    expect(income.body.error).toBe('MONTH_LOCKED');
    expect(allocations.body.error).toBe('MONTH_LOCKED');
    expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } })).incomeMinor).toBe(1_000_000);
  });

  it('MON-11: allocations above income block closing; MON-10: free funds and uncovered operations do not', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'open', incomeMinor: 1_000 });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });
    await createAllocation(t.prisma, { monthId: jan.id, envelopeId: envelope.id, amountMinor: 2_000 });

    const blocked = await post('2026-01/close', { version: 1 }).expect(422);
    expect(blocked.body.error).toBe('ALLOCATION_EXCEEDS_INCOME');
    expect(await statusOf('2026-01')).toBe('open');

    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'open', incomeMinor: 1_000_000 });
    await post('2026-02/close', { version: feb.version }).expect(200); // nothing allocated: all funds free
    expect(await statusOf('2026-02')).toBe('closed');
  });

  it('DATA-12: stale version returns 409 VERSION_CONFLICT; unknown month 404', async () => {
    await createMonth(t.prisma, { period: '2026-01', status: 'open', version: 3 });

    expect((await post('2026-01/close', { version: 2 }).expect(409)).body.error).toBe('VERSION_CONFLICT');
    expect((await post('2030-01/reopen', { version: 1 }).expect(404)).body.error).toBe('MONTH_NOT_FOUND');
  });

  describe('reopen preview (API-20)', () => {
    const layouts: Array<[string, Array<[string, 'draft' | 'open' | 'closed' | 'reopened']>]> = [
      ['target is the only month', [['2026-01', 'closed']]],
      ['closed, closed, open, draft', [['2026-01', 'closed'], ['2026-02', 'closed'], ['2026-03', 'open'], ['2026-04', 'draft']]],
      ['target in the middle', [['2026-01', 'closed'], ['2026-02', 'closed'], ['2026-03', 'closed'], ['2026-04', 'open']]],
      ['year rollover', [['2026-11', 'closed'], ['2026-12', 'closed'], ['2027-01', 'open']]],
    ];

    it.each(layouts)(
      'MON-12 / API-20 / AC-15: preview returns the same range as the reopen response (%s)',
      async (_name, months) => {
        for (const [period, status] of months) await createMonth(t.prisma, { period, status });
        for (const [period, status] of months.filter(([, st]) => st === 'closed')) {
          const previewed = await preview(period).expect(200);
          expect(previewed.body.month).toMatchObject({ period, status });
          // reopen the target, compare, then close it again so the next closed month can be tried
          const current = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } });
          const reopened = await post(`${period}/reopen`, { version: current.version }).expect(200);
          expect(previewed.body.recalcRange).toEqual(reopened.body.data.recalcRange);
          expect(previewed.body.recalcRange).toEqual({ from: period, to: months[months.length - 1]![0] });
          const after = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } });
          await post(`${period}/close`, { version: after.version }).expect(200);
        }
      },
    );

    it('API-20: preview does not change status, version or results', async () => {
      const jan = await createMonth(t.prisma, { period: '2026-01', status: 'closed', incomeMinor: 1_000_000 });
      await createMonth(t.prisma, { period: '2026-02', status: 'open', incomeMinor: 1_000_000 });
      const envelope = await createEnvelope(t.prisma, { name: 'Food' });
      await createAllocation(t.prisma, { monthId: jan.id, envelopeId: envelope.id, amountMinor: 300_000 });
      const dump = async () => ({
        months: await t.prisma.budgetMonth.findMany({ orderBy: { period: 'asc' } }),
        snapshots: await t.prisma.envelopeMonthSnapshot.findMany({ orderBy: { id: 'asc' } }),
        results: await t.prisma.operationResult.findMany({ orderBy: { id: 'asc' } }),
      });
      const before = await dump();

      const response = await preview('2026-01').expect(200);

      expect(response.body.month.version).toBe(jan.version);
      expect(response.body.version).toBeUndefined();
      expect(await dump()).toEqual(before);
    });

    it('API-20 / MON-13: preview of a second month while one is reopened answers 409 INVALID_STATUS_TRANSITION', async () => {
      await createMonth(t.prisma, { period: '2026-01', status: 'closed' });
      await createMonth(t.prisma, { period: '2026-02', status: 'reopened' });
      await createMonth(t.prisma, { period: '2026-03', status: 'open' });

      const previewed = await preview('2026-01').expect(409);
      const reopened = await post('2026-01/reopen', { version: 1 }).expect(409);

      expect(previewed.body).toEqual(reopened.body);
      expect(previewed.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('API-20: preview of an open month answers 409 INVALID_STATUS_TRANSITION and of an unknown one 404 MONTH_NOT_FOUND', async () => {
      await createMonth(t.prisma, { period: '2026-01', status: 'open' });

      const open = await preview('2026-01').expect(409);
      const reopenOpen = await post('2026-01/reopen', { version: 1 }).expect(409);
      expect(open.body).toEqual(reopenOpen.body);
      expect(open.body.error).toBe('INVALID_STATUS_TRANSITION');

      const unknown = await preview('2030-05').expect(404);
      const reopenUnknown = await post('2030-05/reopen', { version: 1 }).expect(404);
      expect(unknown.body).toEqual(reopenUnknown.body);
      expect(unknown.body.error).toBe('MONTH_NOT_FOUND');
    });
  });
});
