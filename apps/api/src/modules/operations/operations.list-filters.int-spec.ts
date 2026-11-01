import request from 'supertest';
import { AllocationsModule } from '../allocations/allocations.module';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from './operations.module';
import { createEnvelope, createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

/** HTTP + real DB + real engine: GET /operations filters `uncoveredOnly` and `role=source` (HIST-15). */
describe('Operations list filters (integration)', () => {
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

  async function version(id: string): Promise<number> {
    return (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id } })).version;
  }

  async function add(monthId: string, body: object) {
    const res = await http()
      .post('/api/v1/operations')
      .set('If-Match', etag(await version(monthId)))
      .send(body)
      .expect(201);
    return res.body.data.operation.id as string;
  }

  /**
   * Home 10 000 ₽, Food 50 000 ₽. Operations (in order):
   * positive adjustment on Home, covered transfer Food→Home, covered expense on Home,
   * transfer Home→Food 20 000 (only 10 000 covered after the allocation drop below), uncovered expense on Home,
   * uncovered negative adjustment on Home, covered expense on Food.
   */
  async function setup() {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food', displayOrder: 0 });
    const home = await createEnvelope(t.prisma, { name: 'Home', displayOrder: 1 });
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await version(jan.id)))
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '25000.00' } })
      .expect(200);
    const ids = {
      posAdj: await add(jan.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '+', amount: '500.00' }),
      transferIn: await add(jan.id, {
        type: 'transfer',
        sourceEnvelopeId: food.id,
        destinationEnvelopeId: home.id,
        amount: '100.00',
      }),
      coveredExpense: await add(jan.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '10.00' }),
      transferOut: await add(jan.id, {
        type: 'transfer',
        sourceEnvelopeId: home.id,
        destinationEnvelopeId: food.id,
        amount: '20000.00',
      }),
    };
    await http()
      .put('/api/v1/months/2026-01/allocations')
      .set('If-Match', etag(await version(jan.id)))
      .send({ allocations: { [food.id]: '50000.00', [home.id]: '10000.00' } })
      .expect(200);
    return {
      jan,
      food,
      home,
      ids: {
        ...ids,
        uncoveredExpense: await add(jan.id, { type: 'expense', sourceEnvelopeId: home.id, amount: '30000.00' }),
        negAdj: await add(jan.id, { type: 'adjustment', sourceEnvelopeId: home.id, sign: '-', amount: '200.00' }),
        foodExpense: await add(jan.id, { type: 'expense', sourceEnvelopeId: food.id, amount: '10.00' }),
      },
    };
  }

  const list = async (query: Record<string, string>) => {
    const res = await http().get('/api/v1/operations').query(query).expect(200);
    return res.body.operations as { id: string; result: { uncoveredMinor: number } }[];
  };
  const idsOf = (ops: { id: string }[]) => ops.map((op) => op.id).sort();

  it('HIST-15 / REP-10: uncoveredOnly returns only operations with uncovered > 0', async () => {
    const { ids } = await setup();
    const ops = await list({ period: '2026-01', uncoveredOnly: 'true' });
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((op) => op.result.uncoveredMinor > 0)).toBe(true);
    expect(idsOf(ops)).toEqual([ids.transferOut, ids.uncoveredExpense, ids.negAdj].sort());
    // `false` and absence keep the full list
    expect((await list({ period: '2026-01', uncoveredOnly: 'false' })).length).toBe(7);
    expect((await list({ period: '2026-01' })).length).toBe(7);
  });

  it('HIST-15 / REP-10: uncoveredOnly with type=adjustment excludes positive adjustments', async () => {
    const { ids, home } = await setup();
    const all = await list({ period: '2026-01', type: 'adjustment', envelopeId: home.id });
    expect(idsOf(all)).toEqual([ids.posAdj, ids.negAdj].sort());
    const ops = await list({ period: '2026-01', type: 'adjustment', envelopeId: home.id, uncoveredOnly: 'true', role: 'source' });
    expect(idsOf(ops)).toEqual([ids.negAdj]);
  });

  it('HIST-15 / REP-10: role=source ignores transfers into the envelope', async () => {
    const { ids, home, food } = await setup();
    const both = await list({ period: '2026-01', type: 'transfer', envelopeId: home.id });
    expect(idsOf(both)).toEqual([ids.transferIn, ids.transferOut].sort());
    expect(idsOf(await list({ period: '2026-01', type: 'transfer', envelopeId: home.id, role: 'source' }))).toEqual([
      ids.transferOut,
    ]);
    // Food only receives transferOut: with role=source it is not matched, and the default keeps source-or-destination
    expect(idsOf(await list({ period: '2026-01', type: 'transfer', envelopeId: food.id, role: 'source' }))).toEqual([
      ids.transferIn,
    ]);
    expect(idsOf(await list({ period: '2026-01', type: 'transfer', envelopeId: food.id }))).toEqual(
      [ids.transferIn, ids.transferOut].sort(),
    );
  });

  it('HIST-15: filters combine (period, envelope, type, role, uncoveredOnly)', async () => {
    const { ids, home, food } = await setup();
    expect(
      idsOf(await list({ period: '2026-01', envelopeId: home.id, role: 'source', uncoveredOnly: 'true' })),
    ).toEqual([ids.transferOut, ids.uncoveredExpense, ids.negAdj].sort());
    expect(idsOf(await list({ period: '2026-01', envelopeId: home.id, type: 'expense', uncoveredOnly: 'true' }))).toEqual([
      ids.uncoveredExpense,
    ]);
    expect(await list({ period: '2026-01', envelopeId: food.id, role: 'source', uncoveredOnly: 'true' })).toEqual([]);
    expect(await list({ period: '2026-02', uncoveredOnly: 'true' })).toEqual([]);
  });

  it('HIST-15 / API-17: invalid role or uncoveredOnly is a 422 VALIDATION_ERROR', async () => {
    await http().get('/api/v1/operations').query({ role: 'destination' }).expect(422);
    await http().get('/api/v1/operations').query({ uncoveredOnly: 'yes' }).expect(422);
  });
});
