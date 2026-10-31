import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from './operations.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP + real DB + real engine: POST /operations with an explicit `period` (API-21). */
describe('Operations create with period (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([OperationsModule, AllocationsModule, EnvelopesModule, MonthsModule]);
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());
  const post = (body: object) => http().post('/api/v1/operations').send(body);

  async function monthOf(period: string) {
    return t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } });
  }

  async function foodClosing(period: string, envelopeId: string) {
    const month = await monthOf(period);
    const snapshot = await t.prisma.envelopeMonthSnapshot.findUniqueOrThrow({
      where: { monthId_envelopeId: { monthId: month.id, envelopeId } },
    });
    return snapshot;
  }

  /**
   * SCOPE-33 world: 2026-01 reopened (the past being fixed), 2026-02 open, 2026-03 draft.
   * Food gets 10 000 ₽ in January and nothing later, so it carries over.
   */
  async function setup() {
    await createMonth(t.prisma, { period: '2026-01', status: 'reopened', incomeMinor: 1_000_000 });
    await createMonth(t.prisma, { period: '2026-02', status: 'open', incomeMinor: 1_000_000 });
    await createMonth(t.prisma, { period: '2026-03', status: 'draft', incomeMinor: 1_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .send({ allocations: { [food.id]: '10000.00' }, version: (await monthOf('2026-01')).version })
      .expect(200);
    return { food };
  }

  const expense = (envelopeId: string, amount: string, extra: object) => ({
    type: 'expense',
    sourceEnvelopeId: envelopeId,
    amount,
    ...extra,
  });

  it('API-21 / MON-16: without period the operation goes to the open month even if a reopened month exists', async () => {
    const { food } = await setup();

    const response = await post(
      expense(food.id, '1000.00', { version: (await monthOf('2026-02')).version }),
    ).expect(201);

    expect(response.body.data.summary.period).toBe('2026-02');
    const op = await t.prisma.operation.findUniqueOrThrow({ where: { id: response.body.data.operation.id } });
    expect(op.monthId).toBe((await monthOf('2026-02')).id);
  });

  it('API-21 / SCOPE-33: period of the reopened month adds the operation there and bumps that month version and later months results', async () => {
    const { food } = await setup();
    const before = {
      jan: await monthOf('2026-01'),
      feb: await monthOf('2026-02'),
      mar: await monthOf('2026-03'),
    };
    expect((await foodClosing('2026-02', food.id)).opening).toBe(1_000_000);

    const response = await post(
      expense(food.id, '3000.00', { period: '2026-01', version: before.jan.version }),
    ).expect(201);

    expect(response.body.data.summary).toMatchObject({
      period: '2026-01',
      status: 'reopened',
      version: before.jan.version + 1,
    });
    const op = await t.prisma.operation.findUniqueOrThrow({ where: { id: response.body.data.operation.id } });
    expect(op.monthId).toBe(before.jan.id);

    // cascade: later months got new versions, kept their statuses (MON-14) and the new carry-over
    const feb = await monthOf('2026-02');
    const mar = await monthOf('2026-03');
    expect(feb.version).toBe(before.feb.version + 1);
    expect(mar.version).toBe(before.mar.version + 1);
    expect(feb.status).toBe('open');
    expect(mar.status).toBe('draft');
    expect((await foodClosing('2026-01', food.id)).closing).toBe(700_000);
    expect((await foodClosing('2026-02', food.id)).opening).toBe(700_000);
    expect((await foodClosing('2026-03', food.id)).opening).toBe(700_000);
  });

  it('API-21 / MON-01 / AC-16: period of the draft adds an operation to the draft', async () => {
    const { food } = await setup();
    const draft = await monthOf('2026-03');
    const febBefore = await monthOf('2026-02');

    const response = await post(
      expense(food.id, '500.00', { period: '2026-03', version: draft.version }),
    ).expect(201);

    expect(response.body.data.summary).toMatchObject({ period: '2026-03', status: 'draft' });
    expect(await t.prisma.operation.count({ where: { monthId: draft.id } })).toBe(1);
    expect((await monthOf('2026-03')).version).toBe(draft.version + 1);
    // earlier months are untouched
    expect((await monthOf('2026-02')).version).toBe(febBefore.version);
  });

  it('API-21 / MSG-06: period of a closed month answers 409 MONTH_LOCKED', async () => {
    const { food } = await setup();
    await createMonth(t.prisma, { period: '2025-12', status: 'closed' });
    const closed = await monthOf('2025-12');

    const response = await post(
      expense(food.id, '1.00', { period: '2025-12', version: closed.version }),
    ).expect(409);

    expect(response.body.error).toBe('MONTH_LOCKED');
    expect(await t.prisma.operation.count()).toBe(0);
  });

  it('API-21: unknown period answers 404 MONTH_NOT_FOUND', async () => {
    const { food } = await setup();

    const response = await post(expense(food.id, '1.00', { period: '2026-07', version: 1 })).expect(404);

    expect(response.body.error).toBe('MONTH_NOT_FOUND');
    expect(await t.prisma.operation.count()).toBe(0);
  });

  it('API-21 / ADR 0005: version of another month answers 409 VERSION_CONFLICT', async () => {
    const { food } = await setup();
    const jan = await monthOf('2026-01');
    // the working month (Feb) has another version than January after a January-only bump
    await t.prisma.budgetMonth.update({ where: { id: jan.id }, data: { version: { increment: 5 } } });

    const response = await post(
      expense(food.id, '1.00', { period: '2026-01', version: (await monthOf('2026-02')).version }),
    ).expect(409);

    expect(response.body.error).toBe('VERSION_CONFLICT');
    expect(await t.prisma.operation.count()).toBe(0);
    expect((await monthOf('2026-01')).version).toBe(jan.version + 5);
  });

  it('API-21 / OP-16: sequence_no continues the target month sequence', async () => {
    const { food } = await setup();
    const janVersion = (await monthOf('2026-01')).version;
    const first = await post(expense(food.id, '1.00', { period: '2026-01', version: janVersion })).expect(201);
    // an operation in another month does not move January's sequence
    await post(expense(food.id, '1.00', { version: (await monthOf('2026-02')).version })).expect(201);
    const second = await post(
      expense(food.id, '2.00', { period: '2026-01', version: (await monthOf('2026-01')).version }),
    ).expect(201);

    expect(first.body.data.operation.sequenceNo).toBe(1);
    expect(second.body.data.operation.sequenceNo).toBe(2);
  });

  it('API-21: a malformed period answers 422 VALIDATION_ERROR', async () => {
    const { food } = await setup();

    const response = await post(expense(food.id, '1.00', { period: '2026-1', version: 1 })).expect(422);

    expect(response.body.error).toBe('VALIDATION_ERROR');
  });
});
