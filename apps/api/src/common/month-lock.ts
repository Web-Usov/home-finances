import type { MonthStatus, Prisma } from '@prisma/client';
import { ConflictException, NotFoundException } from './exceptions';
import { assertExpectedVersion, type ExpectedVersion } from './if-match';

/** Satisfied by an interactive transaction client (the lock only lives as long as the transaction). */
type TxClient = Prisma.TransactionClient;

/** Month row as read under the lock — the fields the mutation checks need. */
export interface LockedMonth {
  id: string;
  period: string;
  status: MonthStatus;
  incomeMinor: number;
  version: number;
}

export interface LockMonthOptions {
  /**
   * Optimistic lock (DATA-12, ADR 0005, API-25): the parsed `If-Match` header. Checked right after the month
   * exists: missing → 428, malformed → 422, a different stored version → 409 VERSION_CONFLICT (API-27).
   */
  expectedVersion?: ExpectedVersion;
  /**
   * Reject a closed month with MONTH_LOCKED (MON-03, MSG-06). Default true. Close/reopen pass false:
   * their status rules are INVALID_STATUS_TRANSITION, checked by the caller after the lock.
   */
  rejectClosed?: boolean;
}

type MonthRef = { period: string } | { id: string };

/**
 * Lock the month a mutation targets, then check it under the lock. Every month-scoped mutation
 * calls this first inside its `$transaction`, so a check-then-write cannot interleave with another
 * writer (DATA-12, MON-03, CALC-13).
 *
 * Checks, in the documented order: existence (MONTH_NOT_FOUND) → `expectedVersion`
 * (PRECONDITION_REQUIRED / VALIDATION_ERROR / VERSION_CONFLICT, API-27) → closed (MONTH_LOCKED).
 *
 * Lock scope and order: the cascade of a mutation rewrites and bumps `version` of the target AND of
 * every later month (ADR 0004/0005), so the target and all later months are locked together with
 * one `ORDER BY period ... FOR UPDATE`, i.e. always in ascending period order. A single global
 * order means two mutations can never wait for each other (no deadlock), and any two mutations
 * whose cascades overlap share at least one locked row and therefore serialise. Callers:
 * close = the month, then the draft (a later period); reopen = the target, then the later months
 * (a concurrent close of the single reopened month, MON-13, always shares a locked row with it);
 * create = all months (see `lockAllMonths`).
 */
export async function lockMonthForMutation(
  tx: TxClient,
  ref: MonthRef,
  options: LockMonthOptions = {},
): Promise<LockedMonth> {
  const { expectedVersion, rejectClosed = true } = options;

  // One statement for both refs; the target is the first row (lowest period of the locked range).
  const rows =
    'period' in ref
      ? await tx.$queryRaw<LockedMonth[]>`
          SELECT id, period, status::text AS status, income_minor AS "incomeMinor", version
          FROM budget_month
          WHERE period >= ${ref.period}
          ORDER BY period ASC
          FOR UPDATE`
      : await tx.$queryRaw<LockedMonth[]>`
          SELECT id, period, status::text AS status, income_minor AS "incomeMinor", version
          FROM budget_month
          WHERE period >= (SELECT period FROM budget_month WHERE id = ${ref.id}::uuid)
          ORDER BY period ASC
          FOR UPDATE`;
  const month = rows[0];
  // By period the range starts at the first month >= period, so the first row must be exactly it;
  // by id an unknown id makes the subquery NULL and the range empty.
  if (month === undefined || ('period' in ref && month.period !== ref.period)) {
    throw new NotFoundException(
      'MONTH_NOT_FOUND',
      `Месяц не найден: ${'period' in ref ? ref.period : ref.id}`,
    );
  }

  if (expectedVersion !== undefined) {
    assertExpectedVersion(expectedVersion, month);
  }
  if (rejectClosed && month.status === 'closed') {
    throw new ConflictException(
      'MONTH_LOCKED',
      'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
    );
  }
  return month;
}

/**
 * Lock every month row in ascending period order — the same order as `lockMonthForMutation`.
 * For mutations whose outcome depends on the whole month set (creating the next month reads the
 * statuses of all months). Creations additionally serialise on a transaction-scoped advisory lock,
 * because there may be no row to lock yet (first month) and two creates of the same period would
 * otherwise end in a unique violation.
 */
export async function lockAllMonths(tx: TxClient): Promise<LockedMonth[]> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('budget_month_create'))`;
  return tx.$queryRaw<LockedMonth[]>`
    SELECT id, period, status::text AS status, income_minor AS "incomeMinor", version
    FROM budget_month
    ORDER BY period ASC
    FOR UPDATE`;
}

/**
 * Working month (MON-01, MON-02, MON-04): prefer 'open', then 'reopened', then 'draft'. With no
 * mutable month it falls back to the latest month so a closed-month mutation is rejected with
 * MONTH_LOCKED; null only when no month exists at all. Unlocked read — use `lockWorkingMonth`
 * inside a mutation.
 */
export async function findWorkingMonth(tx: TxClient): Promise<{ id: string; period: string } | null> {
  const mutableMonths = await tx.budgetMonth.findMany({
    where: { status: { in: ['open', 'reopened', 'draft'] } },
    orderBy: { period: 'desc' },
    select: { id: true, period: true, status: true },
  });
  return (
    mutableMonths.find((m) => m.status === 'open') ??
    mutableMonths.find((m) => m.status === 'reopened') ??
    mutableMonths.find((m) => m.status === 'draft') ??
    (await tx.budgetMonth.findFirst({ orderBy: { period: 'desc' }, select: { id: true, period: true } }))
  );
}

/**
 * Lock the working month (see `findWorkingMonth`) for a mutation that has no period in its request
 * (operations, envelope create/archive). The working month is resolved before the lock, so it is
 * resolved again under the lock: a concurrent close may have promoted the draft in between. A later
 * month is already locked by the range lock and is used; an EARLIER one (a reopen) would need a
 * lock out of order, so the caller gets VERSION_CONFLICT and retries. Returns null when no month exists.
 */
export async function lockWorkingMonth(
  tx: TxClient,
  options: LockMonthOptions = {},
): Promise<LockedMonth | null> {
  const candidate = await findWorkingMonth(tx);
  if (candidate === null) {
    return null;
  }
  // The version/status checks wait until the final month is known; take only the lock here.
  const first = await lockMonthForMutation(tx, { id: candidate.id }, { rejectClosed: false });
  const current = await findWorkingMonth(tx);
  if (current === null || current.period < first.period) {
    throw new ConflictException(
      'VERSION_CONFLICT',
      'Состояние месяцев изменилось. Обновите данные и повторите.',
    );
  }
  const month = current.id === first.id ? first : await lockMonthForMutation(tx, { id: current.id }, { rejectClosed: false });
  if (options.expectedVersion !== undefined) {
    assertExpectedVersion(options.expectedVersion, month);
  }
  if ((options.rejectClosed ?? true) && month.status === 'closed') {
    throw new ConflictException(
      'MONTH_LOCKED',
      'Месяц закрыт. Откройте его повторно, чтобы внести изменения.',
    );
  }
  return month;
}
