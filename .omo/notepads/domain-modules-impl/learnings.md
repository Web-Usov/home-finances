# Learnings — domain-modules-impl

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## DomainExceptionFilter (2026-08-03)

### Created files
- `apps/api/src/common/exceptions/validation.exception.ts` → 422
- `apps/api/src/common/exceptions/conflict.exception.ts` → 409
- `apps/api/src/common/exceptions/not-found.exception.ts` → 404
- `apps/api/src/common/filters/domain-exception.filter.ts`
- `apps/api/src/common/exceptions/index.ts` (barrel export)

### Pattern
- Each exception extends `Error`, carries `statusCode` and `code: ApiErrorCode`
- Filter catches all three via `@Catch(ValidationException, ConflictException, NotFoundException)`
- Response shape: `{ error: ApiErrorCode, message: string }`
- Registered globally via `app.useGlobalFilters(new DomainExceptionFilter())` in `main.ts`

### Gotcha
- NestJS + Fastify: `ctx.getResponse()` returns a Fastify reply object, NOT an Express Response. Avoid importing `Response` from `express` (types absent). Used untyped cast `ctx.getResponse() as { status: ... }` to satisfy TS without adding a new dep.
- `@family-budget/types` exports `ApiErrorCode` union — imported from `packages/types/src/entities.ts`

## ZodValidationPipe (2026-08-03)

### Created files
- `apps/api/src/common/pipes/zod-validation.pipe.ts`
- `apps/api/src/common/pipes/index.ts`
- `apps/api/src/common/common.module.ts` (Global module, exports pipe)
- `apps/api/src/common/index.ts` (updated barrel export)

### Pattern
- Implements `PipeTransform<unknown, unknown>` from `@nestjs/common`
- Constructor takes `ZodSchema` (from `zod`)
- `transform()` calls `schema.safeParse(value)` — returns `{ data }` on success, `{ error: ZodError }` on failure
- On failure: extracts issue messages (with field path prefix) and throws `BadRequestException` with shape `{ message: 'Validation failed', errors: string[] }`
- Registered via `CommonModule` (imported in `AppModule`) making `ZodValidationPipe` injectable globally
- Also usable per-controller: `@UsePipes(new ZodValidationPipe(SomeSchema))`
- `registerGlobally()` static method available for `app.useGlobalPipes()` pattern

### Usage
```typescript
// Per-controller
@Post()
create(@Body(new ZodValidationPipe(CreateMonthRequestSchema)) dto: unknown) {}

// Global (main.ts) - import ZodValidationPipe and use registerGlobally()
// Note: the existing ValidationPipe in main.ts uses class-validator options
// and remains in place; ZodValidationPipe is additive for Zod-based validation
```

### Notes
- `zod` already in `@family-budget/api` dependencies
- `@family-budget/types` already provides Zod schemas (e.g. `CreateMonthRequestSchema`)
- Fastify adapter works with standard NestJS pipes — no Fastify-specific changes needed
- Pre-existing `ValidationPipe` in `main.ts` uses class-validator (marked dead code); ZodValidationPipe is additive

## PrismaService + EnvelopesService CRUD (2026-08-03, Todo 9)

### Created files
- `apps/api/src/prisma/prisma.service.ts` — `PrismaService extends PrismaClient` with onModuleInit/Destroy hooks
- `apps/api/src/prisma/prisma.module.ts` — `@Global()` module, exports PrismaService (pattern mirrors CommonModule); registered in `app.module.ts`
- `apps/api/src/modules/envelopes/envelopes.service.spec.ts` — 19 unit tests, all green
- Evidence: `.omo/evidence/task-9-domain-modules-impl.log`

