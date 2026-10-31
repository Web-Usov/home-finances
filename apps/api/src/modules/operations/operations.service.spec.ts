import type { BudgetMonth, Envelope, Operation, OperationResult } from '@prisma/client';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { OperationsService } from './operations.service';
import type { CreateOperationRequest } from './operations.service';

const NOW = new Date('2026-08-01T00:00:00.000Z');

function makeMonth(overrides: Partial<BudgetMonth> = {}): BudgetMonth {
  return {
    id: 'month-1',
    period: '2026-08',
    status: 'open',
    incomeMinor: 1_500_000,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
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
    createdAt: NOW,
    updatedAt: NOW,
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeResult(overrides: Partial<OperationResult> = {}): OperationResult {
  return {
    id: 'res-1',
    operationId: 'op-1',
    coveredMinor: 3_000,
    uncoveredMinor: 0,
    sourceBalanceBefore: 10_000,
    sourceBalanceAfter: 7_000,
    destinationBalanceBefore: null,
    destinationBalanceAfter: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Rows of the `FOR UPDATE` month-lock query (the first one is the target month). */
function lockedRows(status: string, version: number, id = 'month-1', period = '2026-08') {
  return [{ id, period, status, incomeMinor: 0, version }];
}

function createMockPrisma() {
  const mock = {
    budgetMonth: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    allocation: { aggregate: jest.fn() },
    envelope: { findUnique: jest.fn() },
    envelopeMonthSnapshot: { findUnique: jest.fn() },
    operation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    operationResult: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const SOURCE = makeEnvelope({ id: 'env-src', name: 'Еда' });
const DESTINATION = makeEnvelope({ id: 'env-dst', name: 'Дом', displayOrder: 1 });

const EXPENSE: CreateOperationRequest = {
  type: 'expense',
  sourceEnvelopeId: 'env-src',
  amount: '30.00',
  version: 1,
};

describe('OperationsService', () => {
  let db: MockPrisma;
  /** Distinct from `db`: proves that everything inside the transaction uses the tx client. */
  let tx: MockPrisma;
  let engine: { recalculateMonthAtomically: jest.Mock };
  let service: OperationsService;

  /** Happy path: one open month (version 1), two active envelopes, empty month. */
  function stubTx(month: BudgetMonth = makeMonth()): void {
    tx.budgetMonth.findMany.mockResolvedValue([month]);
    tx.budgetMonth.findFirst.mockResolvedValue(month);
    // the engine bumps the version, so the post-recalculation re-read is month.version + 1
    tx.budgetMonth.findUnique.mockResolvedValue({ ...month, version: month.version + 1 });
    tx.allocation.aggregate.mockResolvedValue({ _sum: { amountMinor: 400_000 } });
    tx.$queryRaw.mockResolvedValue(lockedRows(month.status, month.version, month.id, month.period));
    tx.envelope.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve([SOURCE, DESTINATION].find((e) => e.id === id) ?? null),
    );
    tx.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 10_000 });
    tx.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: null } });
    tx.operation.create.mockImplementation(({ data }: { data: Partial<Operation> }) =>
      Promise.resolve(makeOperation(data)),
    );
    tx.operationResult.findUnique.mockResolvedValue(makeResult());
    engine.recalculateMonthAtomically.mockResolvedValue({
      recalculatedFrom: month.period,
      warnings: [],
    });
  }

  beforeEach(() => {
    db = createMockPrisma();
    tx = createMockPrisma();
    db.$transaction.mockImplementation((callback: (client: unknown) => unknown) => callback(tx));
    engine = { recalculateMonthAtomically: jest.fn() };
    service = new OperationsService(
      db as unknown as PrismaService,
      engine as unknown as CalculationEngineService,
    );
    stubTx();
  });

  describe('create', () => {
    it('API-15 / OP-01: writes the operation and recalculates in the SAME transaction; bumps the month version', async () => {
      const response = await service.create(EXPENSE);

      expect(tx.operation.create).toHaveBeenCalledWith({
        data: {
          monthId: 'month-1',
          sequenceNo: 1,
          type: 'expense',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: null,
          requestedMinor: 3_000,
          sign: null,
          isInitial: false,
          comment: null,
        },
      });
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
      expect(db.operation.create).not.toHaveBeenCalled();
      expect(db.budgetMonth.findMany).not.toHaveBeenCalled();
      expect(response.data.summary).toEqual({
        id: 'month-1',
        period: '2026-08',
        status: 'open',
        incomeMinor: 1_500_000,
        version: 2, // ADR 0005: 1 → 2
        totalAllocatedMinor: 400_000,
        freeFundsMinor: 1_100_000,
      });
      expect(response.data.result.coveredMinor).toBe(3_000);
      expect(response.warnings).toEqual([]);
    });

    it('API-14: converts the decimal string to integer kopecks', async () => {
      await service.create({ ...EXPENSE, amount: '15000.05' });

      expect(tx.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ requestedMinor: 1_500_005 }) }),
      );
    });

    it('OP-17: a new operation gets max + 1 as sequence_no (first one gets 1)', async () => {
      tx.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: 4 } });

      await service.create(EXPENSE);

      expect(tx.operation.aggregate).toHaveBeenCalledWith({
        where: { monthId: 'month-1' },
        _max: { sequenceNo: true },
      });
      expect(tx.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequenceNo: 5 }) }),
      );
    });

    it('DATA-12: reads the month inside the transaction and rejects a stale version without writing', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('open', 2)); // changed after the client read v1

      await expect(service.create(EXPENSE)).rejects.toMatchObject({
        statusCode: 409,
        code: 'VERSION_CONFLICT',
      });
      expect(tx.operation.create).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('HIST-10 / MON-03: closed latest month → MONTH_LOCKED', async () => {
      stubTx(makeMonth({ status: 'closed' }));
      tx.budgetMonth.findMany.mockResolvedValue([]);

      await expect(service.create(EXPENSE)).rejects.toMatchObject({
        statusCode: 409,
        code: 'MONTH_LOCKED',
      });
      expect(tx.operation.create).not.toHaveBeenCalled();
    });

    it('HIST-10: a month closed concurrently (locked row reads closed) → MONTH_LOCKED', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('closed', 1));

      await expect(service.create(EXPENSE)).rejects.toMatchObject({ code: 'MONTH_LOCKED' });
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('version is checked before the month status (order of checks)', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('closed', 5));

      await expect(service.create(EXPENSE)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    });

    it('MON-04 / MON-01: prefers open, then reopened, then draft as the working month', async () => {
      const draft = makeMonth({ id: 'draft', period: '2026-09', status: 'draft' });
      const open = makeMonth({ id: 'open', period: '2026-08', status: 'open' });
      const reopened = makeMonth({ id: 'reopened', period: '2026-05', status: 'reopened' });
      tx.budgetMonth.findMany.mockResolvedValue([draft, open, reopened]);
      // the lock query returns the month whose id it was asked to lock
      tx.$queryRaw.mockImplementation((_sql: unknown, ...values: string[]) => {
        const asked = [draft, open, reopened].find((m) => m.id === values[0]);
        return Promise.resolve(lockedRows('open', 1, asked?.id, asked?.period));
      });

      await service.create(EXPENSE);

      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('open', tx);

      tx.budgetMonth.findMany.mockResolvedValue([draft, reopened]);
      await service.create(EXPENSE);
      expect(engine.recalculateMonthAtomically).toHaveBeenLastCalledWith('reopened', tx);

      tx.budgetMonth.findMany.mockResolvedValue([draft]);
      await service.create(EXPENSE);
      expect(engine.recalculateMonthAtomically).toHaveBeenLastCalledWith('draft', tx);
    });

    it('MONTH_NOT_FOUND when no budget month exists at all', async () => {
      tx.budgetMonth.findMany.mockResolvedValue([]);
      tx.budgetMonth.findFirst.mockResolvedValue(null);

      await expect(service.create(EXPENSE)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.create(EXPENSE)).rejects.toMatchObject({ code: 'MONTH_NOT_FOUND' });
    });

    it('OP-05 / OP-06: expense beyond balance is saved in full and warns about the uncovered part', async () => {
      tx.operationResult.findUnique.mockResolvedValue(
        makeResult({
          coveredMinor: 1_000_000,
          uncoveredMinor: 500_000,
          sourceBalanceBefore: 1_000_000,
          sourceBalanceAfter: 0,
        }),
      );
      tx.operation.create.mockImplementation(({ data }: { data: Partial<Operation> }) =>
        Promise.resolve(makeOperation(data)),
      );

      const response = await service.create({ ...EXPENSE, amount: '15000.00' });

      expect(tx.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ requestedMinor: 1_500_000 }) }),
      );
      expect(response.warnings).toEqual([
        {
          code: 'EXPENSE_EXCEEDS_BALANCE',
          message: expect.stringContaining('5000.00'),
        },
      ]);
    });

    it('API-16: engine warnings are passed through and precede the uncovered notices', async () => {
      engine.recalculateMonthAtomically.mockResolvedValue({
        recalculatedFrom: '2026-08',
        warnings: [{ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'x' }],
      });

      const response = await service.create(EXPENSE);

      expect(response.warnings).toEqual([{ code: 'ARCHIVED_ENVELOPE_WITH_BALANCE', message: 'x' }]);
    });

    it('OP-12 / OP-14: negative adjustment beyond balance warns; positive one does not', async () => {
      tx.operationResult.findUnique.mockResolvedValue(
        makeResult({ coveredMinor: 1_000_000, uncoveredMinor: 500_000, sourceBalanceAfter: 0 }),
      );
      const negative = await service.create({
        type: 'adjustment',
        sourceEnvelopeId: 'env-src',
        amount: '15000.00',
        sign: '-',
        version: 1,
      });
      expect(negative.warnings.map((w) => w.code)).toEqual(['ADJUSTMENT_EXCEEDS_BALANCE']);
      expect(tx.operation.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sign: '-' }) }),
      );

      tx.operationResult.findUnique.mockResolvedValue(makeResult({ uncoveredMinor: 0 }));
      const positive = await service.create({
        type: 'adjustment',
        sourceEnvelopeId: 'env-src',
        amount: '50.00',
        sign: '+',
        version: 1,
      });
      expect(positive.warnings).toEqual([]);
    });

    it('OP-02: creates a transfer with source and destination; no sign is stored', async () => {
      tx.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 600_000 });

      await service.create({
        type: 'transfer',
        sourceEnvelopeId: 'env-src',
        destinationEnvelopeId: 'env-dst',
        amount: '1000.00',
        sign: '+',
        version: 1,
      });

      expect(tx.operation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-dst',
          requestedMinor: 100_000,
          sign: null,
        }),
      });
    });

    it('OP-07 / AC-07: transfer above the available balance → TRANSFER_EXCEEDS_BALANCE offering the balance', async () => {
      tx.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 600_000 });

      const promise = service.create({
        type: 'transfer',
        sourceEnvelopeId: 'env-src',
        destinationEnvelopeId: 'env-dst',
        amount: '10000.00',
        version: 1,
      });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        code: 'TRANSFER_EXCEEDS_BALANCE',
        message: 'Доступно 6000.00 ₽. Перевести только 6000.00 ₽?',
      });
      expect(tx.operation.create).not.toHaveBeenCalled();
    });

    it('OP-07: a transfer from an envelope without a snapshot is limited to a zero balance', async () => {
      tx.envelopeMonthSnapshot.findUnique.mockResolvedValue(null);

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

    it('OP-07: a transfer exactly equal to the balance is allowed', async () => {
      tx.envelopeMonthSnapshot.findUnique.mockResolvedValue({ closing: 600_000 });

      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'env-dst',
          amount: '6000.00',
          version: 1,
        }),
      ).resolves.toBeDefined();
    });

    it('DATA-11: unknown source / destination envelope → 404 ENVELOPE_NOT_FOUND', async () => {
      await expect(
        service.create({ ...EXPENSE, sourceEnvelopeId: 'missing' }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'ENVELOPE_NOT_FOUND' });
      await expect(
        service.create({
          type: 'transfer',
          sourceEnvelopeId: 'env-src',
          destinationEnvelopeId: 'missing',
          amount: '1.00',
          version: 1,
        }),
      ).rejects.toMatchObject({ code: 'ENVELOPE_NOT_FOUND' });
      expect(tx.operation.create).not.toHaveBeenCalled();
    });

    it('DATA-11: an envelope archived at or before the month is rejected; archived later is allowed', async () => {
      tx.envelope.findUnique.mockResolvedValue(
        makeEnvelope({ status: 'archived', archivedPeriod: '2026-08' }),
      );
      await expect(service.create(EXPENSE)).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_STATUS_TRANSITION',
      });

      tx.envelope.findUnique.mockResolvedValue(
        makeEnvelope({ status: 'archived', archivedPeriod: '2026-09' }),
      );
      await expect(service.create(EXPENSE)).resolves.toBeDefined();
    });

    it('HIST-05: stores the optional comment', async () => {
      await service.create({ ...EXPENSE, comment: 'Молоко' });

      expect(tx.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comment: 'Молоко' }) }),
      );
    });

    it('locks the month row (FOR UPDATE) before reading sequence numbers', async () => {
      const order: string[] = [];
      tx.$queryRaw.mockImplementation(() => {
        order.push('lock');
        return Promise.resolve(lockedRows('open', 1));
      });
      tx.operation.aggregate.mockImplementation(() => {
        order.push('sequence');
        return Promise.resolve({ _max: { sequenceNo: null } });
      });

      await service.create(EXPENSE);

      expect(order).toEqual(['lock', 'sequence']);
    });
  });

  describe('update', () => {
    const EDIT = { amount: '50.00', version: 1 };

    /** Month 1 (version 1) holding op-1; the update returns the stored row merged with `data`. */
    function stubExisting(operation: Operation = makeOperation()): void {
      tx.operation.findUnique.mockResolvedValue(operation);
      tx.operation.findUnique.mockImplementation((args: { select?: unknown }) =>
        Promise.resolve(
          args.select !== undefined ? { monthId: operation.monthId, month: { period: '2026-08' } } : operation,
        ),
      );
      tx.operation.update.mockImplementation(({ data }: { data: Partial<Operation> }) =>
        Promise.resolve({ ...operation, ...data }),
      );
    }

    beforeEach(() => stubExisting());

    it('HIST-08 / OP-17: edits in place (no sequence_no write), recalculates in the SAME tx and bumps the version', async () => {
      const response = await service.update('op-1', EDIT);

      expect(tx.operation.update).toHaveBeenCalledWith({
        where: { id: 'op-1' },
        data: { requestedMinor: 5_000, sourceEnvelopeId: 'env-src', destinationEnvelopeId: null },
      });
      expect(tx.operation.update.mock.calls[0][0].data).not.toHaveProperty('sequenceNo');
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
      expect(db.operation.update).not.toHaveBeenCalled();
      expect(db.operation.findUnique).not.toHaveBeenCalled();
      expect(response.data.summary.version).toBe(2); // ADR 0005: 1 → 2
      expect(response.data.operation.requestedMinor).toBe(5_000);
    });

    it('DATA-12: the version is checked inside the transaction under FOR UPDATE; stale → VERSION_CONFLICT, nothing written', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('open', 2));

      await expect(service.update('op-1', EDIT)).rejects.toMatchObject({
        statusCode: 409,
        code: 'VERSION_CONFLICT',
      });
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(db.$queryRaw).not.toHaveBeenCalled();
      expect(tx.operation.update).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('HIST-10 / AC-14: a closed month returns MONTH_LOCKED without writing', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('closed', 1));

      await expect(service.update('op-1', EDIT)).rejects.toMatchObject({
        statusCode: 409,
        code: 'MONTH_LOCKED',
      });
      expect(tx.operation.update).not.toHaveBeenCalled();
    });

    it.each(['open', 'reopened', 'draft'])('HIST-07: allowed in a %s month', async (status) => {
      tx.$queryRaw.mockResolvedValue([{ status, version: 1 }]);

      await expect(service.update('op-1', EDIT)).resolves.toBeDefined();
    });

    it('unknown operation → 404 OPERATION_NOT_FOUND', async () => {
      tx.operation.findUnique.mockResolvedValue(null);

      await expect(service.update('op-1', EDIT)).rejects.toMatchObject({
        statusCode: 404,
        code: 'OPERATION_NOT_FOUND',
      });
    });

    it('OP-10: the initial balance cannot be edited through the operations API', async () => {
      stubExisting(makeOperation({ type: 'initial_balance', isInitial: true }));

      await expect(service.update('op-1', EDIT)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      });
      expect(tx.operation.update).not.toHaveBeenCalled();
    });

    it('DATA-11: a changed source envelope archived at or before the month is rejected; unknown → 404', async () => {
      tx.envelope.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(
          id === 'env-old' ? makeEnvelope({ id, status: 'archived', archivedPeriod: '2026-08' }) : null,
        ),
      );

      await expect(service.update('op-1', { ...EDIT, sourceEnvelopeId: 'env-old' })).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
      await expect(service.update('op-1', { ...EDIT, sourceEnvelopeId: 'env-x' })).rejects.toMatchObject({
        statusCode: 404,
        code: 'ENVELOPE_NOT_FOUND',
      });
      expect(tx.operation.update).not.toHaveBeenCalled();
    });

    it('DATA-11: an unchanged archived envelope does not block a comment/amount edit', async () => {
      tx.envelope.findUnique.mockResolvedValue(makeEnvelope({ status: 'archived', archivedPeriod: '2026-08' }));

      await expect(service.update('op-1', EDIT)).resolves.toBeDefined();
      expect(tx.envelope.findUnique).not.toHaveBeenCalled();
    });

    it('DATA-09: destination is rejected for an expense, and must differ from the source for a transfer', async () => {
      await expect(
        service.update('op-1', { ...EDIT, destinationEnvelopeId: 'env-dst' }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

      stubExisting(makeOperation({ type: 'transfer', destinationEnvelopeId: 'env-dst' }));
      await expect(
        service.update('op-1', { ...EDIT, sourceEnvelopeId: 'env-dst' }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    });

    it('HIST-09 / OP-07: an edited transfer left uncovered throws TRANSFER_EXCEEDS_BALANCE (rolls the tx back)', async () => {
      stubExisting(
        makeOperation({ type: 'transfer', destinationEnvelopeId: 'env-dst', requestedMinor: 2_000 }),
      );
      tx.operationResult.findUnique.mockResolvedValue(
        makeResult({ coveredMinor: 10_000, uncoveredMinor: 40_000, sourceBalanceBefore: 10_000 }),
      );

      await expect(service.update('op-1', { amount: '500.00', version: 1 })).rejects.toMatchObject({
        statusCode: 409,
        code: 'TRANSFER_EXCEEDS_BALANCE',
        message: 'Доступно 100.00 ₽. Перевести только 100.00 ₽?',
      });
    });

    it('OP-08: a comment-only edit of an already uncovered transfer is not rejected', async () => {
      stubExisting(
        makeOperation({ type: 'transfer', destinationEnvelopeId: 'env-dst', requestedMinor: 50_000 }),
      );
      tx.operationResult.findUnique.mockResolvedValue(
        makeResult({ coveredMinor: 10_000, uncoveredMinor: 40_000 }),
      );

      await expect(service.update('op-1', { comment: 'note', version: 1 })).resolves.toBeDefined();
      expect(tx.operation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comment: 'note', requestedMinor: 50_000 }) }),
      );
    });

    it('OP-06: an edited expense above the balance is saved with an EXPENSE_EXCEEDS_BALANCE warning', async () => {
      tx.operationResult.findUnique.mockResolvedValue(
        makeResult({ coveredMinor: 10_000, uncoveredMinor: 5_000, sourceBalanceBefore: 10_000 }),
      );

      const response = await service.update('op-1', { amount: '150.00', version: 1 });

      expect(response.warnings.map((w) => w.code)).toEqual(['EXPENSE_EXCEEDS_BALANCE']);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      tx.operation.findUnique.mockImplementation((args: { select?: unknown }) =>
        Promise.resolve(
          args.select !== undefined ? { monthId: 'month-1', month: { period: '2026-08' } } : makeOperation(),
        ),
      );
      tx.operation.delete.mockResolvedValue(makeOperation());
    });

    it('OP-18 / HIST-08: deletes and recalculates in the SAME tx, bumps the version, renumbers nothing', async () => {
      const response = await service.remove('op-1', 1);

      expect(tx.operation.delete).toHaveBeenCalledWith({ where: { id: 'op-1' } });
      expect(db.operation.delete).not.toHaveBeenCalled();
      expect(tx.operation.update).not.toHaveBeenCalled();
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', tx);
      expect(response.data.summary.version).toBe(2);
      expect(response.warnings).toEqual([]);
    });

    it('DATA-12: stale version → VERSION_CONFLICT; HIST-10: closed month → MONTH_LOCKED; nothing deleted', async () => {
      tx.$queryRaw.mockResolvedValue(lockedRows('open', 5));
      await expect(service.remove('op-1', 1)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

      tx.$queryRaw.mockResolvedValue(lockedRows('closed', 1));
      await expect(service.remove('op-1', 1)).rejects.toMatchObject({ code: 'MONTH_LOCKED' });

      expect(tx.operation.delete).not.toHaveBeenCalled();
    });

    it('unknown operation → 404; initial balance → 422', async () => {
      tx.operation.findUnique.mockResolvedValue(null);
      await expect(service.remove('op-1', 1)).rejects.toMatchObject({ code: 'OPERATION_NOT_FOUND' });

      tx.operation.findUnique.mockImplementation((args: { select?: unknown }) =>
        Promise.resolve(
          args.select !== undefined
            ? { monthId: 'month-1', month: { period: '2026-08' } }
            : makeOperation({ isInitial: true, type: 'initial_balance' }),
        ),
      );
      await expect(service.remove('op-1', 1)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(tx.operation.delete).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('HIST-11: orders by period then sequence_no and returns results with the period', async () => {
      const row = {
        ...makeOperation(),
        result: makeResult(),
        month: { period: '2026-08' },
      };
      db.operation.findMany.mockResolvedValue([row]);

      const response = await service.list({});

      expect(db.operation.findMany).toHaveBeenCalledWith({
        where: {},
        include: { result: true, month: { select: { period: true } } },
        orderBy: [{ month: { period: 'asc' } }, { sequenceNo: 'asc' }],
      });
      expect(response.operations).toEqual([
        { ...makeOperation(), result: makeResult(), period: '2026-08' },
      ]);
      expect(response.operations[0]).not.toHaveProperty('month');
    });

    it('HIST-11: maps period, type and envelope (either side of a transfer) filters into the query', async () => {
      db.operation.findMany.mockResolvedValue([]);

      await service.list({ period: '2026-08', type: 'transfer', envelopeId: 'env-src' });

      expect(db.operation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            month: { period: '2026-08' },
            type: 'transfer',
            OR: [{ sourceEnvelopeId: 'env-src' }, { destinationEnvelopeId: 'env-src' }],
          },
        }),
      );
    });
  });
});
