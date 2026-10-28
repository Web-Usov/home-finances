import { BadRequestException } from '@nestjs/common';
import type { BudgetMonth, Envelope, Operation, OperationResult } from '@prisma/client';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { OperationsService } from './operations.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: 'month-1',
    period: '2026-08',
    status: 'open',
    incomeMinor: 1_500_000,
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: 'env-src',
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

function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 'op-1',
    monthId: 'month-1',
    sequenceNo: 1,
    type: 'expense',
    sourceEnvelopeId: 'env-src',
    destinationEnvelopeId: null,
    requestedMinor: 3_000,
    sign: null,
    isInitial: false,
    comment: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeOperationResult(overrides: Partial<OperationResult> = {}): OperationResult {
  return {
    id: 'res-1',
    operationId: 'op-1',
    coveredMinor: 3_000,
    uncoveredMinor: 0,
    sourceBalanceBefore: 10_000,
    sourceBalanceAfter: 7_000,
    destinationBalanceBefore: null,
    destinationBalanceAfter: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma mock — mirrors the client surface used by OperationsService.
// $transaction hands the same mock to the callback as the tx client.
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const mock = {
    budgetMonth: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    envelope: {
      findUnique: jest.fn(),
    },
    envelopeMonthSnapshot: {
      findUnique: jest.fn(),
    },
    operation: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    operationResult: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function createEngineMock() {
  return {
    recalculateMonthAtomically: jest.fn(),
  };
}

type MockEngine = ReturnType<typeof createEngineMock>;

function createService(mock: MockPrisma, engine: MockEngine): OperationsService {
  return new OperationsService(
    mock as unknown as PrismaService,
    engine as unknown as CalculationEngineService,
  );
}

const SOURCE = makeEnvelope({ id: 'env-src', name: 'Еда' });
const DESTINATION = makeEnvelope({ id: 'env-dst', name: 'Дом', displayOrder: 1 });

/**
 * Happy-path stubs for create(): one open month (version 1), active envelopes,
 * empty snapshot store, no operations yet, engine returns no warnings.
 */
function stubCreateDefaults(mock: MockPrisma, engine: MockEngine, month: BudgetMonth = makeMonth()): void {
  mock.budgetMonth.findMany.mockResolvedValue([month]);
  mock.budgetMonth.findFirst.mockResolvedValue(month);
  mock.envelope.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
    if (id === SOURCE.id) return Promise.resolve(SOURCE);
    if (id === DESTINATION.id) return Promise.resolve(DESTINATION);
    return Promise.resolve(null);
  });
  mock.$queryRaw.mockResolvedValue([{ status: month.status, version: month.version }]);
  mock.envelopeMonthSnapshot.findUnique.mockResolvedValue(null);
  mock.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: null } });
  mock.operation.create.mockImplementation(({ data }: { data: Partial<Operation> }) =>
    Promise.resolve(makeOperation(data)),
  );
  mock.operationResult.findUnique.mockResolvedValue(makeOperationResult());
  engine.recalculateMonthAtomically.mockResolvedValue({
    recalculatedFrom: month.period,
    warnings: [],
  });
}

