import type { BudgetMonth } from '@prisma/client';
import type { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
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

function createMockEngine() {
  return { recalculateMonthAtomically: jest.fn() };
}

type MockEngine = ReturnType<typeof createMockEngine>;

function createService(mock: MockPrisma, engine: MockEngine): MonthsService {
  return new MonthsService(
    mock as unknown as PrismaService,
    engine as unknown as CalculationEngineService,
  );
}

describe('MonthsService', () => {
  let mock: MockPrisma;
  let engine: MockEngine;
  let service: MonthsService;

  beforeEach(() => {
    mock = createMockPrisma();
    engine = createMockEngine();
    engine.recalculateMonthAtomically.mockResolvedValue({
      recalculatedFrom: '2026-08',
      warnings: [],
    });
    service = createService(mock, engine);
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
      mock.allocation.findMany.mockResolvedValue([]);
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

    // -----------------------------------------------------------------------
    // allocation copying (spec line 356: plan copied as editable values;
    // line 293: archived envelopes are excluded from new allocations)
    // -----------------------------------------------------------------------

    it('copies allocations from the previous month for active envelopes only', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ id: 'month-prev', period: '2026-08', status: 'open', incomeMinor: 1_000_000 }),
      ]);
      mock.allocation.findMany.mockResolvedValue([
        { envelopeId: 'env-a', amountMinor: 100_000, envelope: { status: 'active' } },
        { envelopeId: 'env-b', amountMinor: 200_000, envelope: { status: 'archived' } },
        { envelopeId: 'env-c', amountMinor: 50_000, envelope: { status: 'active' } },
      ]);

      const result = await service.create({ period: '2026-09', income: '10000.00' });

      expect(mock.allocation.findMany).toHaveBeenCalledWith({
        where: { monthId: 'month-prev' },
        select: { envelopeId: true, amountMinor: true, envelope: { select: { status: true } } },
      });
      expect(mock.allocation.createMany).toHaveBeenCalledWith({
        data: [
          { monthId: 'month-new', envelopeId: 'env-a', amountMinor: 100_000 },
          { monthId: 'month-new', envelopeId: 'env-c', amountMinor: 50_000 },
        ],
      });
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
      expect(result.month).toMatchObject({
        totalAllocatedMinor: 150_000,
        freeFundsMinor: 850_000,
      });
    });

    it('copies nothing when there is no previous month', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);

      await service.create({ period: '2026-08' });

      expect(mock.allocation.findMany).not.toHaveBeenCalled();
      expect(mock.allocation.createMany).not.toHaveBeenCalled();
    });

    it('skips createMany when the previous month has no active allocations', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ id: 'month-prev', period: '2026-08', status: 'open' }),
      ]);
      mock.allocation.findMany.mockResolvedValue([
        { envelopeId: 'env-b', amountMinor: 200_000, envelope: { status: 'archived' } },
      ]);

      const result = await service.create({ period: '2026-09' });

      expect(mock.allocation.createMany).not.toHaveBeenCalled();
      expect(result.month.totalAllocatedMinor).toBe(0);
    });

    it('copies from a closed previous month into the new open month', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([
        makeMonth({ id: 'month-prev', period: '2026-08', status: 'closed' }),
      ]);
      mock.allocation.findMany.mockResolvedValue([
        { envelopeId: 'env-a', amountMinor: 300_000, envelope: { status: 'active' } },
      ]);

      const result = await service.create({ period: '2026-09' });

      expect(mock.allocation.createMany).toHaveBeenCalledWith({
        data: [{ monthId: 'month-new', envelopeId: 'env-a', amountMinor: 300_000 }],
      });
      expect(result.month.status).toBe('open');
      expect(result.month.totalAllocatedMinor).toBe(300_000);
    });
  });

  // -------------------------------------------------------------------------
  // updateIncome()
  // -------------------------------------------------------------------------

  describe('updateIncome', () => {
    // Distinct tx client: proves source write + engine run on the transaction, not on prisma.
    let tx: ReturnType<typeof createMockTx>;

    function createMockTx() {
      return {
        budgetMonth: { findUnique: jest.fn(), update: jest.fn() },
        allocation: { aggregate: jest.fn() },
      };
    }

    function stub(month: BudgetMonth, allocatedMinor = 0): void {
      mock.budgetMonth.findUnique.mockResolvedValue(month);
      tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: allocatedMinor } });
      // Re-read after the cascade: the engine bumped the version.
      tx.budgetMonth.findUnique.mockImplementation(() =>
        Promise.resolve(makeMonth({ ...month, incomeMinor: lastIncome, version: month.version + 1 })),
      );
    }

    let lastIncome = 0;

    beforeEach(() => {
      tx = createMockTx();
      lastIncome = 0;
      mock.$transaction.mockImplementation((callback: (client: unknown) => unknown) =>
        callback(tx),
      );
      tx.budgetMonth.update.mockImplementation(({ data }: { data: { incomeMinor: number } }) => {
        lastIncome = data.incomeMinor;
        return Promise.resolve(makeMonth());
      });
    });

    it('API-03 / API-15 / API-16 / DATA-12: updates income and cascade in one tx, bumps version, returns summary + warnings', async () => {
      const month = makeMonth({ id: 'month-1', period: '2026-08', status: 'open', version: 3 });
      stub(month, 600_000);
      const warnings = [{ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'w' }];
      engine.recalculateMonthAtomically.mockResolvedValue({
        recalculatedFrom: '2026-08',
        warnings,
      });

      const result = await service.updateIncome('2026-08', { income: '20000.00', version: 3 });

      expect(tx.budgetMonth.update).toHaveBeenCalledWith({
        where: { id: 'month-1' },
        data: { incomeMinor: 2_000_000 },
      });
      expect(mock.budgetMonth.update).not.toHaveBeenCalled();
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
      // same-transaction proof + version bump (the engine owns the increment, ADR 0005)
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
      expect(result.data).toMatchObject({
        period: '2026-08',
        incomeMinor: 2_000_000,
        version: 4,
        totalAllocatedMinor: 600_000,
        freeFundsMinor: 1_400_000,
      });
      expect(result.warnings).toEqual(warnings);
    });

    it('AC-02: free funds = income - allocations after income update', async () => {
      stub(makeMonth({ status: 'open', version: 1 }), 75_000_00);

      const result = await service.updateIncome('2026-08', { income: '100000.00', version: 1 });

      expect(result.data.freeFundsMinor).toBe(25_000_00);
    });

    it('FIN-02 / AC-03: income below allocated sum is rejected with ALLOCATION_EXCEEDS_INCOME', async () => {
      stub(makeMonth({ status: 'open', version: 1 }), 10_000_001);

      const attempt = service.updateIncome('2026-08', { income: '100000.00', version: 1 });

      await expect(attempt).rejects.toBeInstanceOf(ValidationException);
      await expect(attempt).rejects.toMatchObject({
        code: 'ALLOCATION_EXCEEDS_INCOME',
        statusCode: 422,
      });
      await expect(attempt).rejects.toThrow(
        'Распределено на 0.01 ₽ больше дохода. Уменьшите суммы по конвертам.',
      );
      expect(tx.budgetMonth.update).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('FIN-02: income equal to the allocated sum is accepted', async () => {
      stub(makeMonth({ status: 'open', version: 1 }), 10_000_000);

      const result = await service.updateIncome('2026-08', { income: '100000.00', version: 1 });

      expect(result.data.freeFundsMinor).toBe(0);
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledTimes(1);
    });

    it('API-03: throws MONTH_NOT_FOUND for an unknown period', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(null);

      const attempt = service.updateIncome('2026-13', { income: '100.00', version: 1 });

      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
      await expect(attempt).rejects.toMatchObject({ code: 'MONTH_NOT_FOUND', statusCode: 404 });
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('DATA-12: stale version returns VERSION_CONFLICT', async () => {
      stub(makeMonth({ status: 'open', version: 3 }));

      await expect(
        service.updateIncome('2026-08', { income: '100.00', version: 2 }),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', statusCode: 409 });
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('MON-03 / AC-14: income update in a closed month returns MONTH_LOCKED (MSG-06)', async () => {
      stub(makeMonth({ status: 'closed', version: 3 }));

      const attempt = service.updateIncome('2026-08', { income: '100.00', version: 3 });

      await expect(attempt).rejects.toMatchObject({
        code: 'MONTH_LOCKED',
        statusCode: 409,
      });
      await expect(attempt).rejects.toThrow(
        'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
      );
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('DATA-12: the version is checked before the closed-month lock', async () => {
      stub(makeMonth({ status: 'closed', version: 3 }));

      await expect(
        service.updateIncome('2026-08', { income: '100.00', version: 99 }),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    });

    it.each(['draft', 'reopened'] as const)('allows income changes in a %s month', async (status) => {
      stub(makeMonth({ status, version: 2 }));

      await service.updateIncome('2026-08', { income: '5000.00', version: 2 });

      expect(tx.budgetMonth.update).toHaveBeenCalledWith({
        where: { id: 'month-1' },
        data: { incomeMinor: 500_000 },
      });
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
    });
  });
});
