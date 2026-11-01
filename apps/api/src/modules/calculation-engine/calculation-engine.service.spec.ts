import type {
  Allocation,
  BudgetMonth,
  Envelope,
  EnvelopeMonthSnapshot,
  Operation,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CalculationEngineService } from './calculation-engine.service';

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
    id: 'env-1',
    name: 'Еда',
    status: 'active',
    createdPeriod: '2026-07',
    archivedPeriod: null,
    displayOrder: 0,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: 'alloc-1',
    monthId: 'month-1',
    envelopeId: 'env-1',
    amountMinor: 0,
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
    sourceEnvelopeId: 'env-1',
    destinationEnvelopeId: null,
    requestedMinor: 0,
    sign: null,
    isInitial: false,
    comment: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<EnvelopeMonthSnapshot> = {}): EnvelopeMonthSnapshot {
  return {
    id: 'snap-1',
    monthId: 'month-0',
    envelopeId: 'env-1',
    opening: 0,
    initial: 0,
    allocation: 0,
    expensesRequested: 0,
    expensesCovered: 0,
    adjustmentApplied: 0,
    transfersIn: 0,
    transfersOut: 0,
    closing: 0,
    uncoveredByType: {},
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma mock — mirrors the client surface used by CalculationEngineService.
// $transaction hands the same mock to the callback as the tx client.
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const mock = {
    budgetMonth: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    envelopeMonthSnapshot: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    allocation: { findMany: jest.fn() },
    operation: { findMany: jest.fn() },
    operationResult: { deleteMany: jest.fn(), createMany: jest.fn() },
    envelope: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

interface Scenario {
  months: BudgetMonth[];
  previousMonth?: BudgetMonth | null;
  previousSnapshots?: EnvelopeMonthSnapshot[];
  allocations?: Allocation[];
  operations?: Operation[];
  envelopes?: Envelope[];
}

function stubScenario(mock: MockPrisma, scenario: Scenario): void {
  mock.budgetMonth.findUnique.mockResolvedValue(scenario.months[0] ?? null);
  mock.budgetMonth.findMany.mockResolvedValue(scenario.months);
  mock.budgetMonth.findFirst.mockResolvedValue(scenario.previousMonth ?? null);
  mock.envelopeMonthSnapshot.findMany.mockResolvedValue(scenario.previousSnapshots ?? []);
  mock.allocation.findMany.mockResolvedValue(scenario.allocations ?? []);
  mock.operation.findMany.mockResolvedValue(scenario.operations ?? []);
  mock.envelope.findMany.mockResolvedValue(scenario.envelopes ?? []);
  mock.operationResult.deleteMany.mockResolvedValue({ count: 0 });
  mock.operationResult.createMany.mockResolvedValue({ count: 0 });
  mock.envelopeMonthSnapshot.deleteMany.mockResolvedValue({ count: 0 });
  mock.envelopeMonthSnapshot.createMany.mockResolvedValue({ count: 0 });
}

describe('CalculationEngineService.applyOperation', () => {
  let engine: CalculationEngineService;

  beforeEach(() => {
    engine = new CalculationEngineService(createMockPrisma() as unknown as PrismaService);
  });

  describe('expense', () => {
    it('fully covered: decreases balance by requested, uncovered = 0', () => {
      const result = engine.applyOperation(1_000_000, undefined, 400_000, 'expense');
      expect(result).toEqual({
        sourceBalanceAfter: 600_000,
        covered: 400_000,
        uncovered: 0,
      });
      expect(result.destinationBalanceAfter).toBeUndefined();
    });

    it('exact balance: covered = requested, balance becomes 0', () => {
      const result = engine.applyOperation(500_000, undefined, 500_000, 'expense');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        covered: 500_000,
        uncovered: 0,
      });
    });

    it('spec example: 10 000 RUB balance, 15 000 RUB expense → covered 10 000, uncovered 5 000, balance 0', () => {
      const result = engine.applyOperation(1_000_000, undefined, 1_500_000, 'expense');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        covered: 1_000_000,
        uncovered: 500_000,
      });
    });

    it('empty envelope: nothing covered, full amount uncovered', () => {
      const result = engine.applyOperation(0, undefined, 100_000, 'expense');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        covered: 0,
        uncovered: 100_000,
      });
    });

    it('never produces negative balance (odd kopeck amounts stay integer)', () => {
      const result = engine.applyOperation(1000, undefined, 1001, 'expense');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        covered: 1000,
        uncovered: 1,
      });
      expect(Number.isInteger(result.sourceBalanceAfter)).toBe(true);
      expect(Number.isInteger(result.covered)).toBe(true);
      expect(Number.isInteger(result.uncovered)).toBe(true);
    });
  });

  describe('transfer', () => {
    it('fully covered: source decreases, destination increases by full amount', () => {
      const result = engine.applyOperation(1_000_000, 200_000, 400_000, 'transfer');
      expect(result).toEqual({
        sourceBalanceAfter: 600_000,
        destinationBalanceAfter: 600_000,
        covered: 400_000,
        uncovered: 0,
      });
    });

    it('spec retro-recalculation example: 6 000 RUB source, 10 000 RUB saved transfer → source 0, destination +10 000, uncovered 4 000', () => {
      const result = engine.applyOperation(600_000, 0, 1_000_000, 'transfer');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        destinationBalanceAfter: 1_000_000,
        covered: 600_000,
        uncovered: 400_000,
      });
    });

    it('destination receives the FULL requested amount even when partially uncovered', () => {
      const result = engine.applyOperation(300_000, 500_000, 700_000, 'transfer');
      expect(result.destinationBalanceAfter).toBe(1_200_000);
      expect(result.sourceBalanceAfter).toBe(0);
      expect(result.uncovered).toBe(400_000);
    });

    it('empty source: transfer amount still credited to destination in full', () => {
      const result = engine.applyOperation(0, 100_000, 250_000, 'transfer');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        destinationBalanceAfter: 350_000,
        covered: 0,
        uncovered: 250_000,
      });
    });

    it('throws when destinationBalanceBefore is missing', () => {
      expect(() => engine.applyOperation(100, undefined, 50, 'transfer')).toThrow(
        'transfer requires destinationBalanceBefore',
      );
    });
  });

  describe('adjustment', () => {
    it("'+' increases balance by full amount, uncovered = 0", () => {
      const result = engine.applyOperation(300_000, undefined, 250_000, 'adjustment', '+');
      expect(result).toEqual({
        sourceBalanceAfter: 550_000,
        covered: 250_000,
        uncovered: 0,
      });
    });

    it("'+' on empty envelope", () => {
      const result = engine.applyOperation(0, undefined, 100_000, 'adjustment', '+');
      expect(result).toEqual({
        sourceBalanceAfter: 100_000,
        covered: 100_000,
        uncovered: 0,
      });
    });

    it("'-' fully applied: balance decreases, uncovered = 0", () => {
      const result = engine.applyOperation(300_000, undefined, 200_000, 'adjustment', '-');
      expect(result).toEqual({
        sourceBalanceAfter: 100_000,
        covered: 200_000,
        uncovered: 0,
      });
    });

    it("'-' decreases down to zero only; excess stored as uncovered (OP-14)", () => {
      const result = engine.applyOperation(100_000, undefined, 150_000, 'adjustment', '-');
      expect(result).toEqual({
        sourceBalanceAfter: 0,
        covered: 100_000,
        uncovered: 50_000,
      });
    });

    it('throws when sign is missing', () => {
      expect(() => engine.applyOperation(100, undefined, 50, 'adjustment')).toThrow(
        "adjustment requires sign '+' or '-'",
      );
    });

    it('throws when sign is null', () => {
      expect(() => engine.applyOperation(100, undefined, 50, 'adjustment', null)).toThrow(
        "adjustment requires sign '+' or '-'",
      );
    });
  });

  describe('initial_balance', () => {
    it('increases balance by full amount, uncovered = 0', () => {
      const result = engine.applyOperation(0, undefined, 500_000, 'initial_balance');
      expect(result).toEqual({
        sourceBalanceAfter: 500_000,
        covered: 500_000,
        uncovered: 0,
      });
    });

    it('adds on top of an existing balance', () => {
      const result = engine.applyOperation(200_000, undefined, 300_000, 'initial_balance');
      expect(result.sourceBalanceAfter).toBe(500_000);
      expect(result.uncovered).toBe(0);
    });

    it('sign is ignored', () => {
      const result = engine.applyOperation(0, undefined, 100_000, 'initial_balance', '-');
      expect(result.sourceBalanceAfter).toBe(100_000);
    });
  });

  describe('integer arithmetic', () => {
    it('all outputs remain integers for odd kopeck inputs across types', () => {
      const results = [
        engine.applyOperation(999, undefined, 333, 'expense'),
        engine.applyOperation(999, 777, 333, 'transfer'),
        engine.applyOperation(999, undefined, 333, 'adjustment', '+'),
        engine.applyOperation(999, undefined, 1234, 'adjustment', '-'),
        engine.applyOperation(999, undefined, 1, 'initial_balance'),
      ];
      for (const r of results) {
        expect(Number.isInteger(r.sourceBalanceAfter)).toBe(true);
        expect(Number.isInteger(r.covered)).toBe(true);
        expect(Number.isInteger(r.uncovered)).toBe(true);
        if (r.destinationBalanceAfter !== undefined) {
          expect(Number.isInteger(r.destinationBalanceAfter)).toBe(true);
        }
      }
    });
  });
});

