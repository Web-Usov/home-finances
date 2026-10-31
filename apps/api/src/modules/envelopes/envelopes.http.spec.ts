import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import type { BudgetMonth, Envelope } from '@prisma/client';
import { EnvelopesModule } from './envelopes.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { configureApp } from '../../app.setup';

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Еда',
    status: 'active',
    createdPeriod: '2026-08',
    archivedPeriod: null,
    displayOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    period: '2026-08',
    status: 'open',
    incomeMinor: 1_500_000,
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockPrisma() {
  const mock = {
    envelope: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    budgetMonth: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    operation: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    envelopeMonthSnapshot: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  // The `FOR UPDATE` month-lock query (bind value = month id) returns the month stubbed on budgetMonth.
  mock.$queryRaw.mockImplementation(async (_sql: unknown, id: string) => {
    const months = ((await mock.budgetMonth.findMany()) ?? []) as BudgetMonth[];
    const fallback = (await mock.budgetMonth.findFirst()) as BudgetMonth | null;
    const month = [...months, ...(fallback === null || fallback === undefined ? [] : [fallback])].find(
      (m) => m.id === id,
    );
    return month === undefined ? [] : [month];
  });
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function setupCreateDefaults(mock: MockPrisma, month: BudgetMonth = makeMonth()): void {
  mock.budgetMonth.findMany.mockResolvedValue([month]);
  mock.budgetMonth.findFirst.mockResolvedValue(month);
  mock.envelope.findFirst.mockResolvedValue(null);
  mock.envelope.aggregate.mockResolvedValue({ _max: { displayOrder: 0 } });
  mock.envelope.create.mockImplementation(({ data }: { data: Partial<Envelope> }) =>
    Promise.resolve(
      makeEnvelope({
        name: String(data.name),
        createdPeriod: String(data.createdPeriod),
        displayOrder: Number(data.displayOrder),
      }),
    ),
  );
  mock.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: null } });
  mock.operation.create.mockResolvedValue({});
}

describe('Envelopes HTTP integration', () => {
  let app: NestFastifyApplication;
  let mock: MockPrisma;

  beforeEach(async () => {
    mock = createMockPrisma();

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, EnvelopesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mock)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
    configureApp(app);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('GET /api/v1/envelopes returns balances from latest snapshots', async () => {
    mock.envelope.findMany.mockResolvedValue([
      makeEnvelope({ id: 'env-a', name: 'Еда', displayOrder: 0 }),
      makeEnvelope({ id: 'env-b', name: 'Дом', displayOrder: 1 }),
    ]);
    mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
      { envelopeId: 'env-a', closing: 25_050, month: { period: '2026-07' } },
      { envelopeId: 'env-b', closing: 50_000, month: { period: '2026-06' } },
    ]);

    const response = await request(app.getHttpServer()).get('/api/v1/envelopes').expect(200);

    expect(response.body.envelopes).toHaveLength(2);
    expect(response.body.envelopes[0]).toMatchObject({ id: 'env-a', name: 'Еда', balanceMinor: 25_050 });
    expect(response.body.envelopes[1]).toMatchObject({ id: 'env-b', name: 'Дом', balanceMinor: 50_000 });
  });

  it('POST /api/v1/envelopes creates an envelope', async () => {
    setupCreateDefaults(mock);

    const response = await request(app.getHttpServer())
      .post('/api/v1/envelopes')
      .send({ name: 'Еда' })
      .expect(201);

    expect(response.body.envelope).toMatchObject({
      name: 'Еда',
      createdPeriod: '2026-08',
      displayOrder: 1,
      balanceMinor: 0,
    });
    expect(mock.envelope.create).toHaveBeenCalledWith({
      data: { name: 'Еда', createdPeriod: '2026-08', displayOrder: 1 },
    });
  });

  it('POST /api/v1/envelopes rejects duplicate names', async () => {
    setupCreateDefaults(mock);
    mock.envelope.findFirst.mockResolvedValue({ id: 'existing-env' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/envelopes')
      .send({ name: 'еда' })
      .expect(409);

    expect(response.body).toMatchObject({
      error: 'ENVELOPE_NAME_DUPLICATE',
      message: 'Конверт с названием «еда» уже существует.',
    });
  });

  it('POST /api/v1/envelopes rejects creation when the month is closed', async () => {
    mock.budgetMonth.findMany.mockResolvedValue([]);
    mock.budgetMonth.findFirst.mockResolvedValue(makeMonth({ status: 'closed' }));

    const response = await request(app.getHttpServer())
      .post('/api/v1/envelopes')
      .send({ name: 'Еда' })
      .expect(409);

    expect(response.body).toMatchObject({
      error: 'MONTH_LOCKED',
      message: 'Месяц 2026-08 закрыт. Создание конвертов в закрытом месяце запрещено.',
    });
  });

  it('PATCH /api/v1/envelopes/:id renames an envelope', async () => {
    mock.envelope.findUnique.mockResolvedValue(makeEnvelope({ id: 'env-a', name: 'Еда' }));
    mock.envelope.findFirst.mockResolvedValue(null);
    mock.envelope.update.mockResolvedValue(makeEnvelope({ id: 'env-a', name: 'Продукты', displayOrder: 4 }));

    const response = await request(app.getHttpServer())
      .patch('/api/v1/envelopes/env-a')
      .send({ name: 'Продукты', displayOrder: 4 })
      .expect(200);

    expect(response.body.envelope).toMatchObject({
      id: 'env-a',
      name: 'Продукты',
      displayOrder: 4,
    });
    expect(mock.envelope.update).toHaveBeenCalledWith({
      where: { id: 'env-a' },
      data: { name: 'Продукты', displayOrder: 4 },
    });
  });

  it('PATCH /api/v1/envelopes/:id returns 404 for a missing envelope', async () => {
    mock.envelope.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/envelopes/missing-env')
      .send({ name: 'Продукты' })
      .expect(404);

    expect(response.body).toMatchObject({
      error: 'ENVELOPE_NOT_FOUND',
      message: 'Конверт не найден: missing-env',
    });
  });

  it('POST /api/v1/envelopes/:id/archive archives a zero-balance envelope', async () => {
    mock.envelope.findUnique.mockResolvedValue(makeEnvelope({ id: 'env-a', name: 'Еда' }));
    mock.budgetMonth.findMany.mockResolvedValue([makeMonth({ status: 'open' })]);
    mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
      { envelopeId: 'env-a', closing: 0, month: { period: '2026-08' } },
    ]);
    mock.envelope.update.mockResolvedValue(
      makeEnvelope({ id: 'env-a', status: 'archived', archivedPeriod: '2026-08' }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/envelopes/env-a/archive')
      .expect(201);

    expect(response.body.envelope).toMatchObject({
      id: 'env-a',
      status: 'archived',
      archivedPeriod: '2026-08',
    });
  });

  it('POST /api/v1/envelopes/:id/archive rejects non-empty envelopes', async () => {
    mock.envelope.findUnique.mockResolvedValue(makeEnvelope({ id: 'env-a', name: 'Еда' }));
    mock.budgetMonth.findMany.mockResolvedValue([makeMonth({ status: 'open' })]);
    mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
      { envelopeId: 'env-a', closing: 50_000, month: { period: '2026-08' } },
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/v1/envelopes/env-a/archive')
      .expect(409);

    expect(response.body).toMatchObject({
      error: 'ENVELOPE_NOT_EMPTY',
      message:
        'Невозможно архивировать конверт «Еда»: баланс 500.00 ₽. Переведите остаток или сделайте отрицательную корректировку.',
    });
  });
});
