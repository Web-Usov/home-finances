import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request = require('supertest');
import type { BudgetMonth, Envelope } from '@prisma/client';
import { AllocationsModule } from './allocations.module';
import { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainExceptionFilter } from '../../common/filters/domain-exception.filter';

const ENV_A = '11111111-1111-1111-1111-111111111111';
const ENV_B = '33333333-3333-3333-3333-333333333333';

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    period: '2026-08',
    status: 'open',
    incomeMinor: 10_000_000, // 100 000.00 ₽
    version: 3,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: ENV_A,
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

function createMockPrisma() {
  const mock = {
    budgetMonth: {
      findUnique: jest.fn(),
    },
    envelope: {
      findMany: jest.fn(),
    },
    allocation: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    envelopeMonthSnapshot: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function createMockEngine() {
  return {
    recalculateMonthAtomically: jest.fn(),
  };
}

type MockEngine = ReturnType<typeof createMockEngine>;

/** Happy-path stubs: open month version 3, both envelopes active, one snapshot. */
function setupSaveDefaults(mock: MockPrisma, engine: MockEngine): void {
  mock.budgetMonth.findUnique.mockResolvedValue(makeMonth());
  mock.envelope.findMany.mockResolvedValue([
    makeEnvelope({ id: ENV_A, name: 'Еда' }),
    makeEnvelope({ id: ENV_B, name: 'Дом', displayOrder: 1 }),
  ]);
  mock.allocation.deleteMany.mockResolvedValue({ count: 1 });
  mock.allocation.createMany.mockResolvedValue({ count: 2 });
  mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
    {
      envelopeId: ENV_A,
      envelope: { name: 'Еда' },
      opening: 0,
      initial: 0,
      allocation: 5_000_000,
      expensesRequested: 0,
      expensesCovered: 0,
      adjustmentApplied: 0,
      transfersIn: 0,
      transfersOut: 0,
      closing: 5_000_000,
      uncoveredByType: {},
    },
  ]);
  engine.recalculateMonthAtomically.mockResolvedValue({
    recalculatedFrom: '2026-08',
    warnings: [],
  });
}

describe('Allocations HTTP integration', () => {
  let app: NestFastifyApplication;
  let mock: MockPrisma;
  let engine: MockEngine;

  beforeEach(async () => {
    mock = createMockPrisma();
    engine = createMockEngine();

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AllocationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mock)
      .overrideProvider(CalculationEngineService)
      .useValue(engine)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('PUT /api/v1/months/:period/allocations saves the table and returns summary + warnings', async () => {
    setupSaveDefaults(mock, engine);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '50000.00', [ENV_B]: '25000.00' }, version: 3 })
      .expect(200);

    expect(response.body.warnings).toEqual([]);
    expect(response.body.data).toMatchObject({
      period: '2026-08',
      status: 'open',
      incomeMinor: 10_000_000,
      totalAllocatedMinor: 7_500_000,
      freeFundsMinor: 2_500_000,
    });
    expect(response.body.data.envelopes).toHaveLength(1);
    expect(response.body.data.envelopes[0]).toMatchObject({
      envelopeId: ENV_A,
      envelopeName: 'Еда',
      allocation: 5_000_000,
      closing: 5_000_000,
      uncovered: 0,
    });

    // Atomicity: source mutation + cascade recalc share one transaction client.
    expect(mock.allocation.deleteMany).toHaveBeenCalledWith({
      where: { monthId: '22222222-2222-2222-2222-222222222222' },
    });
    expect(mock.allocation.createMany).toHaveBeenCalledWith({
      data: [
        { monthId: '22222222-2222-2222-2222-222222222222', envelopeId: ENV_A, amountMinor: 5_000_000 },
        { monthId: '22222222-2222-2222-2222-222222222222', envelopeId: ENV_B, amountMinor: 2_500_000 },
      ],
    });
    expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      mock,
    );
    expect(mock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('PUT allocations above income → 422 with the exact spec message', async () => {
    setupSaveDefaults(mock, engine);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '60000.00', [ENV_B]: '40001.00' }, version: 3 })
      .expect(422);

    expect(response.body).toEqual({
      error: 'ALLOCATION_EXCEEDS_INCOME',
      message: 'Распределено на 1.00 ₽ больше дохода. Уменьшите суммы по конвертам.',
    });
    expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
    expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
  });

  it('PUT with a stale version → 409 VERSION_CONFLICT', async () => {
    setupSaveDefaults(mock, engine);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '100.00' }, version: 2 })
      .expect(409);

    expect(response.body.error).toBe('VERSION_CONFLICT');
    expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
  });

  it('PUT into a closed month → 409 MONTH_LOCKED with the spec message', async () => {
    setupSaveDefaults(mock, engine);
    mock.budgetMonth.findUnique.mockResolvedValue(makeMonth({ status: 'closed' }));

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '100.00' }, version: 3 })
      .expect(409);

    expect(response.body).toEqual({
      error: 'MONTH_LOCKED',
      message: 'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
    });
    expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
    expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
  });

  it('PUT for an archived envelope → 404 ENVELOPE_NOT_FOUND', async () => {
    setupSaveDefaults(mock, engine);
    mock.envelope.findMany.mockResolvedValue([
      makeEnvelope({ id: ENV_A }),
      makeEnvelope({ id: ENV_B, name: 'Старое', status: 'archived', archivedPeriod: '2026-07' }),
    ]);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '100.00', [ENV_B]: '200.00' }, version: 3 })
      .expect(404);

    expect(response.body.error).toBe('ENVELOPE_NOT_FOUND');
    expect(response.body.message).toContain('архивирован');
    expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
    expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
  });

  it('PUT for an unknown period → 404 MONTH_NOT_FOUND', async () => {
    setupSaveDefaults(mock, engine);
    mock.budgetMonth.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '100.00' }, version: 3 })
      .expect(404);

    expect(response.body.error).toBe('MONTH_NOT_FOUND');
    expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
  });

  it('PUT without version → 400 from the Zod validation pipe', async () => {
    setupSaveDefaults(mock, engine);

    const response = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: '100.00' } })
      .expect(400);

    expect(response.body.message).toBe('Validation failed');
    expect(mock.budgetMonth.findUnique).not.toHaveBeenCalled();
  });

  it('PUT with a non-decimal amount or non-uuid envelope key → 400', async () => {
    setupSaveDefaults(mock, engine);

    const badAmount = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { [ENV_A]: 'abc' }, version: 3 })
      .expect(400);
    expect(badAmount.body.message).toBe('Validation failed');

    const badKey = await request(app.getHttpServer())
      .put('/api/v1/months/2026-08/allocations')
      .send({ allocations: { 'not-a-uuid': '100.00' }, version: 3 })
      .expect(400);
    expect(badKey.body.message).toBe('Validation failed');

    expect(mock.budgetMonth.findUnique).not.toHaveBeenCalled();
  });
});