describe('CalculationEngineService.recalculateFrom', () => {
  let mock: MockPrisma;
  let service: CalculationEngineService;

  beforeEach(() => {
    mock = createMockPrisma();
    service = new CalculationEngineService(mock as unknown as PrismaService);
  });

  it('throws when the start month does not exist', async () => {
    stubScenario(mock, { months: [] });
    mock.budgetMonth.findUnique.mockResolvedValue(null);

    await expect(service.recalculateFrom('2026-08')).rejects.toThrow(
      'Budget month not found: 2026-08',
    );
  });

  it('restores opening from the last unchanged snapshot, then applies allocation and operations', async () => {
    const month = makeMonth();
    stubScenario(mock, {
      months: [month],
      previousMonth: makeMonth({ id: 'month-0', period: '2026-07', status: 'closed' }),
      previousSnapshots: [makeSnapshot({ monthId: 'month-0', closing: 1_000_000 })],
      allocations: [makeAllocation({ amountMinor: 500_000 })],
      operations: [makeOperation({ requestedMinor: 300_000 })],
      envelopes: [makeEnvelope()],
    });

    const result = await service.recalculateFrom('2026-08');

    expect(result).toEqual({ recalculatedFrom: '2026-08', warnings: [] });
    expect(mock.envelopeMonthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          monthId: 'month-1',
          envelopeId: 'env-1',
          opening: 1_000_000,
          initial: 0,
          allocation: 500_000,
          expensesRequested: 300_000,
          expensesCovered: 300_000,
          adjustmentApplied: 0,
          transfersIn: 0,
          transfersOut: 0,
          closing: 1_200_000,
          uncoveredByType: {},
        },
      ],
    });
    expect(mock.operationResult.createMany).toHaveBeenCalledWith({
      data: [
        {
          operationId: 'op-1',
          coveredMinor: 300_000,
          uncoveredMinor: 0,
          sourceBalanceBefore: 1_500_000,
          sourceBalanceAfter: 1_200_000,
          destinationBalanceBefore: null,
          destinationBalanceAfter: null,
        },
      ],
    });
  });

  it('cascades closing balances into the opening of the next month', async () => {
    const august = makeMonth({ id: 'month-1', period: '2026-08' });
    const september = makeMonth({ id: 'month-2', period: '2026-09' });
    stubScenario(mock, {
      months: [august, september],
      allocations: [makeAllocation({ monthId: 'month-1', amountMinor: 1_000_000 })],
      operations: [
        makeOperation({ id: 'op-1', monthId: 'month-1', sequenceNo: 1, requestedMinor: 400_000 }),
        makeOperation({ id: 'op-2', monthId: 'month-2', sequenceNo: 1, requestedMinor: 200_000 }),
      ],
      envelopes: [makeEnvelope()],
    });

    await service.recalculateFrom('2026-08');

    const septemberSnapshots = mock.envelopeMonthSnapshot.createMany.mock.calls[1][0].data;
    expect(septemberSnapshots).toEqual([
      expect.objectContaining({ monthId: 'month-2', opening: 600_000, closing: 400_000 }),
    ]);
  });

  it('records uncovered expense in the result and uncoveredByType', async () => {
    stubScenario(mock, {
      months: [makeMonth()],
      allocations: [makeAllocation({ amountMinor: 100_000 })],
      operations: [makeOperation({ requestedMinor: 150_000 })],
      envelopes: [makeEnvelope()],
    });

    await service.recalculateFrom('2026-08');

    expect(mock.operationResult.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ coveredMinor: 100_000, uncoveredMinor: 50_000 }),
      ],
    });
    expect(mock.envelopeMonthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ closing: 0, uncoveredByType: { expense: 50_000 } }),
      ],
    });
  });

  it('transfer: source loses only the covered part, destination gains the full amount', async () => {
    const destination = makeEnvelope({ id: 'env-2', name: 'Отпуск' });
    stubScenario(mock, {
      months: [makeMonth()],
      allocations: [makeAllocation({ amountMinor: 600_000 })],
      operations: [
        makeOperation({
          type: 'transfer',
          destinationEnvelopeId: 'env-2',
          requestedMinor: 1_000_000,
        }),
      ],
      envelopes: [makeEnvelope(), destination],
    });

    await service.recalculateFrom('2026-08');

    expect(mock.operationResult.createMany).toHaveBeenCalledWith({
      data: [
        {
          operationId: 'op-1',
          coveredMinor: 600_000,
          uncoveredMinor: 400_000,
          sourceBalanceBefore: 600_000,
          sourceBalanceAfter: 0,
          destinationBalanceBefore: 0,
          destinationBalanceAfter: 1_000_000,
        },
      ],
    });
    expect(mock.envelopeMonthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          envelopeId: 'env-1',
          transfersOut: 600_000,
          closing: 0,
          uncoveredByType: { transfer: 400_000 },
        }),
        expect.objectContaining({ envelopeId: 'env-2', transfersIn: 1_000_000, closing: 1_000_000 }),
      ],
    });
  });

  it('applies initial balance before allocation and user operations regardless of sequence_no', async () => {
    stubScenario(mock, {
      months: [makeMonth()],
      allocations: [makeAllocation({ amountMinor: 100_000 })],
      operations: [
        makeOperation({ id: 'op-1', sequenceNo: 1, requestedMinor: 500_000 }),
        makeOperation({
          id: 'op-2',
          sequenceNo: 2,
          type: 'initial_balance',
          isInitial: true,
          requestedMinor: 1_000_000,
        }),
      ],
      envelopes: [makeEnvelope()],
    });

    await service.recalculateFrom('2026-08');

    expect(mock.operationResult.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          operationId: 'op-2',
          sourceBalanceBefore: 0,
          sourceBalanceAfter: 1_000_000,
        }),
        expect.objectContaining({
          operationId: 'op-1',
          coveredMinor: 500_000,
          sourceBalanceBefore: 1_100_000,
          sourceBalanceAfter: 600_000,
        }),
      ],
    });
    expect(mock.envelopeMonthSnapshot.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ initial: 1_000_000, allocation: 100_000, closing: 600_000 })],
    });
  });

  it('negative adjustment nets into adjustmentApplied and stores the excess as uncovered', async () => {
    stubScenario(mock, {
      months: [makeMonth()],
      allocations: [makeAllocation({ amountMinor: 100_000 })],
      operations: [makeOperation({ type: 'adjustment', sign: '-', requestedMinor: 150_000 })],
      envelopes: [makeEnvelope()],
    });

    await service.recalculateFrom('2026-08');

    expect(mock.envelopeMonthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          adjustmentApplied: -100_000,
          closing: 0,
          uncoveredByType: { adjustment: 50_000 },
        }),
      ],
    });
  });

  it('warns once about an archived envelope that regains a non-zero balance', async () => {
    const archived = makeEnvelope({
      status: 'archived',
      archivedPeriod: '2026-08',
      name: 'Ремонт',
    });
    const august = makeMonth({ id: 'month-1', period: '2026-08' });
    const september = makeMonth({ id: 'month-2', period: '2026-09' });
    stubScenario(mock, {
      months: [august, september],
      allocations: [makeAllocation({ monthId: 'month-1', amountMinor: 500_000 })],
      envelopes: [archived],
    });

    const result = await service.recalculateFrom('2026-08');

    const [warning] = result.warnings;
    expect(result.warnings).toHaveLength(1);
    expect(warning?.code).toBe('ARCHIVED_ENVELOPE_WITH_BALANCE');
    expect(warning?.message).toContain('Ремонт');
    expect(warning?.message).toContain('2026-08');
    expect(warning?.message).toContain('остаток равен 5\u00A0000,00 ₽.'); // MSG-07

    // The balance carries into September but must not warn twice.
    const septemberSnapshots = mock.envelopeMonthSnapshot.createMany.mock.calls[1][0].data;
    expect(septemberSnapshots).toEqual([
      expect.objectContaining({ monthId: 'month-2', opening: 500_000, closing: 500_000 }),
    ]);
  });

  it('ENV-11 / CALC-12: ARCHIVED_ENVELOPE_WITH_BALANCE warns when the closing balance of an archived envelope is negative', async () => {
    stubScenario(mock, {
      months: [makeMonth({ id: 'month-1', period: '2026-08' })],
      previousMonth: makeMonth({ id: 'month-0', period: '2026-07' }),
      previousSnapshots: [makeSnapshot({ monthId: 'month-0', closing: -30_000 })],
      envelopes: [makeEnvelope({ status: 'archived', archivedPeriod: '2026-08', name: 'Ремонт' })],
    });

    const result = await service.recalculateFrom('2026-08');

    expect(result.warnings).toHaveLength(1);
    const [warning] = result.warnings;
    expect(warning?.code).toBe('ARCHIVED_ENVELOPE_WITH_BALANCE');
    expect(warning?.message).toContain('Ремонт');
    expect(warning?.message).toContain('остаток равен \u2212300,00 ₽.'); // MSG-07
  });

  it('does not warn when the archived envelope keeps a zero balance', async () => {
    stubScenario(mock, {
      months: [makeMonth()],
      allocations: [makeAllocation({ amountMinor: 100_000 })],
      operations: [makeOperation({ requestedMinor: 100_000 })],
      envelopes: [makeEnvelope({ status: 'archived', archivedPeriod: '2026-08' })],
    });

    const result = await service.recalculateFrom('2026-08');

    expect(result.warnings).toEqual([]);
  });

  it('recreates derived rows for every affected month', async () => {
    const august = makeMonth({ id: 'month-1', period: '2026-08' });
    const september = makeMonth({ id: 'month-2', period: '2026-09' });
    stubScenario(mock, { months: [august, september], envelopes: [makeEnvelope()] });

    await service.recalculateFrom('2026-08');

    expect(mock.operationResult.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { operation: { monthId: 'month-1' } },
    });
    expect(mock.operationResult.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { operation: { monthId: 'month-2' } },
    });
    expect(mock.envelopeMonthSnapshot.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { monthId: 'month-1' },
    });
    expect(mock.envelopeMonthSnapshot.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { monthId: 'month-2' } },
    );
    // No activity and zero opening anywhere → nothing to persist.
    expect(mock.operationResult.createMany).not.toHaveBeenCalled();
    expect(mock.envelopeMonthSnapshot.createMany).not.toHaveBeenCalled();
  });

  it('deletes derived rows before recreating them', async () => {
    stubScenario(mock, {
      months: [makeMonth()],
      operations: [makeOperation({ requestedMinor: 100_000 })],
      envelopes: [makeEnvelope()],
    });

    await service.recalculateFrom('2026-08');

    const resultDeleteOrder = mock.operationResult.deleteMany.mock.invocationCallOrder[0];
    const resultCreateOrder = mock.operationResult.createMany.mock.invocationCallOrder[0];
    const snapshotDeleteOrder =
      mock.envelopeMonthSnapshot.deleteMany.mock.invocationCallOrder[0];
    const snapshotCreateOrder =
      mock.envelopeMonthSnapshot.createMany.mock.invocationCallOrder[0];
    expect(resultDeleteOrder).toBeDefined();
    expect(resultCreateOrder).toBeDefined();
    expect(snapshotDeleteOrder).toBeDefined();
    expect(snapshotCreateOrder).toBeDefined();
    expect(resultDeleteOrder as number).toBeLessThan(resultCreateOrder as number);
    expect(snapshotDeleteOrder as number).toBeLessThan(snapshotCreateOrder as number);
  });

  it('runs inside the caller transaction when a client is provided', async () => {
    stubScenario(mock, { months: [makeMonth()], envelopes: [makeEnvelope()] });

    await service.recalculateFrom('2026-08', mock as unknown as never);

    expect(mock.$transaction).not.toHaveBeenCalled();
    expect(mock.budgetMonth.findUnique).toHaveBeenCalledWith({ where: { period: '2026-08' } });
  });
});
