import type { BudgetMonth, Envelope } from '@prisma/client';
import { AllocationsModule } from '../src/modules/allocations/allocations.module';
import { EnvelopesModule } from '../src/modules/envelopes/envelopes.module';
import { MonthsModule } from '../src/modules/months/months.module';
import { OperationsModule } from '../src/modules/operations/operations.module';
import { createEnvelope, createMonth, createOperation, resetDb } from './db';
import { createTestApp, etag, TestApp } from './http';

export const ROUNDS = 15;
export const PERIOD = '2026-01';

export interface Res {
  status: number;
  error?: string;
  body: Record<string, unknown>;
}

/** Everything a race may need, created per round on a clean database. */
export interface World {
  month: BudgetMonth;
  food: Envelope;
  home: Envelope;
  /** Version of the month as every racing client read it. */
  version: number;
  /** Id of an expense that exists before the race (for edit / delete races). */
  operationId: string;
}

export interface Race {
  /** Requests fired concurrently; the first one is the "primary" (close, or the first of a same-kind pair). */
  requests: (w: World) => Array<() => Promise<Res>>;
  /**
   * Does the effect of request `i` exist in the database? Compared with its response in every round. For races of
   * identical requests (`shared`) the effect cannot be attributed to one of them: it is checked once for "at least one".
   */
  effect: (w: World, i: number) => Promise<boolean>;
  shared?: boolean;
  /** Expected number of 2xx responses; undefined when several orders legitimately succeed (checked by `check`). */
  winners?: number;
  /** Extra invariant checked after every round. */
  check?: (w: World, res: Res[]) => Promise<void>;
}

const MODULES = [MonthsModule, AllocationsModule, EnvelopesModule, OperationsModule];
const LOSER_CODES = ['VERSION_CONFLICT', 'MONTH_LOCKED', 'INVALID_STATUS_TRANSITION', 'ENVELOPE_NAME_DUPLICATE'];

/**
 * Harness for the month-lock race tests: a listened app (concurrent supertest calls on an unlistened server fail with
 * ECONNRESET, see TestApp.listen), `fetch`-based calls, per-round world setup and the round runner. Call it at the top
 * of a `describe`; it registers its own beforeAll/afterAll.
 */
