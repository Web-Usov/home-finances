# Testing

## Test pyramid

| Level | Where | Needs | Speed | Runs |
|-------|-------|-------|-------|------|
| Unit (API) | `apps/api/src/**/*.spec.ts` | nothing (Prisma mocked) | seconds | pre-commit, CI |
| Unit (mobile) | `apps/mobile/src/**/*.test.tsx` | nothing | seconds | pre-commit, CI |
| Integration (API) | `apps/api/src/**/*.int-spec.ts` | PostgreSQL test DB | seconds | `pnpm verify`, CI |
| E2E (Playwright) | `e2e/` | API + Expo web + test DB | minutes | CI (see below) |

Most tests should be unit tests. Write an integration test when the behaviour
depends on real SQL: transactions, rollbacks, constraints, cascades, ordering.

## File naming

- `*.spec.ts` — API **unit** test. No database. Prisma is replaced by a mock.
  A test that builds a Nest app with a mocked `PrismaService` (HTTP layer) is still
  a unit test, so it is `*.spec.ts` (e.g. `envelopes.http.spec.ts`).
- `*.int-spec.ts` — API **integration** test. Uses the real test database.
- `*.test.ts(x)` — mobile test (jest-expo), next to the component it covers.

The suffix decides which jest config picks the file up
(`jest.config.js` → `*.spec.ts`, `jest.int.config.js` → `*.int-spec.ts`),
so never put DB access in a `*.spec.ts` file.

## Running tests

From the repo root:

```bash
pnpm verify          # full gate: typecheck → lint → test:unit → test:int → build
pnpm verify:quick    # typecheck → lint → test:unit (this is the pre-commit hook)
pnpm test:unit       # unit tests of all packages
pnpm test:int        # integration tests (needs the DB container, see below)
pnpm test            # unit + integration
```

Single package:

```bash
pnpm --filter @family-budget/api test:unit
pnpm --filter @family-budget/api test:int
pnpm --filter @family-budget/api test:cov      # unit tests with coverage
pnpm --filter @family-budget/mobile test
pnpm --filter @family-budget/api exec jest path/to/file.spec.ts -t "part of test name"
```

`verify` runs steps one after another and stops at the first failure. The list of
steps lives in `scripts/verify.mjs`; add new gates there.

## Test database

Integration tests run against a dedicated database `family_budget_test` — never
the dev database `family_budget`.

Setup (once per machine):

1. `pnpm db:up` starts the `family-budget-db` container. On a **fresh** volume the
   script `docker/postgres/init/01-test-db.sql` creates `family_budget_test`.
   For a volume that already exists run:
   `docker exec family-budget-db psql -U budget -d postgres -c 'CREATE DATABASE family_budget_test'`
2. `cp apps/api/.env.test.example apps/api/.env.test` (gitignored).

In CI set `TEST_DATABASE_URL` instead of the file. The ambient `DATABASE_URL`
(dev DB) is ignored by the test setup, and the setup refuses any database whose
name does not end with `_test`.

### Isolation

- `jest.int.config.js` → `test/jest-global-setup.ts` generates a random run id and,
  for every jest worker, creates a Postgres schema `test_<runId>_w<workerId>` and
  applies `prisma migrate deploy` to it.
- `test/jest-setup-env.ts` points `DATABASE_URL` of each worker to its schema
  before any module is imported, so `PrismaClient` only sees that schema.
- `test/jest-global-teardown.ts` drops the schemas of the run.

Result: workers in one run, and parallel runs by several developers/agents, never
share rows. If a run is killed, leftover `test_*` schemas can be dropped safely
once no test run is active:
`DROP SCHEMA test_<runId>_w1 CASCADE;`.

Tests must not rely on data left by other tests: every test starts from empty tables.

## Helpers and fixtures

`apps/api/test/db.ts`:

```ts
import { createTestPrisma, resetDb, createMonth, createEnvelope,
         createAllocation, createOperation } from '../../../test/db';

const prisma = createTestPrisma();
beforeAll(() => prisma.$connect());
beforeEach(() => resetDb(prisma));      // TRUNCATE all tables of this worker's schema
afterAll(async () => { await resetDb(prisma); await prisma.$disconnect(); });

it('...', async () => {
  const month = await createMonth(prisma, { period: '2026-01', incomeMinor: 1_000_000 });
  const env = await createEnvelope(prisma, { name: 'Food' });
  await createAllocation(prisma, { monthId: month.id, envelopeId: env.id, amountMinor: 500_000 });
});
```

Factories take sensible defaults and a partial override object. Extend
`test/db.ts` when a new entity needs a factory instead of repeating `prisma.x.create`
in tests. For unit tests, build entity objects with a local `makeX(overrides)` helper
(see `months.service.spec.ts`).

## Traceability to the specification

Tests that verify a spec rule or acceptance criterion put its ID at the start of
the test name:

```ts
it('OP-04 / AC-08: expense above the balance is covered partially', ...);
describe('CALC-02', () => { ... });
```

IDs come from `docs/spec/*.md` (`**[OP-04]**`, `AC-08`). `scripts/spec-check.mjs` (planned with the spec split) checks that
referenced IDs exist and reports spec rules that no test covers. Without a spec
ID use a plain behaviour description.

## Mobile tests

- Stack: `jest-expo` preset + `@testing-library/react-native`; config in
  `apps/mobile/jest.config.js` (handles NativeWind via `babel.config.js` and the pnpm
  `node_modules/.pnpm` layout in `transformIgnorePatterns`).
- Helpers: `apps/mobile/test/render.tsx` → `renderWithProviders(ui)` wraps the component
  in a `QueryClientProvider` (no retries, `gcTime: Infinity` so no timers keep jest alive).
  Shared mocks go to `apps/mobile/test/setup.ts`.
- Mock the network at `src/api/axios-instance` (see `EnvelopeCard.test.tsx`); never call
  a real API from component tests. Do not edit `src/api/**` — it is generated by Orval.
- Query by visible text or role, interact with `fireEvent.press`, wait with
  `findBy*` / `waitFor`.
- UI strings are Russian; assert on them as they are.

## E2E (Playwright)

_To be filled in together with the `e2e/` workspace (boot of API on the test DB and
Expo web, `e2e:smoke` / `e2e:full`, traces and screenshots on failure)._
