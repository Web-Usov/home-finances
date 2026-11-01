import request from 'supertest';
import { EnvelopesModule } from '../envelopes/envelopes.module';
import { MonthsModule } from '../months/months.module';
import { OperationsModule } from './operations.module';
import { createMonth, resetDb } from '../../../test/db';
import { createTestApp, TestApp, etag } from '../../../test/http';

interface HistoryItem {
  period: string;
  type: string;
  sourceEnvelopeId: string;
  destinationEnvelopeId: string | null;
  requestedMinor: number;
  result: { coveredMinor: number; uncoveredMinor: number } | null;
  [key: string]: unknown;
}

/** HTTP + real DB + real engine: the fields every operation of `GET /operations` carries (HIST-01..HIST-04). */
describe('Operations history fields (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp([OperationsModule, EnvelopesModule, MonthsModule]);
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
  });
  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  const http = () => request(t.app.getHttpServer());

  async function setup() {
    const jan = await createMonth(t.prisma, { period: '2026-01', incomeMinor: 10_000_000 });
    const food = (await http().post('/api/v1/envelopes').send({ name: 'Food', initialBalance: '1000.00' }).expect(201)).body.envelope;
    const home = (await http().post('/api/v1/envelopes').send({ name: 'Home', initialBalance: '200.00' }).expect(201)).body.envelope;
    const add = async (body: object) => {
      const version = (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { id: jan.id } })).version;
      await http()
        .post('/api/v1/operations')
        .set('If-Match', etag(version))
        .send({ period: '2026-01', ...body })
        .expect(201);
    };
    await add({ type: 'expense', sourceEnvelopeId: food.id, amount: '1500.00', comment: 'Больше, чем есть' });
    await add({ type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: food.id, amount: '150.00' });
    await add({ type: 'adjustment', sign: '+', sourceEnvelopeId: home.id, amount: '50.00' });
    const items = (await http().get('/api/v1/operations').query({ period: '2026-01' }).expect(200)).body.operations as HistoryItem[];
    return { food: food.id as string, home: home.id as string, items };
  }

  const byType = (items: HistoryItem[], type: string) => items.filter((item) => item.type === type);

  it('HIST-01: every operation belongs to a month and carries no exact date', async () => {
    const { items } = await setup();
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item.period).toBe('2026-01');
      const keys = Object.keys(item).map((key) => key.toLowerCase());
      expect(keys.filter((key) => /^(date|day|occurredat|operationdate)$/.test(key))).toEqual([]);
    }
  });

  it('HIST-02: the type is one of expense, transfer, adjustment or initial balance', async () => {
    const { items } = await setup();
    expect(byType(items, 'expense')).toHaveLength(1);
    expect(byType(items, 'transfer')).toHaveLength(1);
    expect(byType(items, 'adjustment')).toHaveLength(1);
    expect(byType(items, 'initial_balance')).toHaveLength(2);
    expect(items.map((item) => item.type).sort()).toEqual(['adjustment', 'expense', 'initial_balance', 'initial_balance', 'transfer']);
  });

  it('HIST-03: the source envelope is always present, the destination only for a transfer', async () => {
    const { items, food, home } = await setup();
    const [transfer] = byType(items, 'transfer');
    expect([transfer?.sourceEnvelopeId, transfer?.destinationEnvelopeId]).toEqual([home, food]);
    expect(byType(items, 'expense')[0]).toMatchObject({ sourceEnvelopeId: food, destinationEnvelopeId: null });
    expect(byType(items, 'adjustment')[0]).toMatchObject({ sourceEnvelopeId: home, destinationEnvelopeId: null });
  });

  it('HIST-04: the full requested amount, the covered amount and the uncovered part are reported', async () => {
    const { items } = await setup();
    const [expense] = byType(items, 'expense');
    // Food holds 1000.00, the expense asks 1500.00: 1000.00 is covered, 500.00 is not
    expect(expense?.requestedMinor).toBe(150_000);
    expect(expense?.result).toMatchObject({ coveredMinor: 100_000, uncoveredMinor: 50_000 });
    const [transfer] = byType(items, 'transfer');
    expect(transfer?.requestedMinor).toBe(15_000);
    expect(transfer?.result).toMatchObject({ coveredMinor: 15_000, uncoveredMinor: 0 });
  });
});
