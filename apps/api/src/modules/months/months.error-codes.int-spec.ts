import request from 'supertest';
import type { ApiErrorCode } from '@family-budget/types';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { OperationsModule } from '../operations/operations.module';
import { MonthsModule } from './months.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB: the key error codes of API-18 reach the client as `{ error, message }` with the right status. */
describe('Key API error codes (integration)', () => {
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

  /** Assert the error body shape and that the code is a member of the shared ApiErrorCode union. */
  function expectError(response: { status: number; body: { error: string; message: string } }, status: number, code: ApiErrorCode) {
    expect(response.status).toBe(status);
    expect(response.body.error).toBe(code);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  }

  it('API-18: ALLOCATION_EXCEEDS_INCOME (422), MONTH_LOCKED / TRANSFER_EXCEEDS_BALANCE / ENVELOPE_NOT_EMPTY / VERSION_CONFLICT (409)', async () => {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 1_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });

    // ALLOCATION_EXCEEDS_INCOME: allocation above the month income (API-17: 422)
    expectError(
      await http()
        .put('/api/v1/months/2026-01/allocations')
        .send({ allocations: { [food.id]: '10000.01' }, version: month.version }),
      422,
      'ALLOCATION_EXCEEDS_INCOME',
    );

    await http()
      .put('/api/v1/months/2026-01/allocations')
      .send({ allocations: { [food.id]: '5000.00' }, version: month.version })
      .expect(200);
    const version = (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: month.id } })).version;

    // VERSION_CONFLICT: stale version (API-17: 409)
    expectError(
      await http().patch('/api/v1/months/2026-01').send({ income: '2.00', version: version - 1 }),
      409,
      'VERSION_CONFLICT',
    );

    // TRANSFER_EXCEEDS_BALANCE: transfer above the available balance
    expectError(
      await http()
        .post('/api/v1/operations')
        .send({ type: 'transfer', sourceEnvelopeId: food.id, destinationEnvelopeId: home.id, amount: '5000.01', version }),
      409,
      'TRANSFER_EXCEEDS_BALANCE',
    );

    // ENVELOPE_NOT_EMPTY: archiving an envelope with a non-zero balance
    expectError(await http().post(`/api/v1/envelopes/${food.id}/archive`), 409, 'ENVELOPE_NOT_EMPTY');

    // MONTH_LOCKED: any change of a closed month
    await http().post('/api/v1/months/2026-01/close').send({ version }).expect(200);
    expectError(
      await http()
        .post('/api/v1/operations')
        .send({ type: 'expense', sourceEnvelopeId: food.id, amount: '1.00', version: version + 1 }),
      409,
      'MONTH_LOCKED',
    );
  });
});
