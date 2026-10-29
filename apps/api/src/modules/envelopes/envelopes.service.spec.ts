import type { BudgetMonth, Envelope } from '@prisma/client';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CalculationEngineService } from '../calculation-engine/calculation-engine.service';
import { EnvelopesService } from './envelopes.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: 'env-1',
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

// ---------------------------------------------------------------------------
// Prisma mock — mirrors the client surface used by EnvelopesService.
// $transaction hands the same mock to the callback as the tx client.
// ---------------------------------------------------------------------------

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
  };
  mock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mock));
  return mock;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function createMockEngine() {
  return {
    recalculateMonthAtomically: jest
      .fn()
      .mockResolvedValue({ recalculatedFrom: '2026-08', warnings: [] }),
  };
}

type MockEngine = ReturnType<typeof createMockEngine>;

function createService(mock: MockPrisma, engine: MockEngine): EnvelopesService {
  return new EnvelopesService(
    mock as unknown as PrismaService,
    engine as unknown as CalculationEngineService,
  );
}

/** Default happy-path stubs for create(): one open month, no duplicates, no envelopes. */
function stubCreateDefaults(mock: MockPrisma, month: BudgetMonth = makeMonth()): void {
  mock.budgetMonth.findMany.mockResolvedValue([month]);
  mock.envelope.findFirst.mockResolvedValue(null);
  mock.envelope.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
  mock.envelope.create.mockImplementation(({ data }: { data: Partial<Envelope> }) =>
    Promise.resolve(makeEnvelope(data)),
  );
  mock.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: null } });
  mock.operation.create.mockResolvedValue({});
}