export function useRaceHarness() {
  let t: TestApp;
  let base: string;

  beforeAll(async () => {
    t = await createTestApp(MODULES);
    base = await t.listen();
  });

  afterAll(async () => {
    await resetDb(t.prisma);
    await t?.close();
  });

  /** `version`, when given, is sent as `If-Match` (API-25) — the expected month version of the racing client. */
  async function call(method: string, path: string, body?: object, version?: number): Promise<Res> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(version !== undefined ? { 'If-Match': etag(version) } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, error: parsed.error as string | undefined, body: parsed };
  }

  const ok = (r: Res) => r.status >= 200 && r.status < 300;
  const prisma = () => t.prisma;
  const versionOf = async (period = PERIOD) =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period } })).version;

  /**
   * Empties the data tables between rounds. DELETE with the schema's ON DELETE CASCADE is about 40% faster than
   * resetDb's TRUNCATE ... CASCADE, which matters at ROUNDS x races rounds.
   */
  async function reset(): Promise<void> {
    await t.prisma.$transaction([
      t.prisma.$executeRaw`DELETE FROM budget_month`, // cascades to operations, allocations, snapshots
      t.prisma.$executeRaw`DELETE FROM envelope`,
    ]);
  }

  async function makeWorld(): Promise<World> {
    await reset();
    const month = await createMonth(t.prisma, { period: PERIOD, status: 'open', incomeMinor: 10_000_000 });
    const food = await createEnvelope(t.prisma, { name: 'Food' });
    const home = await createEnvelope(t.prisma, { name: 'Home' });
    const operation = await createOperation(t.prisma, {
      monthId: month.id,
      sequenceNo: 1,
      type: 'expense',
      sourceEnvelopeId: food.id,
      requestedMinor: 500,
    });
    return { month, food, home, version: await versionOf(), operationId: operation.id };
  }

  const close = (w: World) => () => call('POST', `/api/v1/months/${PERIOD}/close`, undefined, w.version);
  const allocate = (w: World) => () =>
    call('PUT', `/api/v1/months/${PERIOD}/allocations`, { allocations: { [w.food.id]: '100.00' } }, w.version);
  const setIncome = (w: World) => () =>
    call('PATCH', `/api/v1/months/${PERIOD}`, { income: '20000.00' }, w.version);
  const spend = (w: World, type: 'expense' | 'adjustment' = 'expense') => () =>
    call(
      'POST',
      '/api/v1/operations',
      {
        type,
        ...(type === 'adjustment' ? { sign: '+' } : {}),
        sourceEnvelopeId: w.food.id,
        amount: '1.00',
      },
      w.version,
    );
  const editOperation = (w: World) => () =>
    call('PATCH', `/api/v1/operations/${w.operationId}`, { amount: '7.00' }, w.version);
  const deleteOperation = (w: World) => () =>
    call('DELETE', `/api/v1/operations/${w.operationId}`, undefined, w.version);
  const createEnvelopeWithBalance = (name: string) => () =>
    call('POST', '/api/v1/envelopes', { name, initialBalance: '10.00' });
  const archive = (envelopeId: string) => () => call('POST', `/api/v1/envelopes/${envelopeId}/archive`, {});

  const opCount = () => t.prisma.operation.count({ where: { isInitial: false } });
  const incomeOf = async () =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period: PERIOD } })).incomeMinor;
  const monthStatus = async () =>
    (await t.prisma.budgetMonth.findUniqueOrThrow({ where: { period: PERIOD } })).status;

  /** Fires the race's requests concurrently (alternating which goes first) and asserts the invariants. */
  async function runRound(race: Race, round: number): Promise<void> {
    const w = await makeWorld();
    const requests = race.requests(w);
    const order = requests.map((_, i) => i);
    if (round % 2 === 1) order.reverse();
    const settled = await Promise.all(order.map(async (i) => [i, await requests[i]?.()] as const));
    const res = settled.sort(([a], [b]) => a - b).map(([, r]) => r as Res);
    const label = JSON.stringify(res.map((r) => [r.status, r.error]));

    // never a 5xx: no deadlock, serialization failure, unique violation or pool timeout
    expect({ round, label, serverErrors: res.filter((r) => r.status >= 500).length }).toEqual({
      round,
      label,
      serverErrors: 0,
    });
    // every loser is a domain conflict, never 200 and never an unexpected error
    for (const loser of res.filter((r) => !ok(r))) {
      expect({ round, label, status: loser.status, known: LOSER_CODES.includes(loser.error ?? '') }).toEqual({
        round,
        label,
        status: 409,
        known: true,
      });
    }
    if (race.winners !== undefined) {
      expect({ round, label, winners: res.filter(ok).length }).toEqual({ round, label, winners: race.winners });
    }
    // what is stored equals what was answered: a request has its effect iff it was accepted
    const attributable = race.shared === true ? [0] : res.keys();
    for (const i of attributable) {
      const accepted = race.shared === true ? res.some(ok) : ok(res[i] as Res);
      expect({ round, label, request: i, applied: await race.effect(w, i) }).toEqual({
        round,
        label,
        request: i,
        applied: accepted,
      });
    }
    await race.check?.(w, res);
  }

  function runRace(race: Race) {
    return async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        await runRound(race, round);
      }
    };
  }

  return {
    prisma,
    reset,
    call,
    ok,
    versionOf,
    makeWorld,
    runRace,
    close,
    allocate,
    setIncome,
    spend,
    editOperation,
    deleteOperation,
    createEnvelopeWithBalance,
    archive,
    opCount,
    incomeOf,
    monthStatus,
  };
}
