import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { ReportingModule } from '../reporting/reporting.module';
import { MonthsModule } from './months.module';
import { createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP: a period outside YYYY-MM with month 01-12 is a 422 VALIDATION_ERROR everywhere, never a 404 (API-17). */
describe('Period validation over HTTP (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([MonthsModule, AllocationsModule, ReportingModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    await createMonth(t.prisma, { period: '2026-01', status: 'open', incomeMinor: 1_000_000 });
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const invalid = ['2026-13', '2026-00'];

  it.each(invalid)('API-17: GET /dashboard/monthly?period=%s answers 422', async (period) => {
    const response = await http().get('/api/v1/dashboard/monthly').query({ period }).expect(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('API-12: a valid period still works for the dashboard', async () => {
    await http().get('/api/v1/dashboard/monthly').query({ period: '2026-01' }).expect(200);
  });

  it.each(invalid)('API-17 / MON-06: PATCH /months/%s answers 422, not 404 MONTH_NOT_FOUND', async (period) => {
    const response = await http()
      .patch(`/api/v1/months/${period}`)
      .set('If-Match', etag(1))
      .send({ income: '100.00' })
      .expect(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('API-17: PATCH /months/2026-12 for a missing but valid month stays 404 MONTH_NOT_FOUND', async () => {
    const response = await http()
      .patch('/api/v1/months/2026-12')
      .set('If-Match', etag(1))
      .send({ income: '100.00' })
      .expect(404);
    expect(response.body.error).toBe('MONTH_NOT_FOUND');
  });

  it.each(invalid)('API-17: POST /months with period %s answers 422 and creates nothing', async (period) => {
    const response = await http().post('/api/v1/months').send({ period }).expect(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(await t.prisma.budgetMonth.count()).toBe(1);
  });

  it.each(invalid)('API-17: path period %s of allocations, close, reopen and reopen-preview answers 422', async (period) => {
    const base = `/api/v1/months/${period}`;
    // sequential: parallel supertest requests on the unlistened server fail with ECONNRESET (test/http.ts)
    const results = [
      await http().put(`${base}/allocations`).set('If-Match', etag(1)).send({ allocations: {} }),
      await http().post(`${base}/close`).set('If-Match', etag(1)),
      await http().post(`${base}/reopen`).set('If-Match', etag(1)),
      await http().get(`${base}/reopen-preview`),
    ];
    for (const response of results) {
      expect(response.status).toBe(422);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    }
  });
});