describe('OperationsService', () => {
  let mock: MockPrisma;
  let engine: MockEngine;
  let service: OperationsService;

  beforeEach(() => {
    mock = createMockPrisma();
    engine = createEngineMock();
    service = createService(mock, engine);
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates an expense within balance: parses kopecks, assigns max+1 sequence, recalculates in the same tx', async () => {
      stubCreateDefaults(mock, engine);
      mock.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: 4 } });

      const response = await service.create({
        type: 'expense',
        sourceEnvelopeId: 'env-src',
        amount: '30.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith({
        data: {
          monthId: 'month-1',
          sequenceNo: 5,
          type: 'expense',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: null,
          requestedMinor: 3_000,
          sign: null,
          isInitial: false,
          comment: null,
        },
      });
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', mock);
      expect(response.operation.requestedMinor).toBe(3_000);
      expect(response.result.coveredMinor).toBe(3_000);
      expect(response.summary).toEqual({
        monthId: 'month-1',
        period: '2026-08',
        version: 2,
        sourceBalanceMinor: 0,
      });
      expect(response.warnings).toEqual([]);
    });

    it('uses sequenceNo 1 for the first operation of the month', async () => {
      stubCreateDefaults(mock, engine);

      await service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequenceNo: 1 }) }),
      );
    });

    it('allows an expense beyond balance and warns about the uncovered part (spec line 369)', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 10_000 });
      mock.operationResult.findUnique.mockResolvedValue(
        makeOperationResult({
          coveredMinor: 10_000,
          uncoveredMinor: 5_000,
          sourceBalanceBefore: 10_000,
          sourceBalanceAfter: 0,
        }),
      );

      const response = await service.create({
        type: 'expense',
        sourceEnvelopeId: 'env-src',
        amount: '150.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ requestedMinor: 15_000 }) }),
      );
      expect(response.result.uncoveredMinor).toBe(5_000);
      expect(response.result.sourceBalanceAfter).toBe(0);
      expect(response.warnings).toEqual([
        {
          code: 'EXPENSE_EXCEEDS_BALANCE',
          message: 'В конверте доступно 100.00 ₽. 50.00 ₽ будут отмечены как непокрытые.',
        },
      ]);
    });

    it('creates a transfer with the destination envelope', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 10_000 });

      const response = await service.create({
        type: 'transfer',
        sourceEnvelopeId: 'env-src',
        destinationEnvelopeId: 'env-dst',
        amount: '50.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'transfer',
            sourceEnvelopeId: 'env-src',
            destinationEnvelopeId: 'env-dst',
            requestedMinor: 5_000,
          }),
        }),
      );
      expect(response.summary.destinationBalanceMinor).toBe(10_000);
    });

    it('rejects a transfer beyond the source balance with the available amount (spec line 370)', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 6_000 });

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-dst',
          amount: '100.00',
          version: 1,
        }),
      ).rejects.toMatchObject({
        code: 'TRANSFER_EXCEEDS_BALANCE',
        statusCode: 409,
        message: 'Доступно 60.00 ₽. Перевести только 60.00 ₽?',
      });
      expect(mock.operation.create).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('treats a missing snapshot as zero balance for the transfer check', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelopeMonthSnapshot.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-dst',
          amount: '0.01',
          version: 1,
        }),
      ).rejects.toMatchObject({ code: 'TRANSFER_EXCEEDS_BALANCE' });
    });

    it('rejects a transfer without a destination envelope', async () => {
      stubCreateDefaults(mock, engine);

      await expect(
        service.create({ type: 'transfer', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a transfer whose source equals the destination', async () => {
      stubCreateDefaults(mock, engine);

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-src',
          amount: '10.00',
          version: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('creates a negative adjustment beyond balance: balance 0, uncovered remainder, warning (spec line 371)', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 10_000 });
      mock.operationResult.findUnique.mockResolvedValue(
        makeOperationResult({
          coveredMinor: 10_000,
          uncoveredMinor: 5_000,
          sourceBalanceBefore: 10_000,
          sourceBalanceAfter: 0,
        }),
      );

      const response = await service.create({
        type: 'adjustment',
        sourceEnvelopeId: 'env-src',
        amount: '150.00',
        sign: '-',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'adjustment', sign: '-', requestedMinor: 15_000 }),
        }),
      );
      expect(response.warnings).toEqual([
        {
          code: 'ADJUSTMENT_EXCEEDS_BALANCE',
          message: 'Баланс станет 0 ₽, 50.00 ₽ будут отмечены как непокрытые.',
        },
      ]);
    });

    it('creates a positive adjustment without an uncovered warning', async () => {
      stubCreateDefaults(mock, engine);

      const response = await service.create({
        type: 'adjustment',
        sourceEnvelopeId: 'env-src',
        amount: '20.00',
        sign: '+',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sign: '+' }) }),
      );
      expect(response.warnings).toEqual([]);
    });

    it('rejects an adjustment without a sign', async () => {
      stubCreateDefaults(mock, engine);

      await expect(
        service.create({ type: 'adjustment', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('creates an initial_balance operation flagged as initial', async () => {
      stubCreateDefaults(mock, engine);

      await service.create({
        type: 'initial_balance',
        sourceEnvelopeId: 'env-src',
        amount: '100.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'initial_balance', isInitial: true, sign: null }),
        }),
      );
    });

    it('rejects a stale month version inside the transaction (VERSION_CONFLICT)', async () => {
      stubCreateDefaults(mock, engine);
      mock.$queryRaw.mockResolvedValue([{ status: 'open', version: 3 }]);

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', statusCode: 409 });
      expect(mock.operation.create).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('rejects creation when the latest month is closed (MONTH_LOCKED)', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(makeMonth({ status: 'closed' }));

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toMatchObject({ code: 'MONTH_LOCKED', statusCode: 409 });
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects creation when the month closes concurrently (locked row reads closed)', async () => {
      stubCreateDefaults(mock, engine);
      mock.$queryRaw.mockResolvedValue([{ status: 'closed', version: 2 }]);

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 2 }),
      ).rejects.toMatchObject({ code: 'MONTH_LOCKED', statusCode: 409 });
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('rejects creation when no budget month exists at all', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toMatchObject({ code: 'MONTH_NOT_FOUND', statusCode: 404 });
    });

    it('allows creation in a draft month', async () => {
      stubCreateDefaults(mock, engine, makeMonth({ status: 'draft' }));

      const response = await service.create({
        type: 'expense',
        sourceEnvelopeId: 'env-src',
        amount: '10.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledTimes(1);
      expect(response.operation).toBeDefined();
    });

    it('rejects an unknown source envelope with 404 before opening a transaction', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelope.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-unknown', amount: '10.00', version: 1 }),
      ).rejects.toMatchObject({ code: 'ENVELOPE_NOT_FOUND', statusCode: 404 });
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an archived source envelope with 409', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelope.findUnique.mockResolvedValue(
        makeEnvelope({ id: 'env-src', status: 'archived', archivedPeriod: '2026-08' }),
      );

      await expect(
        service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('allows an envelope archived only after the operation month (spec line 455)', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelope.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(
          id === 'env-src'
            ? makeEnvelope({ id: 'env-src', status: 'archived', archivedPeriod: '2026-09' })
            : null,
        ),
      );

      await service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 });

      expect(mock.operation.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown destination envelope with 404', async () => {
      stubCreateDefaults(mock, engine);

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-unknown',
          amount: '10.00',
          version: 1,
        }),
      ).rejects.toMatchObject({ code: 'ENVELOPE_NOT_FOUND', statusCode: 404 });
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('rejects an archived destination envelope with 409', async () => {
      stubCreateDefaults(mock, engine);
      mock.envelope.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        if (id === 'env-src') return Promise.resolve(SOURCE);
        return Promise.resolve(makeEnvelope({ id: 'env-dst', status: 'archived', archivedPeriod: '2026-08' }));
      });

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-dst',
          amount: '10.00',
          version: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('serializes concurrent creations through a FOR UPDATE row lock: sequence numbers stay unique', async () => {
      stubCreateDefaults(mock, engine);
      // Second transaction observes the first one's committed row.
      mock.operation.aggregate
        .mockResolvedValueOnce({ _max: { sequenceNo: 3 } })
        .mockResolvedValueOnce({ _max: { sequenceNo: 4 } });

      await service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 });
      await service.create({ type: 'expense', sourceEnvelopeId: 'env-src', amount: '10.00', version: 1 });

      const sequences = mock.operation.create.mock.calls.map(
        (call) => (call[0] as { data: { sequenceNo: number } }).data.sequenceNo,
      );
      expect(sequences).toEqual([4, 5]);
      expect(new Set(sequences).size).toBe(2);
      expect(mock.$queryRaw).toHaveBeenCalledTimes(2);
      const sqlParts = mock.$queryRaw.mock.calls[0]?.[0] as readonly string[];
      expect(sqlParts.join('?')).toContain('FOR UPDATE');
    });

    it('ignores a destination passed for a non-transfer operation', async () => {
      stubCreateDefaults(mock, engine);

      await service.create({
        type: 'expense',
        sourceEnvelopeId: 'env-src',
        destinationEnvelopeId: 'env-dst',
        amount: '10.00',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ destinationEnvelopeId: null }) }),
      );
    });

    it('stores the optional comment', async () => {
      stubCreateDefaults(mock, engine);

      await service.create({
        type: 'expense',
        sourceEnvelopeId: 'env-src',
        amount: '10.00',
        comment: 'Продукты',
        version: 1,
      });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comment: 'Продукты' }) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('returns history ordered by period and sequence_no with results included', async () => {
      mock.operation.findMany.mockResolvedValue([
        { ...makeOperation({ id: 'op-1' }), result: makeOperationResult(), month: { period: '2026-08' } },
        {
          ...makeOperation({ id: 'op-2', sequenceNo: 2 }),
          result: makeOperationResult({ id: 'res-2', operationId: 'op-2' }),
          month: { period: '2026-08' },
        },
      ]);

      const { operations } = await service.list({});

      expect(mock.operation.findMany).toHaveBeenCalledWith({
        where: {},
        include: { result: true, month: { select: { period: true } } },
        orderBy: [{ month: { period: 'asc' } }, { sequenceNo: 'asc' }],
      });
      expect(operations).toHaveLength(2);
      expect(operations[0]).toMatchObject({ id: 'op-1', period: '2026-08' });
      expect(operations[0]?.result).toMatchObject({ coveredMinor: 3_000 });
    });

    it('maps period, envelopeId and type filters into the query', async () => {
      mock.operation.findMany.mockResolvedValue([]);

      await service.list({ period: '2026-08', envelopeId: 'env-src', type: 'expense' });

      expect(mock.operation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            month: { period: '2026-08' },
            type: 'expense',
            OR: [{ sourceEnvelopeId: 'env-src' }, { destinationEnvelopeId: 'env-src' }],
          },
        }),
      );
    });

    it('returns an empty history when nothing matches', async () => {
      mock.operation.findMany.mockResolvedValue([]);

      const result = await service.list({ period: '2020-01' });

      expect(result).toEqual({ operations: [] });
    });
  });
});
