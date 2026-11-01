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

Name new test files by **feature**, not by layer: `<module>.<feature>.int-spec.ts` (e.g.
`envelopes.initial-balance.int-spec.ts`, `allocations.version-conflict.int-spec.ts`); the same for unit files when a
module has several (`envelopes.http.spec.ts`). Do not keep growing one catch-all `<module>.int-spec.ts`.

The suffix decides which jest config picks the file up
(`jest.config.js` → `*.spec.ts`, `jest.int.config.js` → `*.int-spec.ts`),
so never put DB access in a `*.spec.ts` file.

## Running tests

From the repo root:

```bash
pnpm verify          # full gate: typecheck → lint → test:unit → test:scripts → spec:check → tasks:check → test:int → build → api:contract
pnpm verify:quick    # typecheck → lint → test:unit → test:scripts → spec:check → tasks:check (this is the pre-commit hook)
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

`pnpm test:scripts` runs the tests of the repo tooling (`scripts/__tests__/*.test.mjs`, Node's built-in `node --test`, no
dependencies) for `with-lock` (and `scripts/lib/lock.mjs`, the e2e lock of the Playwright config), `task-start` (including concurrent `--new` calls against a throwaway origin) and `task-clean`; it is a step of both `verify:quick` and `verify`. Add a
`<script>.test.mjs` there when you change a script; keep decision logic in exported pure functions and spawn the script
against a temp dir / throwaway git repo for the rest.

Rules for these tests (`scripts/__tests__/helpers.mjs`): call `installGuards()` at the top of the file; create temp dirs only with
`makeTmp()` (removed in an `after` hook, worktrees included); build git environments with `gitEnv()` (sets
`GIT_CEILING_DIRECTORIES` to the tmp root; a guard asserts after every test that the real repo's `core.bare` is not `true`);
synchronise with `waitFor(cond)` (generous deadline), never with fixed sleeps. `test:scripts` runs with `--test-timeout=300000`.

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

### HTTP-level integration (`test/http.ts`)

`createTestApp(modules)` builds the real app setup (`configureApp`: prefix `/api`, URI versioning, `DomainExceptionFilter`;
pipes are per-endpoint) with the given feature modules and the real Prisma client on the worker schema. Use it with supertest
when the behaviour depends on HTTP + DB together (status codes, error bodies, persisted rows):

```ts
import request from 'supertest';
import { createTestApp, TestApp } from '../../../test/http';
import { resetDb } from '../../../test/db';

let t: TestApp;
beforeAll(async () => { t = await createTestApp([EnvelopesModule]); });
beforeEach(() => resetDb(t.prisma));
afterAll(async () => { await resetDb(t.prisma); await t.close(); });

it('API-17: ...', async () => {
  await request(t.app.getHttpServer()).post('/api/v1/envelopes').send({ name: '' }).expect(422);
});
```

(see `envelopes.int-spec.ts`). The helper lives in `test/` and is imported only by `*.int-spec.ts`; HTTP tests with a mocked
`PrismaService` stay `*.spec.ts` (`envelopes.http.spec.ts`).

**`If-Match` (API-25):** month-scoped mutations need the header; send it with `.set('If-Match', etag(version))` (`etag` from `test/http.ts`),
never in the body. `src/common/if-match.etag.int-spec.ts` is the reference: 428 / 422 / 409 / `ETag` / CORS for every endpoint.

**Concurrent requests:** supertest on the unlistened `getHttpServer()` binds a new `listen(0)` per request, so parallel requests fail
with `read ECONNRESET` (a harness artefact, not a product defect). For races use `const base = await t.listen()` (the app on an
ephemeral port) with `request(base)` or `fetch`. `test/races.ts` (`useRaceHarness`) builds on it: per-round world, both
interleavings, assertions "exactly N winners, losers are domain 409, never 5xx, stored state equals the answers"; used by
`src/common/month-lock.concurrency.*.int-spec.ts` (DATA-12, MON-13). A new month-scoped mutation adds a race against `close` there.

### Unit-test patterns for transactions and cascades

- When a service uses `prisma.$transaction(async (tx) => ...)`, mock `$transaction` to hand a **distinct** `tx` object (not the
  same mock as `prisma`), so a test can prove everything ran inside the same transaction:

  ```ts
  const tx = { operation: { create: jest.fn() } };
  prisma.$transaction.mockImplementation((fn) => fn(tx));
  await service.create(dto);
  expect(tx.operation.create).toHaveBeenCalled();
  expect(engine.recalculateMonthAtomically).toHaveBeenCalledWith(month.id, tx);   // same-transaction usage
  expect(prisma.operation.create).not.toHaveBeenCalled();                          // nothing outside the tx
  ```

- For **any operation that triggers cascade recalculation**, assert that the BudgetMonth `version` was bumped (ADR 0005):
  in unit tests that the engine (which owns the increment) is called with the month id and `tx`, in integration tests that
  `budgetMonth.version` is `previous + 1` after the call. Tasks of this kind carry a matching DoD line (`tasks/_template.md`).

## Traceability to the specification

Tests that verify a spec rule or acceptance criterion put its ID at the start of
the test name:

```ts
it('OP-04 / AC-08: expense above the balance is covered partially', ...);
describe('CALC-02', () => { ... });
```

IDs come from `docs/spec/*.md` (`**[OP-04]**`, `AC-08`). `pnpm spec:check` (`scripts/spec-check.mjs`, part of `verify`) fails on duplicate or dangling IDs and
reports spec rules and AC that no test covers (warnings; `--verbose` lists them). Without a spec
ID use a plain behaviour description.

`pnpm spec:check --strict-coverage` additionally fails when an AC-* is not referenced from a test file (any mention in a
`*.spec.ts`, `*.int-spec.ts`, `*.e2e.ts` or `*.test.tsx` counts, so cite an AC only in a test that really asserts it).
ACs whose test must wait for a later UI task are listed in `scripts/spec-coverage-deferred.json`
(`{ "AC-21": { "task": "T-xxx", "reason": "..." } }`). The allowlist only shrinks: once the AC is covered the entry
makes the check fail until it is removed. API-level acceptance scenarios live in
`apps/api/src/acceptance/acceptance.mvp-scenarios.int-spec.ts`.

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

Package `e2e/` (`@family-budget/e2e`), Chromium only. Specs are `e2e/**/*.e2e.ts`.

```bash
pnpm e2e:smoke   # tests tagged @smoke — required for every UI task and runs in CI job `e2e`
pnpm e2e:full    # all specs — runs on master (workflow `e2e-full`) and before milestones
pnpm --filter @family-budget/e2e report   # open the last HTML report
```

First run on a machine: `pnpm --filter @family-budget/e2e install:browsers`
(`playwright install chromium`; on a bare Linux box use
`pnpm --filter @family-budget/e2e exec playwright install --with-deps chromium`).
Needs the test database from the section above (`family_budget_test`).

### What runs

`playwright.config.ts` starts two `webServer`s on free ports (so parallel runs and
agents do not collide):

1. **API** (`support/start-api.mjs`): the built `apps/api/dist` against a dedicated schema
   `e2e_<random>` of the test DB — `DROP SCHEMA` → `prisma migrate deploy` → `node dist/main`.
   The DB name must end with `_test` (same safety check as the integration tests); URL comes from
   `TEST_DATABASE_URL` or `apps/api/.env.test`. The schema is dropped at the end of the run.
   The root `e2e:*` scripts build the API first.
2. **Web** (`support/start-web.mjs`): `expo export --platform web --clear` with
   `EXPO_PUBLIC_API_URL` pointing to that API, served as a static SPA. `--clear` is needed:
   Metro caches the inlined env value. The first export takes a few minutes.

`EXPO_PUBLIC_API_URL` is the API **origin** without `/api` (generated client paths already start
with `/api/v1`).

### Projects and tags

| Project | Selects | Screenshots | Script |
|---------|---------|-------------|--------|
| `smoke` | tests tagged `@smoke` | always (`screenshot: 'on'`) | `e2e:smoke` |
| `full`  | every spec | on failure | `e2e:full` |

Tag a test or a `describe` with `{ tag: '@smoke' }`. Keep smoke small (minutes, not tens of
minutes): app boots, navigation, one real create-through-UI flow. Everything else goes untagged
and is covered by `e2e:full`. The viewport is 390×844 because the bottom tab bar is hidden from
768px up.

### Fixtures

`import { test, expect } from '../fixtures/test'` instead of `@playwright/test`. The auto-used
`api` fixture (`fixtures/api.ts`) **resets the DB before every test** (truncates all tables of the
e2e schema) and offers `api.createMonth(period, income?)` and `api.createEnvelope(name, initialBalance?)`
over HTTP. Add helpers there for new entities. Arrange state through `api`, act and assert through
the UI; check the backend directly when the test must prove persistence. Tests run with one worker
because they share one schema.

### Artifacts

Reports land in `e2e/playwright-report/` (HTML, with screenshots for smoke) and
`e2e/test-results/` (traces, kept on failure). CI uploads `playwright-report` as an artifact on
every run; open a trace with `pnpm --filter @family-budget/e2e exec playwright show-trace <trace.zip>`.

### Adding e2e specs to a UI task

1. Add `e2e/<area>/<name>.e2e.ts` covering the new screen/flow (acceptance criteria of the task).
2. Tag `@smoke` only if the flow is critical to the app starting and navigating; otherwise leave untagged.
3. Select elements by role/visible text (UI is Russian); add `testID`/`accessibilityLabel` in the app if needed.
4. Run `pnpm e2e:smoke` (and `pnpm e2e:full` if you added untagged specs) before opening the PR.

### Machine-wide lock and resources

Every e2e run on the machine is serialized by one lockfile `<os.tmpdir()>/family-budget-e2e.lock` (`{ pid, cwd, started }`),
whichever way it is started: `pnpm e2e:smoke` / `pnpm e2e:full` (through `scripts/with-lock.mjs`) **and a direct
`playwright test`** (the Playwright config takes the same lock itself, `e2e/support/e2e-lock.mjs`, over `scripts/lib/lock.mjs`).
The config takes it at load time rather than in `globalSetup` because Playwright starts the `webServer`s (API + Expo web export,
the heavy part) before `globalSetup`; `global-teardown.ts` releases it (and so does process exit). Re-entrancy: the holder lists
the lock name in env `FAMILY_BUDGET_LOCKS_HELD`, which children inherit (Playwright workers and web servers, or `playwright test`
under `with-lock.mjs`), and asking for a name that is already listed is a no-op, so nothing deadlocks by taking it twice.
If another run holds it, the command prints who holds it every 30s and waits (up to 90 min, `WITH_LOCK_TIMEOUT_MIN`); a lock whose
pid is dead (a crashed or killed run), or that is empty/unparsable and older than 10s, is stale and is taken over automatically
(atomic rename, so concurrent waiters cannot both win). `with-lock.mjs` starts its command without a shell, in its own process
group; SIGINT/SIGTERM are forwarded to that whole group and the lock is released only after the child has exited (exit code
128+signal). Do not delete the lockfile of a live run. Side effect: any `playwright test` invocation that loads the config
(including `--list`) waits for the lock too.

The same module backs the `task-id` lock of `pnpm task:start --new` (`docs/workflow.md`, "Filing new work"): ids are allocated and the claim
branch is pushed under it.

An e2e run needs **~2 GB of free RAM** (API + Expo web export + Chromium; the script warns when less is free), and the first web
export on a machine can take several minutes (Metro cold cache; later runs are faster but `--clear` is always used). Do not start
other heavy jobs (second e2e, `smoke:compose`) while it runs; `pnpm verify` of another agent is fine.

`e2e:smoke` is deliberately **not** part of `pnpm verify` (slow, builds the web bundle); CI runs it as a separate job.

## API contract

`apps/api/openapi.json` is generated **without a running server** (`pnpm api:generate` boots the
Nest app without connecting to the DB and writes the document) and is the input of Orval, which
generates `apps/mobile/src/api/**`. Both are committed.

```bash
pnpm api:generate   # regenerate openapi.json and the mobile client — run after changing controllers/DTOs
pnpm api:contract   # regenerate and fail if the working tree differs (part of `pnpm verify` and CI job `contract`)
```

Never edit `apps/mobile/src/api/**` by hand.

## Compose smoke

`pnpm smoke:compose` (`scripts/smoke-compose.sh`) builds the production API and web images and checks the
real deployment path: `docker compose up --build` under an isolated project name and free host ports
(`POSTGRES_PORT`/`API_HOST_PORT`/`WEB_HOST_PORT`, `docker-compose.smoke.yml` override drops fixed container names, so no clash
with the dev `family-budget-db` on 5432 or the preview on 3100/8100), waits for healthy, checks `/api/v1/health` directly and through
the web proxy and that the web index is served, creates a month, envelopes, an expense and a transfer over HTTP, snapshots
operations / months / envelopes / dashboard, restarts the whole stack, and requires the snapshot to be byte-identical
(AC-22 / DOD-01). It then tears everything down, including the volume. Takes ~5-15 minutes (cold web export); not part of `verify`.
Run it when you touch `Dockerfile`, `docker/web/`, `docker-compose*.yml` or the API start-up.