### Decisions
- **No PrismaService existed** — todo 9 was the first DB-touching todo; created the global module so todos 4-8, 14+ can just inject `PrismaService`.
- **"Current month" resolution**: prefer status `open` → `reopened` → `draft` (NOT latest-by-period — a future draft would wrongly win over the current open month). Falls back to latest overall only to detect the closed-month lock. Spec lines 200-205, 277.
- **MONTH_LOCKED paths in create()**: (a) no mutable month exists and latest is closed; (b) initialBalance > 0 but no month exists at all. No months + no initialBalance → allowed, `createdPeriod` = current calendar YYYY-MM.
- **Name uniqueness**: Prisma `mode: 'insensitive'` on `equals` (translates to LOWER comparison, includes archived envelopes). Name is `trim()`ed before check/storage. On update, duplicate check excludes self via `id: { not: id }` and is skipped when name unchanged.
- **update() never checks month status** — spec line 281: rename/reorder needs no financial recalculation; test asserts budgetMonth is never queried.
- **initial_balance operation**: `type: 'initial_balance'`, `isInitial: true`, `sign`/`destinationEnvelopeId` null, `sequenceNo = max(sequenceNo in month) + 1` (1 if first). Zero initial balance → no operation. Envelope + operation created in one interactive `$transaction` (tx client structurally satisfies `Prisma.TransactionClient`; helpers take a `DbClient` param).
- **Added `ENVELOPE_NOT_FOUND` to ApiErrorCode** in packages/types (additive union member; 404 for unknown ids had no suitable code). Types package must be rebuilt (`pnpm build` in packages/types) — api resolves `@family-budget/types` via `dist/`, not src.
- **list() balances**: one `findMany` on snapshots with `select: { envelopeId, closing, month: { select: { period } } }`, latest-per-envelope picked in JS by period string compare (YYYY-MM lexicographic == chronological). No snapshot → 0.

