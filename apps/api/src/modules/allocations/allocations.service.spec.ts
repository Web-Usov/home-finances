import type { Allocation, BudgetMonth, Envelope } from '@prisma/client';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { AllocationsService } from './allocations.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENV_A = 'env-a';
const ENV_B = 'env-b';

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: 'month-1',
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

function makeAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: 'alloc-1',
    monthId: 'month-1',
    envelopeId: ENV_A,
    amountMinor: 5_000_000,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks — Prisma surface mirrors AllocationsService usage; $transaction hands
// the same mock to the callback as the tx client. Engine is mocked separately.
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const mock = {
    budgetMonth: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    envelope: {
      findMany: jest.fn(),
    },
    allocation: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  // The `FOR UPDATE` month-lock query (common/month-lock.ts) reads the row stubbed on budgetMonth.findUnique.
  mock.$queryRaw.mockImplementation(() =>
    (mock.budgetMonth.findUnique() as Promise<BudgetMonth | null>).then((month) =>
      month === null ? [] : [month],
    ),
  );
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function createMockEngine() {
  return {
    recalculateMonthAtomically: jest.fn(),
  };
}

type MockEngine = ReturnType<typeof createMockEngine>;

/**
 * `mock` is the transaction client handed to the callback; the service itself gets a DISTINCT root
 * client without any write or lock surface, so a write outside the transaction fails the test.
 */
function createService(mock: MockPrisma, engine: MockEngine): AllocationsService {
  const root = {
    $transaction: mock.$transaction,
    // read path only (getAllocations); save() must not touch these
    budgetMonth: { findUnique: mock.budgetMonth.findUnique },
    allocation: { findMany: mock.allocation.findMany },
  };
  return new AllocationsService(
    root as unknown as PrismaService,
    engine as unknown as CalculationEngineService,
  );
}

/** Happy-path stubs: open month version 3, two active envelopes, 75 000.00 ₽ allocated after the save. */
function stubSaveDefaults(mock: MockPrisma, engine: MockEngine): void {
  mock.budgetMonth.findUnique.mockResolvedValue(makeMonth());
  mock.envelope.findMany.mockResolvedValue([
    makeEnvelope({ id: ENV_A, name: 'Еда' }),
    makeEnvelope({ id: ENV_B, name: 'Дом', displayOrder: 1 }),
  ]);
  mock.allocation.deleteMany.mockResolvedValue({ count: 1 });
  mock.allocation.createMany.mockResolvedValue({ count: 2 });
  mock.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 7_500_000 } });
  engine.recalculateMonthAtomically.mockResolvedValue({
    recalculatedFrom: '2026-08',
    warnings: [],
  });
}

