import request from 'supertest';
import { AllocationsModule } from '../modules/allocations/allocations.module';
import { EnvelopesModule } from '../modules/envelopes/envelopes.module';
import { MonthsModule } from '../modules/months/months.module';
import { OperationsModule } from '../modules/operations/operations.module';
import { ReportingModule } from '../modules/reporting/reporting.module';
import { createAllocation, createEnvelope, createMonth, createOperation, resetDb } from '../../test/db';
import { createTestApp, etag, TestApp } from '../../test/http';

/**
 * HTTP + real DB: the `If-Match` / `ETag` locking mechanism (API-25, API-26, API-27, DATA-12, ADR 0005 addendum)
 * on every month-scoped mutation and read.
 */
describe('If-Match / ETag (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([MonthsModule, AllocationsModule, OperationsModule, ReportingModule, EnvelopesModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());

  /** An open 2026-02 (version 3) with an envelope, an allocation and one expense; a closed 2025-12 (version 4). */
  async function setup() {
    const closed = await createMonth(t.prisma, { period: '2025-12', status: 'closed', version: 4 });
    const open = await createMonth(t.prisma, { period: '2026-02', status: 'open', version: 3 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    await createAllocation(t.prisma, { monthId: open.id, envelopeId: food.id, amountMinor: 500_000 });
    const operation = await createOperation(t.prisma, {
      monthId: open.id,
      sequenceNo: 1,
      type: 'expense',
      sourceEnvelopeId: food.id,
      requestedMinor: 1_000,
    });
    return { closed, open, food, operation };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;
  type Call = (s: Setup, ifMatch?: string) => request.Test;

  /** Every month-scoped mutation of API-25 against the OPEN month (reopen: against the closed one). */
  const mutations: Array<[string, Call]> = [
    ['PATCH /months/:period', (s, h) => withHeader(http().patch('/api/v1/months/2026-02').send({ income: '9000.00' }), h)],
    [
      'PUT /months/:period/allocations',
      (s, h) => withHeader(http().put('/api/v1/months/2026-02/allocations').send({ allocations: { [s.food.id]: '10.00' } }), h),
    ],
    ['POST /months/:period/close', (_s, h) => withHeader(http().post('/api/v1/months/2026-02/close'), h)],
    ['POST /months/:period/reopen', (_s, h) => withHeader(http().post('/api/v1/months/2025-12/reopen'), h)],
    [
      'POST /operations',
      (s, h) =>
        withHeader(
          http().post('/api/v1/operations').send({ type: 'expense', sourceEnvelopeId: s.food.id, amount: '1.00', period: '2026-02' }),
          h,
        ),
    ],
    [
      'PATCH /operations/:id',
      (s, h) => withHeader(http().patch(`/api/v1/operations/${s.operation.id}`).send({ amount: '2.00' }), h),
    ],
    ['DELETE /operations/:id', (s, h) => withHeader(http().delete(`/api/v1/operations/${s.operation.id}`), h)],
  ];

  function withHeader(req: request.Test, value?: string): request.Test {
    return value === undefined ? req : req.set('If-Match', value);
  }

  /** The current version of the month this mutation addresses. */
  const currentVersion = (name: string, s: Setup) => (name === 'POST /months/:period/reopen' ? s.closed.version : s.open.version);

  describe.each(mutations)('%s', (name, call) => {
    it('API-25 / API-27: no If-Match answers 428 PRECONDITION_REQUIRED and changes nothing', async () => {
      const s = await setup();

      const response = await call(s).expect(428);

      expect(response.body.error).toBe('PRECONDITION_REQUIRED');
      expect(await t.prisma.budgetMonth.findMany({ orderBy: { period: 'asc' }, select: { version: true } })).toEqual([
        { version: s.closed.version },
        { version: s.open.version },
      ]);
    });

    it.each(['7', 'W', '"x"', '"-1"', '"1.5"', '"07"', '*', '"1", "2"', '', '""'])(
      'API-27: malformed If-Match %j answers 422 VALIDATION_ERROR',
      async (value) => {
        const s = await setup();

        const response = await call(s, value).expect(422);

        expect(response.body.error).toBe('VALIDATION_ERROR');
      },
    );

    it('API-27: a stale If-Match answers 409 VERSION_CONFLICT and changes nothing', async () => {
      const s = await setup();

      const response = await call(s, etag(currentVersion(name, s) + 1)).expect(409);

      expect(response.body.error).toBe('VERSION_CONFLICT');
      expect(await t.prisma.budgetMonth.count({ where: { version: { in: [s.closed.version, s.open.version] } } })).toBe(2);
    });

    it('API-25 / API-26: the current version succeeds and ETag is the new month version', async () => {
      const s = await setup();
      const version = currentVersion(name, s);

      const response = await call(s, etag(version)).expect((res) => expect([200, 201]).toContain(res.status));

      const stored = await t.prisma.budgetMonth.findMany({ select: { period: true, version: true } });
      const target = name === 'POST /months/:period/reopen' ? '2025-12' : '2026-02';
      const targetVersion = stored.find((m) => m.period === target)?.version;
      expect(targetVersion).toBeGreaterThan(version); // ADR 0005: the cascade bumped it
      expect(response.headers.etag).toBe(etag(targetVersion as number));
    });
  });

  it('API-27: the weak form W/"<n>" is tolerated (proxies weaken ETags)', async () => {
    const s = await setup();

    await http().patch('/api/v1/months/2026-02').set('If-Match', `W/${etag(s.open.version)}`).send({ income: '9000.00' }).expect(200);
  });

  it('API-27: existence is checked first — an unknown month answers 404 even without If-Match', async () => {
    await setup();

    expect((await http().patch('/api/v1/months/2030-01').send({ income: '1.00' }).expect(404)).body.error).toBe('MONTH_NOT_FOUND');
    expect((await http().post('/api/v1/months/2030-01/close').set('If-Match', 'x').expect(404)).body.error).toBe('MONTH_NOT_FOUND');
    const unknownOperation = '3f1f1c2e-6a0b-4d6e-9d57-0a1b2c3d4e5f';
    expect((await http().delete(`/api/v1/operations/${unknownOperation}`).expect(404)).body.error).toBe('OPERATION_NOT_FOUND');
  });

  it('API-27: If-Match is checked before the month status — a stale tab on a closed month gets VERSION_CONFLICT', async () => {
    const s = await setup();
    const food = s.food.id;

    const stale = etag(s.closed.version + 1);
    expect((await http().patch('/api/v1/months/2025-12').set('If-Match', stale).send({ income: '1.00' }).expect(409)).body.error).toBe('VERSION_CONFLICT');
    expect((await http().put('/api/v1/months/2025-12/allocations').set('If-Match', stale).send({ allocations: { [food]: '1.00' } }).expect(409)).body.error).toBe('VERSION_CONFLICT');
    expect(
      (await http().post('/api/v1/operations').set('If-Match', stale).send({ type: 'expense', sourceEnvelopeId: food, amount: '1.00', period: '2025-12' }).expect(409)).body.error,
    ).toBe('VERSION_CONFLICT');

    // with the right version the same requests report the closed month
    const right = etag(s.closed.version);
    expect((await http().patch('/api/v1/months/2025-12').set('If-Match', right).send({ income: '1.00' }).expect(409)).body.error).toBe('MONTH_LOCKED');
  });

  it('API-21 / API-27: POST /operations without period checks If-Match against the working month', async () => {
    const s = await setup();
    const body = { type: 'expense', sourceEnvelopeId: s.food.id, amount: '1.00' };

    expect((await http().post('/api/v1/operations').send(body).expect(428)).body.error).toBe('PRECONDITION_REQUIRED');
    expect((await http().post('/api/v1/operations').set('If-Match', etag(s.open.version + 1)).send(body).expect(409)).body.error).toBe('VERSION_CONFLICT');
    const ok = await http().post('/api/v1/operations').set('If-Match', etag(s.open.version)).send(body).expect(201);
    expect(ok.headers.etag).toBe(etag(s.open.version + 1));
  });

  it('API-27: a missing If-Match is also reported before the month status (closed month)', async () => {
    await setup();

    expect((await http().patch('/api/v1/months/2025-12').send({ income: '1.00' }).expect(428)).body.error).toBe('PRECONDITION_REQUIRED');
  });

  it('API-26: the body no longer carries the version — a leftover `version` field is ignored, the header decides', async () => {
    const s = await setup();

    await http().patch('/api/v1/months/2026-02').set('If-Match', etag(s.open.version + 1)).send({ income: '1.00', version: s.open.version }).expect(409);
  });

  describe('API-26: ETag on reads', () => {
    it('GET /dashboard/monthly returns ETag equal to the month version (explicit and default period)', async () => {
      const s = await setup();

      const explicit = await http().get('/api/v1/dashboard/monthly?period=2026-02').expect(200);
      expect(explicit.headers.etag).toBe(etag(s.open.version));
      expect(explicit.body.month.version).toBe(s.open.version);

      const closed = await http().get('/api/v1/dashboard/monthly?period=2025-12').expect(200);
      expect(closed.headers.etag).toBe(etag(s.closed.version));

      const fallback = await http().get('/api/v1/dashboard/monthly').expect(200);
      expect(fallback.headers.etag).toBe(etag(s.open.version));
    });

    it('GET /months/:period/reopen-preview returns ETag equal to the version of the month', async () => {
      const s = await setup();

      const response = await http().get('/api/v1/months/2025-12/reopen-preview').expect(200);

      expect(response.headers.etag).toBe(etag(s.closed.version));
    });

    it('API-20: reopen-preview needs no If-Match', async () => {
      await setup();

      await http().get('/api/v1/months/2025-12/reopen-preview').expect(200);
    });

    it('a month-scoped read that fails sets no ETag', async () => {
      const response = await http().get('/api/v1/dashboard/monthly?period=2031-01').expect(404);

      expect(response.headers.etag).toBeUndefined();
    });

    it('endpoints outside the month scope set no ETag (months list, analytics, envelopes)', async () => {
      await setup();

      expect((await http().get('/api/v1/months').expect(200)).headers.etag).toBeUndefined();
      expect((await http().get('/api/v1/envelopes').expect(200)).headers.etag).toBeUndefined();
    });
  });

  describe('API-26: ETag of a cascade mutation is the TARGET month version after recalculation', () => {
    it('an operation in an earlier month bumps later months; ETag is the earlier month version', async () => {
      const jan = await createMonth(t.prisma, { period: '2026-01', status: 'reopened', version: 5 });
      await createMonth(t.prisma, { period: '2026-02', status: 'open', version: 9 });
      const food = await createEnvelope(t.prisma, { name: 'Food' });
      await createAllocation(t.prisma, { monthId: jan.id, envelopeId: food.id, amountMinor: 100_000 });

      const response = await http()
        .post('/api/v1/operations')
        .set('If-Match', etag(5))
        .send({ type: 'expense', sourceEnvelopeId: food.id, amount: '1.00', period: '2026-01' })
        .expect(201);

      const rows = Object.fromEntries((await t.prisma.budgetMonth.findMany()).map((m) => [m.period, m.version]));
      expect(rows['2026-01']).toBe(6);
      expect(rows['2026-02']).toBe(10);
      expect(response.headers.etag).toBe('"6"');
      expect(response.body.data.summary.version).toBe(6);
    });

    it('close: ETag is the version of the closed month after the bump', async () => {
      const s = await setup();

      const response = await http().post('/api/v1/months/2026-02/close').set('If-Match', etag(s.open.version)).expect(200);

      expect(response.headers.etag).toBe(etag(s.open.version + 1));
      expect(response.body.data.month.version).toBe(s.open.version + 1);
    });
  });

  describe('API-26: CORS', () => {
    it('exposes ETag to the browser client on a simple request', async () => {
      const response = await http().get('/api/v1/dashboard/monthly').set('Origin', 'http://localhost:8081');

      expect(response.headers['access-control-expose-headers']).toMatch(/\bETag\b/i);
    });

    it('allows If-Match in the preflight of a month-scoped mutation', async () => {
      const response = await http()
        .options('/api/v1/operations/3f1f1c2e-6a0b-4d6e-9d57-0a1b2c3d4e5f')
        .set('Origin', 'http://localhost:8081')
        .set('Access-Control-Request-Method', 'DELETE')
        .set('Access-Control-Request-Headers', 'if-match');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-headers']).toMatch(/\bIf-Match\b/i);
      expect(response.headers['access-control-allow-methods']).toMatch(/DELETE/);
    });
  });
});