describe('EnvelopesService', () => {
  let mock: MockPrisma;
  let engine: MockEngine;
  let service: EnvelopesService;

  beforeEach(() => {
    mock = createMockPrisma();
    engine = createMockEngine();
    service = createService(mock, engine);
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('returns an empty list when there are no envelopes', async () => {
      mock.envelope.findMany.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual({ envelopes: [] });
      expect(mock.envelopeMonthSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('returns balance 0 for envelopes without any snapshot', async () => {
      mock.envelope.findMany.mockResolvedValue([makeEnvelope()]);
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([]);

      const { envelopes } = await service.list();

      expect(envelopes.map((e) => e.balanceMinor)).toEqual([0]);
    });

    it('returns the closing balance of the latest snapshot per envelope', async () => {
      mock.envelope.findMany.mockResolvedValue([
        makeEnvelope({ id: 'e1', name: 'Еда' }),
        makeEnvelope({ id: 'e2', name: 'Дом', displayOrder: 1 }),
        makeEnvelope({ id: 'e3', name: 'Архивный', status: 'archived', displayOrder: 2 }),
      ]);
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
        { envelopeId: 'e1', closing: 10_000, month: { period: '2026-06' } },
        { envelopeId: 'e1', closing: 25_050, month: { period: '2026-07' } },
        { envelopeId: 'e2', closing: 50_000, month: { period: '2026-06' } },
      ]);

      const { envelopes } = await service.list();

      expect(envelopes.map((e) => e.balanceMinor)).toEqual([25_050, 50_000, 0]);
      expect(mock.envelope.findMany).toHaveBeenCalledWith({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates an envelope in the open month without initial balance', async () => {
      stubCreateDefaults(mock);
      mock.envelope.aggregate.mockResolvedValue({ _max: { displayOrder: 4 } });

      const result = await service.create({ name: '  Еда  ' });

      expect(mock.envelope.create).toHaveBeenCalledWith({
        data: { name: 'Еда', createdPeriod: '2026-08', displayOrder: 5 },
      });
      expect(mock.operation.create).not.toHaveBeenCalled();
      expect(result.envelope.balanceMinor).toBe(0);
    });

    it('rejects a duplicate name with different casing (ENVELOPE_NAME_DUPLICATE)', async () => {
      stubCreateDefaults(mock);
      mock.envelope.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create({ name: 'еда' })).rejects.toMatchObject({
        code: 'ENVELOPE_NAME_DUPLICATE',
        statusCode: 409,
      });
      await expect(service.create({ name: 'еда' })).rejects.toBeInstanceOf(ConflictException);
      expect(mock.envelope.create).not.toHaveBeenCalled();
      expect(mock.envelope.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'еда', mode: 'insensitive' } },
        select: { id: true },
      });
    });

    it('rejects creation when the latest month is closed (MONTH_LOCKED)', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]); // no mutable month
      mock.budgetMonth.findFirst.mockResolvedValue(makeMonth({ status: 'closed' }));

      await expect(service.create({ name: 'Еда' })).rejects.toMatchObject({
        code: 'MONTH_LOCKED',
        statusCode: 409,
      });
      expect(mock.envelope.create).not.toHaveBeenCalled();
      expect(mock.envelope.findFirst).not.toHaveBeenCalled();
    });

    it('creates an initial_balance operation in the open month when initialBalance is set', async () => {
      stubCreateDefaults(mock);
      mock.operation.aggregate.mockResolvedValue({ _max: { sequenceNo: 7 } });

      const result = await service.create({ name: 'Еда', initialBalance: '1500.50' });

      expect(mock.operation.create).toHaveBeenCalledWith({
        data: {
          monthId: 'month-1',
          sequenceNo: 8,
          type: 'initial_balance',
          sourceEnvelopeId: 'env-1',
          requestedMinor: 150_050,
          isInitial: true,
        },
      });
      expect(result.envelope.balanceMinor).toBe(150_050);
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('OP-10: initial balance recalculates the month in the same transaction', async () => {
      stubCreateDefaults(mock);

      await service.create({ name: 'Еда', initialBalance: '1500.00' });

      expect(engine.recalculateMonthAtomically).toHaveBeenCalledTimes(1);
      expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith('month-1', mock);
      const [createOrder] = mock.operation.create.mock.invocationCallOrder;
      const [recalcOrder] = engine.recalculateMonthAtomically.mock.invocationCallOrder;
      expect(recalcOrder).toBeGreaterThan(createOrder as number);
    });

    it('does not recalculate when no initial balance is given', async () => {
      stubCreateDefaults(mock);

      await service.create({ name: 'Еда' });

      expect(engine.recalculateMonthAtomically).not.toHaveBeenCalled();
    });

    it('uses sequenceNo 1 for the first operation of the month', async () => {
      stubCreateDefaults(mock);

      await service.create({ name: 'Еда', initialBalance: '100.00' });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequenceNo: 1 }) }),
      );
    });

    it('does not create an operation for a zero initial balance', async () => {
      stubCreateDefaults(mock);

      const result = await service.create({ name: 'Еда', initialBalance: '0.00' });

      expect(mock.operation.create).not.toHaveBeenCalled();
      expect(result.envelope.balanceMinor).toBe(0);
    });

    it('rejects initial balance when no budget month exists (MONTH_LOCKED)', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(null);

      await expect(service.create({ name: 'Еда', initialBalance: '100.00' })).rejects.toMatchObject(
        { code: 'MONTH_LOCKED', statusCode: 409 },
      );
      expect(mock.envelope.create).not.toHaveBeenCalled();
    });

    it('creates without a month using the current calendar period when no initial balance', async () => {
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(null);
      mock.envelope.findFirst.mockResolvedValue(null);
      mock.envelope.aggregate.mockResolvedValue({ _max: { displayOrder: null } });
      mock.envelope.create.mockImplementation(({ data }: { data: Partial<Envelope> }) =>
        Promise.resolve(makeEnvelope(data)),
      );

      await service.create({ name: 'Еда' });

      const createArgs = mock.envelope.create.mock.calls[0]?.[0] as {
        data: { createdPeriod: string };
      };
      expect(createArgs.data.createdPeriod).toMatch(/^\d{4}-\d{2}$/);
      expect(mock.operation.create).not.toHaveBeenCalled();
    });

    it('prefers the open month over a future draft for the initial balance operation', async () => {
      const openMonth = makeMonth({ id: 'month-open', period: '2026-08', status: 'open' });
      const draftMonth = makeMonth({ id: 'month-draft', period: '2026-09', status: 'draft' });
      stubCreateDefaults(mock);
      mock.budgetMonth.findMany.mockResolvedValue([draftMonth, openMonth]);

      const result = await service.create({ name: 'Еда', initialBalance: '10.00' });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ monthId: 'month-open' }) }),
      );
      expect(mock.envelope.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdPeriod: '2026-08' }) }),
      );
      expect(result.envelope.balanceMinor).toBe(1_000);
    });

    it('allows creation in a reopened month when no open month exists', async () => {
      const reopened = makeMonth({ id: 'month-reopened', period: '2026-05', status: 'reopened' });
      stubCreateDefaults(mock, reopened);

      await service.create({ name: 'Еда', initialBalance: '10.00' });

      expect(mock.operation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ monthId: 'month-reopened' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('renames an envelope after a case-insensitive duplicate check excluding itself', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.envelope.findFirst.mockResolvedValue(null);
      mock.envelope.update.mockImplementation(({ data }: { data: Partial<Envelope> }) =>
        Promise.resolve(makeEnvelope(data)),
      );

      const { envelope } = await service.update('env-1', { name: 'Продукты' });

      expect(mock.envelope.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'Продукты', mode: 'insensitive' },
          id: { not: 'env-1' },
        },
        select: { id: true },
      });
      expect(mock.envelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { name: 'Продукты' },
      });
      expect(envelope.name).toBe('Продукты');
    });

    it('skips the duplicate check when the name is unchanged', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope({ name: 'Еда' }));
      mock.envelope.update.mockResolvedValue(makeEnvelope());

      await service.update('env-1', { name: 'Еда' });

      expect(mock.envelope.findFirst).not.toHaveBeenCalled();
      expect(mock.envelope.update).toHaveBeenCalledWith({ where: { id: 'env-1' }, data: {} });
    });

    it('rejects rename to an existing envelope name with different casing', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope({ name: 'Еда' }));
      mock.envelope.findFirst.mockResolvedValue({ id: 'other-id' });

      await expect(service.update('env-1', { name: 'ДОМ' })).rejects.toMatchObject({
        code: 'ENVELOPE_NAME_DUPLICATE',
        statusCode: 409,
      });
      expect(mock.envelope.update).not.toHaveBeenCalled();
    });

    it('changes displayOrder without touching the name', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.envelope.update.mockResolvedValue(makeEnvelope({ displayOrder: 3 }));

      await service.update('env-1', { displayOrder: 3 });

      expect(mock.envelope.findFirst).not.toHaveBeenCalled();
      expect(mock.envelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { displayOrder: 3 },
      });
    });

    it('throws NotFoundException for an unknown id', async () => {
      mock.envelope.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.update('missing', { name: 'X' })).rejects.toMatchObject({
        code: 'ENVELOPE_NOT_FOUND',
        statusCode: 404,
      });
      expect(mock.envelope.update).not.toHaveBeenCalled();
    });

    it('never queries months — rename/reorder is independent of month status', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.envelope.update.mockResolvedValue(makeEnvelope({ displayOrder: 2 }));

      await service.update('env-1', { displayOrder: 2 });

      expect(mock.budgetMonth.findMany).not.toHaveBeenCalled();
      expect(mock.budgetMonth.findFirst).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // archive()
  // -------------------------------------------------------------------------

  describe('archive', () => {
    /** Happy-path stubs: active envelope, open month, latest closing 0. */
    function stubArchiveDefaults(month: BudgetMonth = makeMonth()): void {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.budgetMonth.findMany.mockResolvedValue([month]);
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
        { envelopeId: 'env-1', closing: 0, month: { period: month.period } },
      ]);
      mock.envelope.update.mockImplementation(({ data }: { data: Partial<Envelope> }) =>
        Promise.resolve(makeEnvelope(data)),
      );
    }

    it('archives a zero-balance envelope and stamps the current month period', async () => {
      stubArchiveDefaults();

      const { envelope } = await service.archive('env-1');

      expect(mock.envelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { status: 'archived', archivedPeriod: '2026-08' },
      });
      expect(envelope.status).toBe('archived');
      expect(envelope.archivedPeriod).toBe('2026-08');
    });

    it('archives an envelope that has no snapshots at all (balance is 0)', async () => {
      stubArchiveDefaults();
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([]);

      const { envelope } = await service.archive('env-1');

      expect(envelope.status).toBe('archived');
      expect(mock.envelope.update).toHaveBeenCalledTimes(1);
    });

    it('judges the balance by the latest snapshot, ignoring earlier non-zero closings', async () => {
      stubArchiveDefaults();
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
        { envelopeId: 'env-1', closing: 75_000, month: { period: '2026-06' } },
        { envelopeId: 'env-1', closing: 0, month: { period: '2026-07' } },
      ]);

      const { envelope } = await service.archive('env-1');

      expect(envelope.status).toBe('archived');
    });

    it('rejects a non-zero balance with ENVELOPE_NOT_EMPTY including the current balance', async () => {
      stubArchiveDefaults();
      mock.envelopeMonthSnapshot.findMany.mockResolvedValue([
        { envelopeId: 'env-1', closing: 150_050, month: { period: '2026-08' } },
      ]);

      await expect(service.archive('env-1')).rejects.toBeInstanceOf(ConflictException);
      await expect(service.archive('env-1')).rejects.toMatchObject({
        code: 'ENVELOPE_NOT_EMPTY',
        statusCode: 409,
      });
      await expect(service.archive('env-1')).rejects.toThrow(/1500\.50/);
      expect(mock.envelope.update).not.toHaveBeenCalled();
    });

    it('rejects archiving when the latest month is closed (MONTH_LOCKED)', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.budgetMonth.findMany.mockResolvedValue([]); // no mutable month
      mock.budgetMonth.findFirst.mockResolvedValue(makeMonth({ status: 'closed' }));

      await expect(service.archive('env-1')).rejects.toMatchObject({
        code: 'MONTH_LOCKED',
        statusCode: 409,
      });
      expect(mock.envelope.update).not.toHaveBeenCalled();
      expect(mock.envelopeMonthSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('prefers MONTH_LOCKED over ENVELOPE_NOT_EMPTY when both apply', async () => {
      mock.envelope.findUnique.mockResolvedValue(makeEnvelope());
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(makeMonth({ status: 'closed' }));

      await expect(service.archive('env-1')).rejects.toMatchObject({ code: 'MONTH_LOCKED' });
      expect(mock.envelopeMonthSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('allows archiving in a reopened month', async () => {
      const reopened = makeMonth({ id: 'month-reopened', period: '2026-05', status: 'reopened' });
      stubArchiveDefaults(reopened);

      const { envelope } = await service.archive('env-1');

      expect(mock.envelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { status: 'archived', archivedPeriod: '2026-05' },
      });
      expect(envelope.archivedPeriod).toBe('2026-05');
    });

    it('falls back to the current calendar period when no budget month exists', async () => {
      stubArchiveDefaults();
      mock.budgetMonth.findMany.mockResolvedValue([]);
      mock.budgetMonth.findFirst.mockResolvedValue(null);

      const { envelope } = await service.archive('env-1');

      expect(envelope.status).toBe('archived');
      expect(envelope.archivedPeriod).toMatch(/^\d{4}-\d{2}$/);
    });

    it('returns an already-archived envelope unchanged without touching months or snapshots', async () => {
      const archived = makeEnvelope({ status: 'archived', archivedPeriod: '2026-06' });
      mock.envelope.findUnique.mockResolvedValue(archived);

      const { envelope } = await service.archive('env-1');

      expect(envelope).toEqual(archived);
      expect(mock.budgetMonth.findMany).not.toHaveBeenCalled();
      expect(mock.budgetMonth.findFirst).not.toHaveBeenCalled();
      expect(mock.envelopeMonthSnapshot.findMany).not.toHaveBeenCalled();
      expect(mock.envelope.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown id before any other check', async () => {
      mock.envelope.findUnique.mockResolvedValue(null);

      await expect(service.archive('missing')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.archive('missing')).rejects.toMatchObject({
        code: 'ENVELOPE_NOT_FOUND',
        statusCode: 404,
      });
      expect(mock.budgetMonth.findMany).not.toHaveBeenCalled();
      expect(mock.envelopeMonthSnapshot.findMany).not.toHaveBeenCalled();
      expect(mock.envelope.update).not.toHaveBeenCalled();
    });
  });
});
