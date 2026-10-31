import type { Prisma } from '@prisma/client';
import { lockAllMonths, lockMonthForMutation, lockWorkingMonth } from './month-lock';

type Row = { id: string; period: string; status: string; incomeMinor: number; version: number };

function row(overrides: Partial<Row> = {}): Row {
  return { id: 'm-08', period: '2026-08', status: 'open', incomeMinor: 100, version: 3, ...overrides };
}

/** A transaction client that is NOT the root client: every call below must go through it. */
function createTx() {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    budgetMonth: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}

describe('lockMonthForMutation', () => {
  it('DATA-12: locks with one FOR UPDATE query ordered by period (ascending lock order) on the tx client', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row(), row({ id: 'm-09', period: '2026-09', status: 'draft' })]);

    const month = await lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 3 });

    expect(month.id).toBe('m-08');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = sql.join('?').replace(/\s+/g, ' ');
    expect(text).toMatch(/WHERE period >= \? ORDER BY period ASC FOR UPDATE$/);
    expect(values).toEqual(['2026-08']);
  });

  it('MON-03 / DATA-12: a month id is resolved inside the same locking statement', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row()]);

    await lockMonthForMutation(client, { id: 'm-08' });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect((tx.$queryRaw.mock.calls[0] as unknown[]).slice(1)).toEqual(['m-08']);
  });

  it('existence is checked first: no row, or the first locked row is a later period → MONTH_NOT_FOUND', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 99 }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MONTH_NOT_FOUND' });

    tx.$queryRaw.mockResolvedValueOnce([row({ period: '2026-09', status: 'closed' })]);
    await expect(
      lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 99 }),
    ).rejects.toMatchObject({ code: 'MONTH_NOT_FOUND' });

    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(lockMonthForMutation(client, { id: 'unknown' })).rejects.toMatchObject({
      code: 'MONTH_NOT_FOUND',
    });
  });

  it('ADR 0005: the version is checked before the status (stale tab on a closed month gets VERSION_CONFLICT)', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row({ status: 'closed', version: 5 })]);

    await expect(
      lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 3 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'VERSION_CONFLICT' });
  });

  it('MON-03 / MSG-06: a closed month with the right version → MONTH_LOCKED with the spec message', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row({ status: 'closed' })]);

    await expect(
      lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 3 }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'MONTH_LOCKED',
      message: 'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
    });
  });

  it('rejectClosed: false leaves the status rule to the caller (close / reopen)', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row({ status: 'closed' })]);

    await expect(
      lockMonthForMutation(client, { period: '2026-08' }, { expectedVersion: 3, rejectClosed: false }),
    ).resolves.toMatchObject({ status: 'closed' });
  });

  it('without expectedVersion the version is not compared', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row({ version: 42 })]);

    await expect(lockMonthForMutation(client, { period: '2026-08' })).resolves.toMatchObject({
      version: 42,
    });
  });
});

describe('lockAllMonths', () => {
  it('serialises creations on an advisory lock, then locks every month in ascending period order', async () => {
    const { tx, client } = createTx();
    tx.$queryRaw.mockResolvedValue([row()]);

    await expect(lockAllMonths(client)).resolves.toHaveLength(1);

    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0] ?? Infinity,
    );
    const [sql] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(sql.join('?').replace(/\s+/g, ' ')).toMatch(/ORDER BY period ASC FOR UPDATE$/);
  });
});

describe('lockWorkingMonth', () => {
  it('MON-04 / MON-01: prefers open, then reopened, then draft; locks it; re-resolves under the lock', async () => {
    const { tx, client } = createTx();
    const open = { id: 'm-08', period: '2026-08', status: 'open' };
    const draft = { id: 'm-09', period: '2026-09', status: 'draft' };
    tx.budgetMonth.findMany.mockResolvedValue([draft, open]);
    tx.$queryRaw.mockResolvedValue([row()]);

    const month = await lockWorkingMonth(client, { expectedVersion: 3 });

    expect(month?.id).toBe('m-08');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.budgetMonth.findMany).toHaveBeenCalledTimes(2); // before and after the lock
  });

  it('returns null when no month exists at all', async () => {
    const { tx, client } = createTx();
    tx.budgetMonth.findMany.mockResolvedValue([]);
    tx.budgetMonth.findFirst.mockResolvedValue(null);

    await expect(lockWorkingMonth(client)).resolves.toBeNull();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('DATA-12: a concurrent close promoted the draft meanwhile → the later (already locked) month is used', async () => {
    const { tx, client } = createTx();
    const open = { id: 'm-08', period: '2026-08', status: 'open' };
    const promoted = { id: 'm-09', period: '2026-09', status: 'open' };
    tx.budgetMonth.findMany
      .mockResolvedValueOnce([open]) // before the lock
      .mockResolvedValue([promoted]); // under the lock: m-08 closed, the draft is open now
    const promotedRow = row({ id: 'm-09', period: '2026-09', version: 7 });
    tx.$queryRaw
      .mockResolvedValueOnce([row({ status: 'closed', version: 4 }), promotedRow]) // range lock from m-08
      .mockResolvedValueOnce([promotedRow]); // lock by the id of the promoted month

    const month = await lockWorkingMonth(client, { expectedVersion: 7 });

    expect(month).toMatchObject({ id: 'm-09', version: 7 });
  });

  it('an EARLIER working month under the lock (a reopen) cannot be locked in order → VERSION_CONFLICT', async () => {
    const { tx, client } = createTx();
    tx.budgetMonth.findMany
      .mockResolvedValueOnce([{ id: 'm-09', period: '2026-09', status: 'draft' }])
      .mockResolvedValue([{ id: 'm-05', period: '2026-05', status: 'reopened' }]);
    tx.$queryRaw.mockResolvedValue([row({ id: 'm-09', period: '2026-09', status: 'draft' })]);

    await expect(lockWorkingMonth(client)).rejects.toMatchObject({
      statusCode: 409,
      code: 'VERSION_CONFLICT',
    });
  });

  it('ADR 0005: version before status on the locked working month', async () => {
    const { tx, client } = createTx();
    tx.budgetMonth.findMany.mockResolvedValue([]);
    tx.budgetMonth.findFirst.mockResolvedValue({ id: 'm-08', period: '2026-08' });
    tx.$queryRaw.mockResolvedValue([row({ status: 'closed', version: 5 })]);

    await expect(lockWorkingMonth(client, { expectedVersion: 3 })).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    await expect(lockWorkingMonth(client, { expectedVersion: 5 })).rejects.toMatchObject({
      code: 'MONTH_LOCKED',
    });
    await expect(lockWorkingMonth(client, { rejectClosed: false })).resolves.toMatchObject({
      status: 'closed',
    });
  });
});
