import type { BudgetMonth } from '@prisma/client';
import { ConflictException, ValidationException } from '../../common/exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import { MonthsService } from './months.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: 'month-1',
    period: '2026-08',
    status: 'open',
    incomeMinor: 0,
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma mock — mirrors the client surface used by MonthsService.
// $transaction hands the same mock to the callback as the tx client.
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const mock = {
    budgetMonth: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    allocation: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function createService(mock: MockPrisma): MonthsService {
  return new MonthsService(mock as unknown as PrismaService);
}

describe('MonthsService', () => {
  let mock: MockPrisma;
  let service: MonthsService;

  beforeEach(() => {
    mock = createMockPrisma();
    service = createService(mock);
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('returns an empty list when no months exist', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual({ months: [] });
      expect(mock.allocation.findMany).not.toHaveBeenCalled();
    });

    it('returns months with allocation totals and free funds', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ id: 'm1', period: '2026-07', status: 'closed', incomeMinor: 1_000_000 }),
        makeMonth({ id: 'm2', period: '2026-08', status: 'open', incomeMinor: 1_500_000 }),
      ]);
      mock.allocation.findMany.mockResolvedValue([
        { monthId: 'm1', amountMinor: 400_000 },
        { monthId: 'm2', amountMinor: 500_000 },
        { monthId: 'm2', amountMinor: 250_000 },
      ]);

      const { months } = await service.list();

      expect(months.map((m) => m.period)).toEqual(['2026-07', '2026-08']);
      expect(months[0]).toMatchObject({
        status: 'closed',
        totalAllocatedMinor: 400_000,
        freeFundsMinor: 600_000,
      });
      expect(months[1]).toMatchObject({
        status: 'open',
        totalAllocatedMinor: 750_000,
        freeFundsMinor: 750_000,
        version: 1,
      });
    });
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe('create', () => {
    beforeEach(() => {
      mock.budgetMonth.create.mockImplementation(({ data }: { data: Partial<BudgetMonth> }) =>
        Promise.resolve(makeMonth({ id: 'month-new', ...data })),
      );
    });

    it('creates the very first month as open with zero income', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);

      const result = await service.create({ period: '2026-08' });

      expect(mock.budgetMonth.create).toHaveBeenCalledWith({
        data: { period: '2026-08', status: 'open', incomeMinor: 0 },
      });
      expect(result.month).toMatchObject({
        period: '2026-08',
        status: 'open',
        incomeMinor: 0,
        totalAllocatedMinor: 0,
        freeFundsMinor: 0,
      });
    });

    it('creates the next month as draft when an open month exists', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([makeMonth({ period: '2026-08', status: 'open' })]);

      const result = await service.create({ period: '2026-09' });

      expect(mock.budgetMonth.create).toHaveBeenCalledWith({
        data: { period: '2026-09', status: 'draft', incomeMinor: 0 },
      });
      expect(result.month.status).toBe('draft');
    });

    it('rejects creation when a draft already exists (only one draft allowed)', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ id: 'm-open', period: '2026-08', status: 'open' }),
        makeMonth({ id: 'm-draft', period: '2026-09', status: 'draft' }),
      ]);

      await expect(service.create({ period: '2026-10' })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.create({ period: '2026-10' })).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        statusCode: 409,
      });
      expect(mock.budgetMonth.create).not.toHaveBeenCalled();
    });

    it('creates as open when the latest month is closed and no draft exists', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ period: '2026-08', status: 'closed' }),
      ]);

      const result = await service.create({ period: '2026-09' });

      expect(mock.budgetMonth.create).toHaveBeenCalledWith({
        data: { period: '2026-09', status: 'open', incomeMinor: 0 },
      });
      expect(result.month.status).toBe('open');
    });

    it('rejects a period gap with 422 INVALID_PERIOD', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([makeMonth({ period: '2026-08', status: 'open' })]);

      await expect(service.create({ period: '2026-11' })).rejects.toBeInstanceOf(
        ValidationException,
      );
      await expect(service.create({ period: '2026-11' })).rejects.toMatchObject({
        code: 'INVALID_PERIOD',
        statusCode: 422,
      });
      expect(mock.budgetMonth.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate or past period as a gap', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ period: '2026-08', status: 'closed' }),
      ]);

      await expect(service.create({ period: '2026-08' })).rejects.toMatchObject({
        code: 'INVALID_PERIOD',
        statusCode: 422,
      });
      await expect(service.create({ period: '2026-07' })).rejects.toMatchObject({
        code: 'INVALID_PERIOD',
        statusCode: 422,
      });
      expect(mock.budgetMonth.create).not.toHaveBeenCalled();
    });

    it('parses a provided income into kopecks', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);

      const result = await service.create({ period: '2026-08', income: '15000.50' });

      expect(mock.budgetMonth.create).toHaveBeenCalledWith({
        data: { period: '2026-08', status: 'open', incomeMinor: 1_500_050 },
      });
      expect(result.month.incomeMinor).toBe(1_500_050);
      expect(result.month.freeFundsMinor).toBe(1_500_050);
    });

    it('accepts the year rollover as the next period', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ period: '2026-12', status: 'open' }),
      ]);

      const result = await service.create({ period: '2027-01' });

      expect(mock.budgetMonth.create).toHaveBeenCalledWith({
        data: { period: '2027-01', status: 'draft', incomeMinor: 0 },
      });
      expect(result.month.period).toBe('2027-01');
    });
  });
});
