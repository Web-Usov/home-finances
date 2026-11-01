import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from './operations.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB + real engine: PATCH/DELETE /operations/:id (API-11) with the cascade in one transaction. */
describe('Operations update and delete (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([OperationsModule, AllocationsModule, EnvelopesModule, MonthsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  /** PATCH an operation; `version` is the expected month version, sent as `If-Match` (API-25), not in the body. */
  const patch = (id: string, { version, ...body }: { version?: number } & Record<string, unknown>) => {
    const req = http().patch(`/api/v1/operations/${id}`);
    return (version === undefined ? req : req.set('If-Match', etag(version))).send(body);
  };
  const del = (id: string, version: number | string) =>
    http().delete(`/api/v1/operations/${id}`).set('If-Match', etag(version));

  async function monthVersion(id: string): Promise<number> {
    return (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id } })).version;
  }

  /** Open 2026-01 (income 10 000 ₽); Food allocated 10 000 ₽ via the API; Home has no allocation. */
  async function setup() {
    const month = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 1_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(month.version))
      .send({ allocations: { [food.id]: '10000.00' } })
      .expect(200);
    return { month, food, home };
  }

  /** Create an operation through the API with the CURRENT month version; returns the operation row. */
  async function addOperation(monthId: string, body: object) {
    const version = await monthVersion(monthId);
    const response = await http()
      .post('/api/v1/operations')
      .set('If-Match', etag(version))
      .send({ ...body })
      .expect(201);
    return response.body.data.operation as { id: string; sequenceNo: number };
  }

  const resultOf = (operationId: string) =>
    t.prisma.operationResult.findUniqueOrThrow({ where: { operationId } });

  it('OP-17 / FIN-05 / AC-12: editing the first operation keeps its sequence_no and later results are recalculated in the old order', async () => {
    const { month, food } = await setup();
    const first = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '8000.00' });
    const second = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '5000.00' });
    expect(await resultOf(second.id)).toMatchObject({ coveredMinor: 200_000, uncoveredMinor: 300_000 });
    const before = await monthVersion(month.id);

    const response = await patch(first.id, { amount: '1000.00', version: before }).expect(200);

    expect(response.body.data.operation).toMatchObject({ id: first.id, sequenceNo: 1, requestedMinor: 100_000 });
    expect(response.body.data.result).toMatchObject({ coveredMinor: 100_000, sourceBalanceBefore: 1_000_000 });
    // the second operation is still second and now sees 9000 ₽ → fully covered
    const secondRow = await t.prisma.operation.findUniqueOrThrow({ where: { id: second.id } });
    expect(secondRow.sequenceNo).toBe(2);
    expect(await resultOf(second.id)).toMatchObject({
      sourceBalanceBefore: 900_000,
      coveredMinor: 500_000,
      uncoveredMinor: 0,
      sourceBalanceAfter: 400_000,
    });
    // ADR 0005 / API-16: version bumped once, summary is fresh
    expect(await monthVersion(month.id)).toBe(before + 1);
    expect(response.body.data.summary).toMatchObject({ id: month.id, version: before + 1, status: 'open' });
  });

  it('HIST-08 / API-14: changes comment (empty clears it) and envelope; sequence_no stays', async () => {
    const { month, food, home } = await setup();
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await monthVersion(month.id)))
      .send({ allocations: { [food.id]: '5000.00', [home.id]: '5000.00' } })
      .expect(200);
    const op = await addOperation(month.id, {
      type: 'expense',
      sourceEnvelopeId: food.id,
      amount: '100.00',
      comment: 'old',
    });

    const edited = await patch(op.id, { sourceEnvelopeId: home.id, comment: 'new', version: await monthVersion(month.id) }).expect(200);
    expect(edited.body.data.operation).toMatchObject({ sourceEnvelopeId: home.id, comment: 'new', sequenceNo: 1 });
    expect(edited.body.data.result.sourceBalanceBefore).toBe(500_000);

    const cleared = await patch(op.id, { comment: '', version: await monthVersion(month.id) }).expect(200);
    expect(cleared.body.data.operation.comment).toBeNull();
  });

  it('OP-18 / FIN-06 / AC-13: delete leaves a sequence gap and updates this and later months', async () => {
    const { month, food } = await setup();
    const feb = await createMonth(t.prisma, { period: '2026-02', status: 'draft', incomeMinor: 0 });
    const first = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '4000.00' });
    const second = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '1000.00' });
    const febOpening = () =>
      t.prisma.envelopeMonthSnapshot
        .findFirstOrThrow({ where: { monthId: feb.id, envelopeId: food.id } })
        .then((s) => s.opening);
    expect(await febOpening()).toBe(500_000);
    const janBefore = await monthVersion(month.id);
    const febBefore = await monthVersion(feb.id);

    const response = await del(first.id, janBefore).expect(200);

    expect(await t.prisma.operation.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await t.prisma.operationResult.findUnique({ where: { operationId: first.id } })).toBeNull();
    expect((await t.prisma.operation.findUniqueOrThrow({ where: { id: second.id } })).sequenceNo).toBe(2); // gap: no 1
    expect(await resultOf(second.id)).toMatchObject({ sourceBalanceBefore: 1_000_000, sourceBalanceAfter: 900_000 });
    expect(await febOpening()).toBe(900_000); // later month recalculated
    expect(await monthVersion(month.id)).toBe(janBefore + 1);
    expect(await monthVersion(feb.id)).toBe(febBefore + 1);
    expect(response.body.data.summary).toMatchObject({ id: month.id, version: janBefore + 1 });
    expect(response.body.warnings).toEqual([]);

    // OP-17: the next new operation goes after the highest number, not into the gap
    const third = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '1.00' });
    expect(third.sequenceNo).toBe(3);
  });

  it('HIST-09: edited transfer above available balance is rejected', async () => {
    const { month, food, home } = await setup();
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '6000.00',
    });
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '1000.00' });
    const version = await monthVersion(month.id);

    const rejected = await patch(transfer.id, { amount: '10000.01', version }).expect(409);
    expect(rejected.body).toEqual({
      error: 'TRANSFER_EXCEEDS_BALANCE',
      message: 'Доступно 10\u00A0000,00 ₽. Перевести только 10\u00A0000,00 ₽?',
      available: '10000.00',
    });
    // the whole edit rolled back
    expect((await t.prisma.operation.findUniqueOrThrow({ where: { id: transfer.id } })).requestedMinor).toBe(600_000);
    expect(await monthVersion(month.id)).toBe(version);

    await patch(transfer.id, { amount: '10000.00', version }).expect(200); // exactly the balance is fine
  });

  it('OP-07 / MSG-03: available in the edit 409 is the balance at the transfer position, not the current closing', async () => {
    const { month, food, home } = await setup();
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '6000.00',
    });
    const later = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '3000.00' });
    // the later operation moved the source balance: closing is 1000.00, the transfer met 10000.00
    expect(await resultOf(later.id)).toMatchObject({ sourceBalanceAfter: 100_000 });

    const rejected = await patch(transfer.id, { amount: '10000.01', version: await monthVersion(month.id) }).expect(409);
    expect(rejected.body.available).toBe('10000.00');
    expect(rejected.body.available).not.toBe('1000.00');
  });

  it('HIST-09: re-pointing a transfer to a source without money is rejected', async () => {
    const { month, food, home } = await setup();
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '100.00',
    });

    const rejected = await patch(transfer.id, {
      sourceEnvelopeId: home.id,
      destinationEnvelopeId: food.id,
      version: await monthVersion(month.id),
    }).expect(409);

    expect(rejected.body.error).toBe('TRANSFER_EXCEEDS_BALANCE');
  });

  it('OP-08 / AC-08: retroactive deficit keeps the full transfer, destination gets the full amount, source deficit is uncovered', async () => {
    const { month, food, home } = await setup();
    const expense = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '2000.00' });
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '8000.00',
    });
    expect(await resultOf(transfer.id)).toMatchObject({ coveredMinor: 800_000, uncoveredMinor: 0 });

    // editing the EARLIER expense must not be rejected because of the later transfer
    const response = await patch(expense.id, { amount: '5000.00', version: await monthVersion(month.id) }).expect(200);

    const stored = await t.prisma.operation.findUniqueOrThrow({ where: { id: transfer.id } });
    expect(stored.requestedMinor).toBe(800_000); // not reduced, not deleted
    expect(await resultOf(transfer.id)).toMatchObject({
      sourceBalanceBefore: 500_000,
      coveredMinor: 500_000,
      uncoveredMinor: 300_000,
      sourceBalanceAfter: 0,
      destinationBalanceAfter: 800_000, // destination received the full amount
    });
    expect(response.body.data.summary.id).toBe(month.id);
  });

  it('HIST-10 / AC-14: update and delete in a closed month return MONTH_LOCKED', async () => {
    const { month, food } = await setup();
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    await http().post('/api/v1/months/2026-01/close').set('If-Match', etag(await monthVersion(month.id))).expect(200);
    const version = await monthVersion(month.id);

    expect((await patch(op.id, { amount: '1.00', version }).expect(409)).body.error).toBe('MONTH_LOCKED');
    expect((await del(op.id, version).expect(409)).body.error).toBe('MONTH_LOCKED');

    expect((await t.prisma.operation.findUniqueOrThrow({ where: { id: op.id } })).requestedMinor).toBe(10_000);
    expect(await monthVersion(month.id)).toBe(version);
  });

  it('HIST-07: allowed in a reopened month', async () => {
    const { month, food } = await setup();
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    await http().post('/api/v1/months/2026-01/close').set('If-Match', etag(await monthVersion(month.id))).expect(200);
    await http().post('/api/v1/months/2026-01/reopen').set('If-Match', etag(await monthVersion(month.id))).expect(200);

    await patch(op.id, { amount: '1.00', version: await monthVersion(month.id) }).expect(200);
    await del(op.id, await monthVersion(month.id)).expect(200);
  });

  it('HIST-07: allowed in a draft month', async () => {
    const month = await createMonth(t.prisma, { period: '2026-03', status: 'draft' });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    await t.prisma.operation.create({
      data: { monthId: month.id, sequenceNo: 1, type: 'expense', sourceEnvelopeId: food.id, requestedMinor: 100 },
    });
    const op = await t.prisma.operation.findFirstOrThrow({ where: { monthId: month.id } });

    await patch(op.id, { amount: '2.00', version: month.version }).expect(200);
    await del(op.id, month.version + 1).expect(200);
  });

  it('DATA-12: stale version returns VERSION_CONFLICT and changes nothing', async () => {
    const { month, food } = await setup();
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    const version = await monthVersion(month.id);

    expect((await patch(op.id, { amount: '1.00', version: version - 1 }).expect(409)).body.error).toBe('VERSION_CONFLICT');
    expect((await del(op.id, version - 1).expect(409)).body.error).toBe('VERSION_CONFLICT');

    expect(await t.prisma.operation.count()).toBe(1);
    expect((await t.prisma.operation.findUniqueOrThrow({ where: { id: op.id } })).requestedMinor).toBe(10_000);
    expect(await monthVersion(month.id)).toBe(version);
  });

  it('DATA-12: of two concurrent edits with the same version exactly one wins', async () => {
    const { month, food } = await setup();
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    const version = await monthVersion(month.id);

    const [a, b] = await Promise.all([
      patch(op.id, { amount: '1.00', version }),
      patch(op.id, { amount: '2.00', version }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await monthVersion(month.id)).toBe(version + 1);
  });

  it('API-15: a failing recalculation rolls back the edit and the delete', async () => {
    const { month, food } = await setup();
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    const version = await monthVersion(month.id);
    const engine = t.app.get(CalculationEngineService, { strict: false });
    jest.spyOn(engine, 'recalculateMonthAtomically').mockRejectedValue(new Error('boom'));

    await patch(op.id, { amount: '1.00', version }).expect(500);
    await del(op.id, version).expect(500);

    const row = await t.prisma.operation.findUniqueOrThrow({ where: { id: op.id } });
    expect(row.requestedMinor).toBe(10_000);
    expect(await resultOf(op.id)).toMatchObject({ coveredMinor: 10_000 });
    expect(await monthVersion(month.id)).toBe(version);
  });

  it('DATA-11: archived envelope is rejected on re-pointing; unknown operation 404; malformed input 422', async () => {
    const { month, food } = await setup();
    const archived = await createEnvelope(t.prisma, { name: 'Old', status: 'archived', archivedPeriod: '2026-01' });
    const op = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    const version = await monthVersion(month.id);

    expect((await patch(op.id, { sourceEnvelopeId: archived.id, version }).expect(409)).body.error).toBe(
      'INVALID_STATUS_TRANSITION',
    );
    const missing = '3f1f1c2e-6a0b-4d6e-9d57-0a1b2c3d4e5f';
    expect((await patch(missing, { amount: '1.00', version }).expect(404)).body.error).toBe('OPERATION_NOT_FOUND');
    expect((await del(missing, version).expect(404)).body.error).toBe('OPERATION_NOT_FOUND');
    expect((await patch(op.id, { amount: 'abc', version }).expect(422)).body.error).toBe('VALIDATION_ERROR');
    expect((await patch(op.id, { amount: '1.00' }).expect(428)).body.error).toBe('PRECONDITION_REQUIRED');
    expect((await patch('not-a-uuid', { amount: '1.00', version }).expect(422)).body.error).toBe('VALIDATION_ERROR');
    expect((await del(op.id, 'x').expect(422)).body.error).toBe('VALIDATION_ERROR');
    expect((await http().delete(`/api/v1/operations/${op.id}`).expect(428)).body.error).toBe('PRECONDITION_REQUIRED');
  });

  it('DATA-09 / OP-10: destination only for transfers; the initial balance is not editable or deletable', async () => {
    const { month, food, home } = await setup();
    const expense = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '100.00' });
    const created = await http()
      .post('/api/v1/envelopes')
      .send({ name: 'Savings', initialBalance: '500.00' })
      .expect(201);
    const initial = await t.prisma.operation.findFirstOrThrow({ where: { isInitial: true } });
    const version = await monthVersion(month.id);
    expect(created.body).toBeDefined();

    expect((await patch(expense.id, { destinationEnvelopeId: home.id, version }).expect(422)).body.error).toBe(
      'VALIDATION_ERROR',
    );
    expect((await patch(initial.id, { amount: '1.00', version }).expect(422)).body.error).toBe('VALIDATION_ERROR');
    expect((await del(initial.id, version).expect(422)).body.error).toBe('VALIDATION_ERROR');
    expect(await t.prisma.operation.count({ where: { isInitial: true } })).toBe(1);
  });

  it('MON-10 / MON-11: uncovered operations do not block month close', async () => {
    const { month, food, home } = await setup();
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '15000.00' }); // 5000 uncovered
    await addOperation(month.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '10.00' });
    expect(await t.prisma.operationResult.count({ where: { uncoveredMinor: { gt: 0 } } })).toBe(2);

    const closed = await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await monthVersion(month.id)))
      .expect(200);

    expect(closed.body.data.month.status).toBe('closed');
    expect(closed.body.warnings).toEqual([]);
  });

  it('MON-10 / OP-08: a transfer made uncovered by a cascade does not block month close either', async () => {
    const { month, food, home } = await setup();
    const expense = await addOperation(month.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '2000.00' });
    const transfer = await addOperation(month.id, {
      type: 'transfer',
      sourceEnvelopeId: food.id,
      destinationEnvelopeId: home.id,
      amount: '8000.00',
    });
    await patch(expense.id, { amount: '5000.00', version: await monthVersion(month.id) }).expect(200);
    expect((await resultOf(transfer.id)).uncoveredMinor).toBe(300_000);

    await http()
      .post('/api/v1/months/2026-01/close')
      .set('If-Match', etag(await monthVersion(month.id)))
      .expect(200);
  });
});