describe('AllocationsService', () => {
  let mock: MockPrisma;
  let engine: MockEngine;
  let service: AllocationsService;

  beforeEach(() => {
    mock = createMockPrisma();
    engine = createMockEngine();
    service = createService(mock, engine);
  });

  // -------------------------------------------------------------------------
  // save()
  // -------------------------------------------------------------------------

  describe('save', () => {
    it('saves allocations converted to kopecks, recalculates atomically and returns the summary', async () => {
      stubSaveDefaults(mock, engine);
      engine.recalculateMonthAtomically.mockResolvedValue({
        recalculatedFrom: '2026-08',
        warnings: [{ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'warn' }],
      });

      const result = await service.save('2026-08', {
        allocations: { [ENV_A]: '50000.00', [ENV_B]: '25000.00' },
        version: 3,
      });

      expect(mock.allocation.deleteMany).toHaveBeenCalledWith({ where: { monthId: 'month-1' } });
      expect(mock.allocation.createMany).toHaveBeenCalledWith({
        data: [
          { monthId: 'month-1', envelopeId: ENV_A, amountMinor: 5_000_000 },
          { monthId: 'month-1', envelopeId: ENV_B, amountMinor: 2_500_000 },
        ],
      });
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', mock);
      expect(mock.$transaction).toHaveBeenCalledTimes(1);

      expect(result.warnings).toEqual([
        { code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'warn' },
      ]);
      expect(mock.budgetMonth.update).not.toHaveBeenCalled(); // no `income` in the request
      expect(result.data).toEqual({
        summary: {
          id: 'month-1',
          period: '2026-08',
          status: 'open',
          incomeMinor: 10_000_000,
          version: 3,
          totalAllocatedMinor: 7_500_000,
          freeFundsMinor: 2_500_000,
        },
      });
      // API-22: no envelope data in the response
      expect(result.data.summary).not.toHaveProperty('envelopes');
    });

    it('DATA-12 / MON-03: locks the month row FOR UPDATE on the transaction client before any write', async () => {
      stubSaveDefaults(mock, engine);

      await service.save('2026-08', { allocations: { [ENV_A]: '100.00' }, version: 3 });

      expect(mock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mock.allocation.deleteMany.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('accepts a total equal to the income exactly', async () => {
      stubSaveDefaults(mock, engine);

      mock.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 10_000_000 } });

      const result = await service.save('2026-08', {
        allocations: { [ENV_A]: '60000.00', [ENV_B]: '40000.00' },
        version: 3,
      });

      expect(result.data.summary.totalAllocatedMinor).toBe(10_000_000);
      expect(result.data.summary.freeFundsMinor).toBe(0);
      expect(mock.allocation.createMany).toHaveBeenCalled();
    });

    it('rejects a total above the income with the exact spec message (ALLOCATION_EXCEEDS_INCOME)', async () => {
      stubSaveDefaults(mock, engine);

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '60000.00', [ENV_B]: '40001.00' },
        version: 3,
      });

      await expect(promise).rejects.toBeInstanceOf(ValidationException);
      await expect(promise).rejects.toMatchObject({
        code: 'ALLOCATION_EXCEEDS_INCOME',
        statusCode: 422,
        message: 'Распределено на 1.00 ₽ больше дохода. Уменьшите суммы по конвертам.',
      });
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(mock.allocation.createMany).not.toHaveBeenCalled();
      expect(mock.envelope.findMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('rejects a stale version with VERSION_CONFLICT before any other check', async () => {
      stubSaveDefaults(mock, engine);

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '100.00' },
        version: 2,
      });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        code: 'VERSION_CONFLICT',
        statusCode: 409,
      });
      expect(mock.envelope.findMany).not.toHaveBeenCalled();
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('prefers VERSION_CONFLICT over MONTH_LOCKED when both apply', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(makeMonth({ status: 'closed' }));

      await expect(
        service.save('2026-08', { allocations: {}, version: 99 }),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    });

    it('rejects saving into a closed month with MONTH_LOCKED and the spec message', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(makeMonth({ status: 'closed' }));

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '100.00' },
        version: 3,
      });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        code: 'MONTH_LOCKED',
        statusCode: 409,
        message: 'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
      });
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('throws MONTH_NOT_FOUND for an unknown period before any write', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(null);

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '100.00' },
        version: 3,
      });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toMatchObject({
        code: 'MONTH_NOT_FOUND',
        statusCode: 404,
      });
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('throws ENVELOPE_NOT_FOUND for an unknown envelope id', async () => {
      stubSaveDefaults(mock, engine);
      mock.envelope.findMany.mockResolvedValue([makeEnvelope({ id: ENV_A })]);

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '100.00', [ENV_B]: '200.00' },
        version: 3,
      });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toMatchObject({
        code: 'ENVELOPE_NOT_FOUND',
        statusCode: 404,
        message: `Конверт не найден: ${ENV_B}`,
      });
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('rejects allocations for archived envelopes (ENVELOPE_NOT_FOUND)', async () => {
      stubSaveDefaults(mock, engine);
      mock.envelope.findMany.mockResolvedValue([
        makeEnvelope({ id: ENV_A }),
        makeEnvelope({ id: ENV_B, name: 'Старое', status: 'archived', archivedPeriod: '2026-07' }),
      ]);

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '100.00', [ENV_B]: '200.00' },
        version: 3,
      });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toMatchObject({
        code: 'ENVELOPE_NOT_FOUND',
        statusCode: 404,
      });
      await expect(promise).rejects.toThrow(/архивирован/);
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(mock.allocation.createMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('clears the table for an empty allocation map and still recalculates', async () => {
      stubSaveDefaults(mock, engine);
      mock.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: null } });

      const result = await service.save('2026-08', { allocations: {}, version: 3 });

      expect(mock.allocation.deleteMany).toHaveBeenCalledWith({ where: { monthId: 'month-1' } });
      expect(mock.allocation.createMany).not.toHaveBeenCalled();
      expect(mock.envelope.findMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', mock);
      expect(result.data.summary.totalAllocatedMinor).toBe(0);
      expect(result.data.summary.freeFundsMinor).toBe(10_000_000);
    });

    it('FIN-02 / UI-11 / API-04: an `income` in the request is stored in the same transaction, before the cascade', async () => {
      stubSaveDefaults(mock, engine);
      mock.budgetMonth.findUnique
        .mockResolvedValueOnce(makeMonth()) // the lock query
        .mockResolvedValue(makeMonth({ incomeMinor: 8_000_000 })); // the summary re-read

      const result = await service.save('2026-08', {
        allocations: { [ENV_A]: '50000.00', [ENV_B]: '25000.00' },
        income: '80000.00',
        version: 3,
      });

      expect(mock.budgetMonth.update).toHaveBeenCalledWith({
        where: { id: 'month-1' },
        data: { incomeMinor: 8_000_000 },
      });
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
      expect(mock.$queryRaw).toHaveBeenCalledTimes(1); // one lock, one version check
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledTimes(1);
      expect(mock.budgetMonth.update.mock.invocationCallOrder[0]).toBeLessThan(
        engine.recalculateMonthAtomically.mock.invocationCallOrder[0] ?? 0,
      );
      expect(result.data.summary).toMatchObject({ incomeMinor: 8_000_000, freeFundsMinor: 500_000 });
    });

    it('FIN-02 / MSG-01: the sum is checked against the NEW income and nothing is written on overflow', async () => {
      stubSaveDefaults(mock, engine); // stored income 100 000.00 ₽

      const promise = service.save('2026-08', {
        allocations: { [ENV_A]: '50000.00', [ENV_B]: '25000.00' },
        income: '70000.00',
        version: 3,
      });

      await expect(promise).rejects.toMatchObject({
        code: 'ALLOCATION_EXCEEDS_INCOME',
        statusCode: 422,
        message: 'Распределено на 5000.00 ₽ больше дохода. Уменьшите суммы по конвертам.',
      });
      expect(mock.budgetMonth.update).not.toHaveBeenCalled();
      expect(mock.allocation.deleteMany).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('FIN-02: a lowered income is accepted when the new allocations fit it, even if the old ones would not', async () => {
      stubSaveDefaults(mock, engine);

      await service.save('2026-08', { allocations: { [ENV_A]: '100.00' }, income: '100.00', version: 3 });

      expect(mock.budgetMonth.update).toHaveBeenCalledWith({
        where: { id: 'month-1' },
        data: { incomeMinor: 10_000 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // getAllocations()
  // -------------------------------------------------------------------------

  describe('getAllocations', () => {
    it('returns the current allocation rows for the month', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(makeMonth());
      const rows = [
        makeAllocation({ id: 'alloc-1', envelopeId: ENV_A, amountMinor: 5_000_000 }),
        makeAllocation({ id: 'alloc-2', envelopeId: ENV_B, amountMinor: 2_500_000 }),
      ];
      mock.allocation.findMany.mockResolvedValue(rows);

      const result = await service.getAllocations('2026-08');

      expect(mock.allocation.findMany).toHaveBeenCalledWith({ where: { monthId: 'month-1' } });
      expect(result).toEqual({ allocations: rows });
    });

    it('throws MONTH_NOT_FOUND for an unknown period', async () => {
      mock.budgetMonth.findUnique.mockResolvedValue(null);

      await expect(service.getAllocations('2026-08')).rejects.toMatchObject({
        code: 'MONTH_NOT_FOUND',
        statusCode: 404,
      });
      expect(mock.allocation.findMany).not.toHaveBeenCalled();
    });
  });
});
