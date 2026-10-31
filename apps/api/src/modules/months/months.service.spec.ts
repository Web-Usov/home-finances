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
      tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: allocatedMinor } });
      // First read (inside the tx) returns the month; the re-read after the cascade sees the bumped version.
      tx.budgetMonth.findUnique.mockResolvedValueOnce(month);
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
      tx.budgetMonth.findUnique.mockResolvedValue(null);

      const attempt = service.updateIncome('2026-13', { income: '100.00', version: 1 });

      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
      await expect(attempt).rejects.toMatchObject({ code: 'MONTH_NOT_FOUND', statusCode: 404 });
      expect(mock.budgetMonth.findUnique).not.toHaveBeenCalled(); // read happens on tx, not prisma
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('DATA-12: stale version returns VERSION_CONFLICT', async () => {
      stub(makeMonth({ status: 'open', version: 3 }));

      await expect(
        service.updateIncome('2026-08', { income: '100.00', version: 2 }),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', statusCode: 409 });
      expect(tx.budgetMonth.update).not.toHaveBeenCalled();
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
      expect(tx.budgetMonth.update).not.toHaveBeenCalled();
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

  // -------------------------------------------------------------------------
  // close() / reopen()
  // -------------------------------------------------------------------------

  describe('close / reopen', () => {
    let tx: ReturnType<typeof createMockTx>;

    function createMockTx() {
      return {
        budgetMonth: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        allocation: { aggregate: jest.fn() },
      };
    }

    beforeEach(() => {
      tx = createMockTx();
      mock.$transaction.mockImplementation((callback: (client: unknown) => unknown) =>
        callback(tx),
      );
      tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 0 } });
      // update echoes the row with the applied data, bumping version on `increment`
      tx.budgetMonth.update.mockImplementation(
        ({ where, data }: { where: { id: string }; data: Partial<BudgetMonth> & { version?: unknown } }) => {
          const base = where.id === 'draft-1' ? draftMonth : currentMonth;
          const bumped = typeof data.version === 'object' ? base.version + 1 : base.version;
          return Promise.resolve({ ...base, ...data, version: bumped });
        },
      );
    });

    let currentMonth: BudgetMonth;
    let draftMonth: BudgetMonth;

    function setup(current: Partial<BudgetMonth>, draft: BudgetMonth | null) {
      currentMonth = makeMonth({ id: 'month-1', period: '2026-08', status: 'open', version: 4, ...current });
      draftMonth = draft ?? makeMonth({ id: 'draft-1', period: '2026-09', status: 'draft', version: 2 });
      tx.budgetMonth.findUnique.mockResolvedValue(currentMonth);
      tx.budgetMonth.findFirst.mockImplementation(({ where }: { where?: { status?: string } }) =>
        Promise.resolve(where?.status === 'draft' ? draft : null),
      );
    }

    describe('close', () => {
      it('MON-08 / AC-17: closing the current month promotes the existing draft to open', async () => {
        setup({}, makeMonth({ id: 'draft-1', period: '2026-09', status: 'draft', version: 2 }));

        const result = await service.close('2026-08', { version: 4 });

        expect(tx.budgetMonth.update).toHaveBeenCalledWith({
          where: { id: 'month-1' },
          data: { status: 'closed', version: { increment: 1 } },
        });
        expect(tx.budgetMonth.update).toHaveBeenCalledWith({
          where: { id: 'draft-1' },
          data: { status: 'open', version: { increment: 1 } },
        });
        expect(mock.$transaction).toHaveBeenCalledTimes(1);
        expect(mock.budgetMonth.update).not.toHaveBeenCalled();
        expect(result.data.month).toMatchObject({ period: '2026-08', status: 'closed', version: 5 });
        expect(result.data.promotedDraft).toMatchObject({ period: '2026-09', status: 'open', version: 3 });
      });

      it('MON-09: closing without a draft promotes nothing', async () => {
        setup({}, null);

        const result = await service.close('2026-08', { version: 4 });

        expect(result.data.promotedDraft).toBeNull();
        expect(tx.budgetMonth.update).toHaveBeenCalledTimes(1);
      });

      it('MON-15: closing a reopened month does not promote the draft', async () => {
        setup({ status: 'reopened' }, makeMonth({ id: 'draft-1', period: '2026-09', status: 'draft' }));

        const result = await service.close('2026-08', { version: 4 });

        expect(result.data.month.status).toBe('closed');
        expect(result.data.promotedDraft).toBeNull();
        expect(tx.budgetMonth.findFirst).not.toHaveBeenCalled();
        expect(tx.budgetMonth.update).toHaveBeenCalledTimes(1);
      });

      it('MON-01 / AC-16: a draft cannot be closed', async () => {
        setup({ status: 'draft' }, null);

        await expect(service.close('2026-08', { version: 4 })).rejects.toMatchObject({
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 409,
        });
        expect(tx.budgetMonth.update).not.toHaveBeenCalled();
      });

      it('an already closed month cannot be closed again', async () => {
        setup({ status: 'closed' }, null);

        await expect(service.close('2026-08', { version: 4 })).rejects.toMatchObject({
          code: 'INVALID_STATUS_TRANSITION',
        });
      });

      it('MON-10: free funds and uncovered operations do not block closing', async () => {
        setup({ incomeMinor: 10_000_000 }, null);
        tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 100 } });

        const result = await service.close('2026-08', { version: 4 });

        expect(result.data.month.freeFundsMinor).toBe(9_999_900);
        expect(result.warnings).toEqual([]);
      });

      it('MON-11 / FIN-02: allocations above income block closing', async () => {
        setup({ incomeMinor: 1_000 }, null);
        tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 1_001 } });

        await expect(service.close('2026-08', { version: 4 })).rejects.toMatchObject({
          code: 'ALLOCATION_EXCEEDS_INCOME',
          statusCode: 422,
        });
        expect(tx.budgetMonth.update).not.toHaveBeenCalled();
      });

      it('DATA-12: version is checked inside the transaction (VERSION_CONFLICT)', async () => {
        setup({}, null);

        await expect(service.close('2026-08', { version: 3 })).rejects.toMatchObject({
          code: 'VERSION_CONFLICT',
        });
        expect(mock.budgetMonth.findUnique).not.toHaveBeenCalled();
        expect(tx.budgetMonth.update).not.toHaveBeenCalled();
      });

      it('API-05: unknown month returns MONTH_NOT_FOUND', async () => {
        tx.budgetMonth.findUnique.mockResolvedValue(null);

        await expect(service.close('2030-01', { version: 1 })).rejects.toMatchObject({
          code: 'MONTH_NOT_FOUND',
          statusCode: 404,
        });
      });
    });

    describe('reopen', () => {
      beforeEach(() => {
        engine.recalculateMonthAtomically.mockResolvedValue({
          recalculatedFrom: '2026-06',
          warnings: [{ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'w' }],
        });
      });

      function setupReopen(reopened: BudgetMonth | null) {
        currentMonth = makeMonth({ id: 'month-1', period: '2026-06', status: 'closed', version: 7 });
        tx.budgetMonth.findUnique
          .mockResolvedValueOnce(currentMonth)
          .mockResolvedValue({ ...currentMonth, status: 'reopened', version: 8 });
        tx.budgetMonth.findFirst.mockImplementation(
          ({ where }: { where?: { status?: string } }) =>
            Promise.resolve(
              where?.status === 'reopened' ? reopened : makeMonth({ id: 'last', period: '2026-09', status: 'draft' }),
            ),
        );
      }

      it('MON-14 / AC-15: reopen recalculates on the same tx, bumps versions and returns the range', async () => {
        setupReopen(null);

        const result = await service.reopen('2026-06', { version: 7 });

        expect(tx.budgetMonth.update).toHaveBeenCalledWith({
          where: { id: 'month-1' },
          data: { status: 'reopened' },
        });
        // same-transaction proof; the engine owns the version increment (ADR 0005, CALC-13)
        expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
        expect(mock.budgetMonth.update).not.toHaveBeenCalled();
        expect(result.data.month).toMatchObject({ period: '2026-06', status: 'reopened', version: 8 });
        // MON-12: range from the reopened month to the latest month; statuses of later months are untouched (MON-14)
        expect(result.data.recalcRange).toEqual({ from: '2026-06', to: '2026-09' });
        expect(result.warnings).toHaveLength(1);
        expect(tx.budgetMonth.update).toHaveBeenCalledTimes(1);
      });

      it('MON-13: a second month cannot be reopened while one is reopened', async () => {
        setupReopen(makeMonth({ id: 'other', period: '2026-05', status: 'reopened' }));

        await expect(service.reopen('2026-06', { version: 7 })).rejects.toMatchObject({
          code: 'INVALID_STATUS_TRANSITION',
          statusCode: 409,
        });
        expect(tx.budgetMonth.update).not.toHaveBeenCalled();
        expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
      });

      it.each(['draft', 'open', 'reopened'] as const)('only a closed month can be reopened (%s rejected)', async (status) => {
        tx.budgetMonth.findUnique.mockResolvedValue(makeMonth({ status, version: 7 }));

        await expect(service.reopen('2026-08', { version: 7 })).rejects.toMatchObject({
          code: 'INVALID_STATUS_TRANSITION',
        });
        expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
      });

      it('DATA-12: stale version returns VERSION_CONFLICT before any write', async () => {
        setupReopen(null);

        await expect(service.reopen('2026-06', { version: 6 })).rejects.toMatchObject({
          code: 'VERSION_CONFLICT',
        });
        expect(tx.budgetMonth.update).not.toHaveBeenCalled();
      });

      it('API-06: unknown month returns MONTH_NOT_FOUND', async () => {
        tx.budgetMonth.findUnique.mockResolvedValue(null);

        await expect(service.reopen('2030-01', { version: 1 })).rejects.toMatchObject({
          code: 'MONTH_NOT_FOUND',
        });
      });
    });
  });
});