### Gotchas
- **TS1272 with isolatedModules + emitDecoratorMetadata**: parameter types in decorated controller methods MUST use `import type` (split value/type imports from the service file).
- **Controller DTO typing was forced**: service methods take z.infer DTO types, so the controller now wires `new ZodValidationPipe(CreateEnvelopeRequestSchema)` per @Body (todo 11's core; only swagger body-schema decorators remain for todo 11).
- **Prisma client was NOT generated** in a fresh checkout — run `npx prisma generate` in apps/api before tests/build (`@prisma/client` import fails at runtime otherwise).
- **Unit-test $transaction mock**: `mock.$transaction.mockImplementation((cb) => cb(mock))` — pass the same mock as tx so tx-scoped calls are assertable.
- **`pnpm lint` in apps/api is broken repo-wide** (ESLint 9 flat config missing — `packages/eslint-config` exists but no `eslint.config.js` consumes it). Pre-existing; not fixed here.
- **No commit made**: todos 1-3 leave work uncommitted in a shared tree (todo 3 running concurrently); committing would either sweep in foreign work or produce a non-building commit. Left for the integration wave (Волна 7).
- **RUNTIME BUG FIXED in DomainExceptionFilter (todo 2 file)**: it called Express-style `response.status(n).json(body)` on a Fastify reply → `TypeError: ...json is not a function` → HTTP 500 for EVERY domain exception (the earlier "untyped cast" note above satisfied tsc but not runtime). Fixed to Fastify `response.code(n).send(body)`. Found only by smoke-testing a real server — always boot the API once; unit tests of services never exercise the filter.
- **Smoke-test recipe**: Postgres already runs via `pnpm db:up`; `npx prisma migrate deploy`; `DATABASE_URL=... API_PORT=3100 node dist/main.js`; close/open months directly with `docker exec family-budget-db psql -U budget -d family_budget -c "UPDATE budget_month SET status='closed' ..."`.

## CalculationEngineService.applyOperation (2026-08-03)

### Modified / created files
- `apps/api/src/modules/calculation-engine/calculation-engine.service.ts` (public `applyOperation`, exported `ApplyOperationResult`)
- `apps/api/src/modules/calculation-engine/calculation-engine.service.spec.ts` (20 tests, all spec examples)
- `apps/api/jest.config.js` (NEW — repo had none; ts-jest preset, `testMatch: src/**/*.spec.ts`)
- `apps/api/tsconfig.build.json` (NEW — standard NestJS scaffold; excludes `**/*.spec.ts` from `nest build` output, otherwise specs leak into `dist/` and the Docker image)

### Decisions
- Signature per task: `applyOperation(sourceBalanceBefore, destinationBalanceBefore, requested, type, sign?)` → `{ sourceBalanceAfter, destinationBalanceAfter?, covered, uncovered }`
- Transfer: destination ALWAYS gets the full `requested` amount, even when uncovered (SPECIFICATION.md line 168) — covered/uncovered track only the source side; no debt created
- adjustment '+' and initial_balance: `covered = requested`, `uncovered = 0`, balance increases by full amount
- Fail-fast `throw new Error(...)` for structural misuse: transfer without `destinationBalanceBefore`, adjustment without '+'/'-' sign — silent wrong numbers are worse than a crash in a deterministic engine
- `import type { OperationType } from '@family-budget/types'` — type-only, erased at runtime; package resolves to `dist/` (must be built before api typecheck/jest)

### Verification
- 20/20 jest tests pass; `tsc --noEmit` clean; `nest build` exit 0; compiled dist executed via `node -e` reproduces the spec line-170 example exactly

### Gotchas
- `pnpm lint` is BROKEN repo-wide: no `eslint.config.js` exists anywhere (ESLint v9 requires flat config). Pre-existing gap, unrelated to this task
- `packages/types` must be built (`dist/` present) before `apps/api` typecheck or jest can resolve `@family-budget/types` — it was already built
- Nest CLI auto-uses `tsconfig.build.json` when present; no `nest-cli.json` change needed

## CalculationEngineService.recalculateFrom (2026-08-04, Todo 4)

### Modified files
- `apps/api/src/modules/calculation-engine/calculation-engine.service.ts` (cascade engine)
- `apps/api/src/modules/calculation-engine/calculation-engine.service.spec.ts` (+12 tests, 32 total green)

### Signature
- `recalculateFrom(period: string, db?: Prisma.TransactionClient): Promise<RecalculateFromResult>` → `{ recalculatedFrom, warnings: ApiWarning[] }`
- Optional tx client lets callers commit source-data mutation + cascade atomically (spec line 261); without it the engine wraps the whole cascade in its own `$transaction`

### Decisions
- **Full-month replay**: the caller supplies the earliest affected month; the engine replays each affected month from its restored opening. The "first affected position" (spec step 13) is caller-side; full deterministic replay is what makes derived data reproducible (line 235) — no positional shortcut needed.
- **Opening restore**: snapshots of the latest month with `period < target` (`findFirst orderBy period desc`), closing → opening map. Carried forward month to month.
- **Order within a month** (spec lines 138, 190): `initial_balance` ops first (their own sequenceNo order), then allocations, then remaining ops by sequenceNo. initial_balance ops ALSO get OperationResult rows (balances before/after the initial, pre-allocation).
- **Snapshot semantics**: `transfersOut` = covered part (what actually left the source), `transfersIn` = FULL requested (spec lines 165-168) — per-envelope identity `closing = opening+initial+alloc−expCov+adjNet+trIn−trOut` holds exactly; the transfer gap lives in `uncoveredByType.transfer`. `adjustmentApplied` is NET applied (`-covered` for '-' adjustments, spec line 186). `uncoveredByType` omits zero keys.
- **Snapshot rows only for "touched" envelopes**: non-zero opening OR initial OR allocation OR operation involvement. Prevents infinite zero-snapshot chains for envelopes closed out long ago; an envelope with non-zero balance but no activity still gets a snapshot every month (dashboard needs it).
- **Archived conflict** (line 259): `status='archived' && archivedPeriod <= month.period && closing != 0` → one warning per envelope at the first affected month. Code `ARCHIVED_ENVELOPE_WITH_BALANCE` (plain string — ApiWarning.code is `string`, no types change needed). Message uses `formatMoneyMinor`.
- **Derived rows rebuilt**: `deleteMany` then `createMany` per month (results filtered via relation `where: { operation: { monthId } }`). Never touches Operation/Allocation.
- Missing start month → plain `throw new Error('Budget month not found: ...')` (fail-fast, consistent with applyOperation; ApiErrorCode has no MONTH_NOT_FOUND and adding one was out of scope).

### Gotchas
- **tsc `--noEmit` covers spec files** (`noUncheckedIndexedAccess` on): `mock.calls[i]`/`warnings[0]` indexing needs `?.`/destructuring. `nest build` does NOT catch this (specs excluded via tsconfig.build.json) — always run BOTH typecheck and build.
- **Smoke scripts must run from apps/api/** (not /tmp) or `@prisma/client` won't resolve; the compiled `dist/.../calculation-engine.service.js` can be driven directly with `new CalculationEngineService(new PrismaClient())` — no Nest bootstrap needed.
- **Real-DB smoke caught nothing new but proved**: relation-filter deleteMany, createMany with Json `uncoveredByType`, and deterministic replay (3rd run produced byte-identical snapshots). Scenario: initial 10 000 + alloc 5 000 − expense 3 000 − transfer 15 000 (uncovered 3 000) → archive-with-balance warning on re-run.

### Verification
- 61/61 jest (both suites), `tsc --noEmit` clean, `nest build` exit 0, real-Postgres smoke passed (all balances hand-verified, warning text exact, cleanup done)

## EnvelopesService.archive (2026-08-03, Todo 10)

### Modified files
- `apps/api/src/modules/envelopes/envelopes.service.ts` — real `archive()` replaces the stub; imports `formatMoneyMinor` from `@family-budget/types`
- `apps/api/src/modules/envelopes/envelopes.service.spec.ts` — +10 archive tests (29 total, all green); typecheck + `nest build` clean

### Decisions
- **Check order**: 404 (unknown id) → already-archived idempotent no-op → MONTH_LOCKED → ENVELOPE_NOT_EMPTY → update. Lock precedes balance so a closed month always reports MONTH_LOCKED, never leaks balance state; asserted by a dedicated test.
- **Already-archived = idempotent no-op**: returns the envelope unchanged BEFORE querying months/snapshots. Rationale: a no-op is not a closed-month mutation (spec line 204 gates mutations), and re-archiving must never move `archivedPeriod` (spec line 295 — history before the archive month renders unchanged). Double-click/retry safe.
- **Balance source = `findLatestClosingBalances` helper** (same one `list()` uses): closing of the latest snapshot by YYYY-MM period string compare, 0 when no snapshot exists — archive judges exactly the number the UI displays. No snapshot → archivable.
- **`archivedPeriod` = current working month period** via existing `findCurrentMonth` (open → reopened → draft, fallback latest for lock detection); falls back to `currentCalendarPeriod()` when no budget month exists at all. Reopened months allow archiving with their (historical) period.
- **Return shape `{ envelope }`** — matches create()/update(); the stub's `{ id, status, message }` shape discarded. Controller is a pass-through, untouched.
- **ENVELOPE_NOT_EMPTY message carries the formatted balance** (`formatMoneyMinor` → "1500.50") plus the spec-line-291 remediation hint (transfer or negative adjustment).

### Gotchas
- None new — the todo-9 mock (`$transaction` hands the same mock to the callback) and fixture helpers (`makeEnvelope`, `makeMonth`, `stubArchiveDefaults` mirroring `stubCreateDefaults`) covered everything.

## EnvelopesController DTOs (2026-08-03)

### Status
Already complete when inspected — no changes needed.

### Pattern verified
```typescript
// create()
@Post()
create(@Body(new ZodValidationPipe(CreateEnvelopeRequestSchema)) dto: CreateEnvelopeRequest) {}

// update()
@Patch(':id')
update(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(UpdateEnvelopeRequestSchema)) dto: UpdateEnvelopeRequest,
) {}
```

### Imports
- `CreateEnvelopeRequestSchema, UpdateEnvelopeRequestSchema` from `@family-budget/types`
- `ZodValidationPipe` from `../../common/pipes`
- `CreateEnvelopeRequest, UpdateEnvelopeRequest` (inferred types) via `import type` from `./envelopes.service`
