import request from 'supertest';
import { MonthsModule } from './months.module';
import {
  createAllocation,
  createEnvelope,
  createMonth,
  resetDb,
} from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB: PATCH /months/:period (API-03) with the cascade in one transaction. */
describe('Months income update (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([MonthsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  /** PATCH income; `version` is the expected month version, sent as `If-Match` (API-25), not in the body. */
  const patch = (period: string, { version, ...body }: { version: number } & Record<string, unknown>) =>
    request(t.app.getHttpServer()).patch(`/api/v1/months/${period}`).set('If-Match', etag(version)).send(body);

  it('API-03 / API-15 / API-16 / API-22 / DATA-12: income change recalculates later months, bumps versions, returns summary + warnings', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'open', incomeMinor: 1_000_000 });
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'draft', incomeMinor: 1_000_000 });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });
    await createAllocation(t.prisma, { monthId: jan.id, envelopeId: envelope.id, amountMinor: 300_000 });
    await createAllocation(t.prisma, { monthId: feb.id, envelopeId: envelope.id, amountMinor: 200_000 });

    const response = await patch('2026-01', { income: '20000.00', version: 1 }).expect(200);

    expect(response.body.warnings).toEqual([]);
    expect(response.body.data.summary).toMatchObject({
      period: '2026-01',
      incomeMinor: 2_000_000,
      version: 2,
      totalAllocatedMinor: 300_000,
      freeFundsMinor: 1_700_000,
    });

    const [janRow, febRow] = await Promise.all([
      t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } }),
      t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: feb.id } }),
    ]);
    expect(janRow.incomeMinor).toBe(2_000_000);
    expect(janRow.version).toBe(jan.version + 1);
    expect(febRow.version).toBe(feb.version + 1); // cascade reached the later month

    // derived rows were rebuilt for both months and carried forward
    const febSnapshot = await t.prisma.envelopeMonthSnapshot.findFirstOrThrow({
      where: { monthId: feb.id, envelopeId: envelope.id },
    });
    expect(febSnapshot.opening).toBe(300_000);
    expect(febSnapshot.closing).toBe(500_000);
  });

  it('FIN-02 / AC-03: income below the allocated sum returns 422 and changes nothing', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 1_000_000 });
    const envelope = await createEnvelope(t.prisma, { name: 'Food' });
    await createAllocation(t.prisma, { monthId: jan.id, envelopeId: envelope.id, amountMinor: 1_000_000 });

    const response = await patch('2026-01', { income: '9999.99', version: 1 }).expect(422);

    expect(response.body).toEqual({
      error: 'ALLOCATION_EXCEEDS_INCOME',
      message: 'Распределено на 0,01 ₽ больше дохода. Уменьшите суммы по конвертам.',
    });
    const row = await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } });
    expect(row).toMatchObject({ incomeMinor: 1_000_000, version: 1 });
  });

  it('MON-03 / AC-14: closed month returns 409 MONTH_LOCKED', async () => {
    const jan = await createMonth(t.prisma, { period: '2026-01', status: 'closed' });

    const response = await patch('2026-01', { income: '20000.00', version: 1 }).expect(409);

    expect(response.body.error).toBe('MONTH_LOCKED');
    expect((await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } })).incomeMinor).toBe(1_000_000);
  });

  it('DATA-12: stale version returns 409 VERSION_CONFLICT', async () => {
    await createMonth(t.prisma, { period: '2026-01', version: 3 });

    const response = await patch('2026-01', { income: '20000.00', version: 2 }).expect(409);

    expect(response.body.error).toBe('VERSION_CONFLICT');
  });

  it('API-17: invalid body returns 422 VALIDATION_ERROR', async () => {
    await createMonth(t.prisma, { period: '2026-01' });

    const response = await patch('2026-01', { income: 'abc', version: 1 }).expect(422);

    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('API-03: unknown month returns 404 MONTH_NOT_FOUND', async () => {
    const response = await patch('2030-01', { income: '1.00', version: 1 }).expect(404);

    expect(response.body.error).toBe('MONTH_NOT_FOUND');
  });
});
