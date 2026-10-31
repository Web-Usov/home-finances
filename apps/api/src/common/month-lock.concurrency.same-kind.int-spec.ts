import { PERIOD, ROUNDS, useRaceHarness, type Race } from '../../test/races';

/**
 * DATA-12 / MON-13 / ENV-06 (ADR 0005): two writers of the same kind with the SAME version (two browser tabs).
 * Real concurrent HTTP requests (listened server), ROUNDS rounds each, both interleavings: exactly one succeeds,
 * the other gets a domain 409/4xx, never a 5xx (no deadlock, no unique violation), stored state equals the answers.
 */
describe('month row lock: same-kind concurrent mutations (integration)', () => {
  const h = useRaceHarness();

  const races: Record<string, Race> = {
    'close vs close': {
      requests: (w) => [h.close(w), h.close(w)],
      effect: async () => (await h.monthStatus()) === 'closed',
      shared: true,
      winners: 1,
    },
    'PUT allocations vs PUT allocations': {
      requests: (w) => [h.allocate(w), h.allocate(w)],
      effect: async () => (await h.prisma().allocation.count()) === 1,
      shared: true,
      winners: 1,
    },
    'PATCH income vs PATCH income': {
      requests: (w) => [h.setIncome(w), h.setIncome(w)],
      effect: async () => (await h.incomeOf()) === 2_000_000,
      shared: true,
      winners: 1,
    },
    'POST expense vs POST expense': {
      requests: (w) => [h.spend(w), h.spend(w)],
      effect: async () => (await h.opCount()) === 2,
      shared: true,
      winners: 1,
      check: async () => {
        // sequence_no is unique per month (OP-17) and gap-free here: a lost race would show a duplicate or a 500
        const numbers = (await h.prisma().operation.findMany({ select: { sequenceNo: true } })).map(
          (o) => o.sequenceNo,
        );
        expect(numbers.sort()).toEqual([1, 2]);
      },
    },
    'DELETE operation vs PATCH operation': {
      requests: (w) => [h.deleteOperation(w), h.editOperation(w)],
      effect: async (w, i) => {
        const op = await h.prisma().operation.findUnique({ where: { id: w.operationId } });
        return i === 0 ? op === null : op !== null && op.requestedMinor === 700;
      },
      winners: 1,
    },
    'POST envelope vs POST envelope (same name, initial balance)': {
      requests: () => [h.createEnvelopeWithBalance('Twin'), h.createEnvelopeWithBalance('Twin')],
      effect: async () => (await h.prisma().envelope.count({ where: { name: 'Twin' } })) === 1,
      shared: true,
      winners: 1,
      check: async (_w, res) => {
        expect(res.filter((r) => !h.ok(r)).map((r) => [r.status, r.error])).toEqual([
          [409, 'ENVELOPE_NAME_DUPLICATE'],
        ]);
      },
    },
    'archive vs archive (same envelope)': {
      requests: (w) => [h.archive(w.home.id), h.archive(w.home.id)],
      effect: async (w) =>
        (await h.prisma().envelope.findUniqueOrThrow({ where: { id: w.home.id } })).status === 'archived',
      shared: true,
      winners: 2,
      check: async (w) => {
        const env = await h.prisma().envelope.findUniqueOrThrow({ where: { id: w.home.id } });
        expect(env.archivedPeriod).toBe(PERIOD); // ENV-13: never moved by the second archive
      },
    },
  };

  it.each(Object.entries(races))(
    `DATA-12 / CALC-13: %s (${ROUNDS} rounds)`,
    (_name, race) => h.runRace(race)(),
    60_000,
  );

  it(`MON-13 / DATA-12: reopening two different closed months at once → exactly one wins (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      await h.reset();
      for (const [period, status] of [['2026-01', 'closed'], ['2026-02', 'closed'], ['2026-03', 'open']] as const) {
        await h.prisma().budgetMonth.create({ data: { period, status, incomeMinor: 0 } });
      }
      const [v1, v2] = [await h.versionOf('2026-01'), await h.versionOf('2026-02')];
      const fire = [
        () => h.call('POST', '/api/v1/months/2026-01/reopen', { version: v1 }),
        () => h.call('POST', '/api/v1/months/2026-02/reopen', { version: v2 }),
      ];
      if (round % 2 === 1) fire.reverse();
      const res = await Promise.all(fire.map((f) => f()));
      const label = JSON.stringify(res.map((r) => [r.status, r.error]));

      expect({ round, label, winners: res.filter(h.ok).length }).toEqual({ round, label, winners: 1 });
      const loser = res.find((r) => !h.ok(r));
      expect({ round, label, status: loser?.status }).toEqual({ round, label, status: 409 });
      expect(['VERSION_CONFLICT', 'INVALID_STATUS_TRANSITION']).toContain(loser?.error);
      expect(await h.prisma().budgetMonth.count({ where: { status: 'reopened' } })).toBe(1);
    }
  }, 60_000);

  it(`DATA-12: reopening the same month twice with the same version → one wins (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      await h.makeWorld();
      await h.prisma().budgetMonth.update({ where: { period: PERIOD }, data: { status: 'closed' } });
      const version = await h.versionOf();
      const res = await Promise.all(
        [0, 1].map(() => h.call('POST', `/api/v1/months/${PERIOD}/reopen`, { version })),
      );
      const label = JSON.stringify(res.map((r) => [r.status, r.error]));

      expect({ round, label, winners: res.filter(h.ok).length }).toEqual({ round, label, winners: 1 });
      expect(res.find((r) => !h.ok(r))?.error).toBe('VERSION_CONFLICT');
      expect(await h.versionOf()).toBe(version + 1);
    }
  }, 60_000);

  it(`ENV-06: two creates of the same envelope name with NO month to serialise on → one 201, one 409 (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      await h.reset();
      const res = await Promise.all(
        [0, 1].map(() => h.call('POST', '/api/v1/envelopes', { name: 'Solo' })),
      );
      const label = JSON.stringify(res.map((r) => [r.status, r.error]));

      expect({ round, label, statuses: res.map((r) => r.status).sort() }).toEqual({
        round,
        label,
        statuses: [201, 409],
      });
      expect(res.find((r) => !h.ok(r))?.error).toBe('ENVELOPE_NAME_DUPLICATE');
    }
  }, 60_000);

  it(`MON-05 / MON-06: two creates of the same first month → one 201, the other a 4xx, never 5xx (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      await h.reset();
      const res = await Promise.all(
        [0, 1].map(() => h.call('POST', '/api/v1/months', { period: '2026-01', income: '100.00' })),
      );
      const label = JSON.stringify(res.map((r) => [r.status, r.error]));

      expect({ round, label, winners: res.filter(h.ok).length }).toEqual({ round, label, winners: 1 });
      const loser = res.find((r) => !h.ok(r));
      expect({ round, label, clientError: (loser?.status ?? 500) < 500 }).toEqual({ round, label, clientError: true });
      expect(await h.prisma().budgetMonth.count()).toBe(1);
    }
  }, 60_000);
});
