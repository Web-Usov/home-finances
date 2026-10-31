import { PERIOD, ROUNDS, useRaceHarness, type Race, type Res, type World } from '../../test/races';

/**
 * DATA-12 / MON-03 / CALC-13 (ADR 0005): `close` races every other month-scoped mutation with the SAME version.
 * Real concurrent HTTP requests (listened server), ROUNDS rounds each, both interleavings. Whichever request takes
 * the month row lock first wins; the other one reads the bumped version / closed status under the lock and answers
 * 409 VERSION_CONFLICT or MONTH_LOCKED. Never two successes, never a 5xx, stored state equals the answers.
 */
describe('month row lock: close vs every other mutation (integration)', () => {
  const h = useRaceHarness();

  /** close() vs one other mutation with the same version: exactly one wins (the winner invalidates the version). */
  const closeVs = (
    other: (w: World) => () => Promise<Res>,
    effect: (w: World) => Promise<boolean>,
    extra: Partial<Race> = {},
  ): Race => ({
    requests: (w) => [h.close(w), other(w)],
    effect: async (w, i) => (i === 0 ? (await h.monthStatus()) === 'closed' : effect(w)),
    winners: 1,
    ...extra,
  });

  const races: Record<string, Race> = {
    'PUT allocations': closeVs(h.allocate, async () => (await h.prisma().allocation.count()) === 1),
    'PATCH income': closeVs(h.setIncome, async () => (await h.incomeOf()) === 2_000_000),
    'POST expense': closeVs(h.spend, async () => (await h.opCount()) === 2),
    'PATCH operation': closeVs(
      h.editOperation,
      async (w) =>
        (await h.prisma().operation.findUniqueOrThrow({ where: { id: w.operationId } })).requestedMinor === 700,
    ),
    'DELETE operation': closeVs(h.deleteOperation, async () => (await h.opCount()) === 0),
    'POST envelope with an initial balance': closeVs(
      () => h.createEnvelopeWithBalance('Racer'),
      async () => (await h.prisma().envelope.count({ where: { name: 'Racer' } })) === 1,
    ),
    // archive does not bump the version, so "archive, then close" is a legitimate double success; what must never
    // happen is an archive in a closed month (the archive that follows a close answers MONTH_LOCKED)
    'archive envelope': {
      requests: (w) => [h.close(w), h.archive(w.home.id)],
      effect: async (w, i) =>
        i === 0
          ? (await h.monthStatus()) === 'closed'
          : (await h.prisma().envelope.findUniqueOrThrow({ where: { id: w.home.id } })).status === 'archived',
      check: async (_w, [closeRes, archiveRes]) => {
        expect(closeRes?.status).toBe(200);
        expect([201, 409]).toContain(archiveRes?.status);
        if (archiveRes?.status === 409) expect(archiveRes.error).toBe('MONTH_LOCKED');
      },
    },
    // create and close both succeed in either order; the invariant is that the new month ends up OPEN (promoted by
    // the close, or created open after it) and never a stale draft behind a closed month
    'POST month (next period)': {
      requests: (w) => [h.close(w), () => h.call('POST', '/api/v1/months', { period: '2026-02' })],
      effect: async (_w, i) =>
        i === 0 || (await h.prisma().budgetMonth.count({ where: { period: '2026-02' } })) === 1,
      check: async (_w, res) => {
        expect(res.map((r) => r.status)).toEqual([200, 201]);
        const months = await h
          .prisma()
          .budgetMonth.findMany({ orderBy: { period: 'asc' }, select: { period: true, status: true } });
        expect(months).toEqual([
          { period: PERIOD, status: 'closed' },
          { period: '2026-02', status: 'open' },
        ]);
      },
    },
  };

  it.each(Object.entries(races))(
    `DATA-12 / MON-03 / CALC-13: close vs %s (${ROUNDS} rounds)`,
    (_name, race) => h.runRace(race)(),
    60_000,
  );
});
