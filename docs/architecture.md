# Architecture

Describes how the system is built **today**. Product rules live in `docs/spec/` (Russian, cited here by rule ID); the reasons
behind choices live in `docs/decisions/` (ADR numbers cited here). Where code lags behind the spec, this is called out as
"Gap".

## 1. System overview

```
Expo web client (apps/mobile)  --HTTP/JSON-->  NestJS + Fastify API (apps/api)  --Prisma-->  PostgreSQL 16
        |                                              |
        +------- @family-budget/types (Zod schemas, entities, ApiErrorCode, money helpers) -------+
```

- Monorepo: pnpm workspaces + Turborepo. Packages: `apps/api`, `apps/mobile`, `packages/types`, `packages/tsconfig`,
  `packages/eslint-config`.
- Single user, no authentication (ADR 0002). Single currency RUB, locale ru-RU.
- All money is integer kopecks (ADR 0001); a period is a `YYYY-MM` string (ADR 0006).

## 2. API modules (`apps/api/src`)

| Module | Responsibility | Spec | State |
| --- | --- | --- | --- |
| `common/` | `ZodValidationPipe`, domain exceptions, `DomainExceptionFilter`, `zodOpenApiSchema` | API-17 | done |
| `prisma/` | `PrismaService` (extends `PrismaClient`, connects on init) | — | done |
| `health/` | `GET /api/v1/health` | — | done |
| `months/` | month list/create, status transitions, income, close/reopen | MON-*, API-01…06 | list/create/income/close/reopen done |
| `envelopes/` | list/create/rename/reorder/archive, balances | ENV-*, API-07…09 | done |
| `allocations/` | save the whole allocation table of a month, optionally with the month income (one transaction) | UI-11…15, API-04, API-22 | done |
| `operations/` | expenses, transfers, adjustments, history | OP-*, HIST-*, API-10…11 | done |
| `calculation-engine/` | deterministic cascade recalculation | CALC-*, FIN-*, OP-* | done |
| `reporting/` | monthly dashboard, yearly analytics | UI-06…10, REP-*, API-12…13 | monthly dashboard done (read-only over snapshots), yearly stub |

Dependency direction: domain modules → `CalculationEngineService` and `PrismaService`; the engine depends only on
`PrismaService`; nothing depends on controllers. `packages/types` depends on nothing in the repo.

Global setup (`main.ts`): global prefix `api`, URI versioning with default version `1` (routes are `/api/v1/...`), Swagger UI
at `/api` and JSON at `/api/swagger.json`, `DomainExceptionFilter`, open CORS (no credentials).

## 3. Request flow

```
HTTP request
  → Fastify / Nest router (/api/v1/...)
  → Controller               thin: parses params, declares Swagger metadata
  → ZodValidationPipe(Schema) validates the body against a schema from @family-budget/types
  → Service                  business rules and checks (existence, version, month status, domain rules)
  → prisma.$transaction(tx)  write source data
      → CalculationEngineService.recalculateMonthAtomically(monthId, tx)   (same tx)
  → response: { data: <affected month summary>, warnings: [...] }   (API-16)
```

Rules:

- Controllers contain no business logic and return plain objects.
- A mutation writes source data and runs the cascade inside **one** `$transaction` (CALC-13, API-15); the interactive `tx`
  client is passed to the engine as `db`. This includes creating an envelope with an initial balance: the `initial_balance`
  operation is inserted and the month is recalculated in the same transaction, otherwise `GET /envelopes` (which reads
  `EnvelopeMonthSnapshot.closing`) would show 0.
- Month-scoped mutations check, in this order: existence (`MONTH_NOT_FOUND`) → `If-Match` version (`PRECONDITION_REQUIRED` 428 /
  `VALIDATION_ERROR` 422 / `VERSION_CONFLICT` 409, ADR 0005, API-27) → month status (`MONTH_LOCKED`, MON-03, NFR-18) → domain
  rules. See `AllocationsService.save` for the reference flow.
- **Optimistic locking through `If-Match` / `ETag`** (API-25…API-27, ADR 0005 addendum). The expected month version travels ONLY in
  the request header `If-Match: "<version>"` of `PATCH /months/{period}`, `PUT /months/{period}/allocations`,
  `POST /months/{period}/close|reopen`, `POST /operations` (target month), `PATCH|DELETE /operations/{id}` (operation month);
  never in a body or query. One shared mechanism in `common/`: the `@IfMatch()` parameter decorator (`if-match.ts`) classifies the
  header into an `ExpectedVersion` (`version` | `missing` | `malformed`; the strong form `"7"` and the weak `W/"7"` are accepted)
  and the service hands it to `lockMonthForMutation` / `lockWorkingMonth`, which call `assertExpectedVersion` right after the month
  row exists and is locked (so 404 wins over 428/422, and the version is judged before the status). `@ApiIfMatch()` documents the
  header parameter and the 428 response in OpenAPI. Month-scoped reads and mutations return `ETag: "<version>"` of the
  addressed month (for cascades the target month AFTER the recalculation): handlers marked `@MonthETag()` are served by the global
  `MonthETagInterceptor` (`month-etag.ts`), which reads the version from the response body (`data.summary`, `data.month`, `month`).
  ETag is set on `GET /dashboard/monthly`, `GET /months/{period}/reopen-preview` and every mutation above; `GET /months`, analytics
  and the envelope endpoints carry none. CORS (`configureApp`) exposes `ETag` and allows `If-Match`. Creating a month
  (`POST /months`) and envelope operations need no header; `GET .../reopen-preview` needs none either.
- All of these checks run **inside** the mutation's `$transaction`, after `lockMonthForMutation(tx, ...)` (`common/month-lock.ts`):
  one `SELECT ... WHERE period >= <target> ORDER BY period FOR UPDATE` locks the target month and every later month, because
  the cascade rewrites and bumps `version` of all of them (ADR 0004/0005). Locks are therefore always taken in ascending period
  order (close: the month, then the draft; reopen: the target, then the later months; create: all months via `lockAllMonths`
  plus an advisory lock), so mutations never deadlock and any two mutations with overlapping cascades serialise (DATA-12). The
  single-reopened rule (MON-13) is checked under that lock. Mutations without a period (operations create, envelope
  create/archive) lock the working month through `lockWorkingMonth`: it resolves the working month, locks, and resolves it
  again under the lock. If the working month changed in between to an EARLIER one (a concurrent reopen), locking it would break
  the ascending lock order, so the mutation answers `409 VERSION_CONFLICT` and the client refetches and retries. A check outside
  the transaction or without the lock is a race (two tabs with the same `version` both succeed).
- Response shape of month mutations (API-22): `PATCH /months/{period}`, `PUT /months/{period}/allocations` and the operation
  mutations return `{ data: { summary, ... }, warnings }` with the short `MonthSummary` (re-read after the cascade, see
  `common/month-summary.ts`); envelope balances come only from `GET /dashboard/monthly`. `close`/`reopen` keep their `month` field.
- `PUT /months/{period}/allocations` takes an optional `income`: the income update and the allocations replace commit in one
  transaction under one lock and `version` check, with one cascade; FIN-02 is checked against the new income. Clients save the
  month income and the allocation table with this one request instead of choosing an order for two calls.
- `ZodValidationPipe` throws the domain `ValidationException` (HTTP 422, code `VALIDATION_ERROR`, message lists failing field
  paths; API-17), rendered by `DomainExceptionFilter` as `{ error, message }`.
- Gap: only `EnvelopesController` and `AllocationsController` use `ZodValidationPipe`; other controllers still accept
  `unknown`/plain types (ADR 0003); each feature task adds the pipe to its endpoints.

## 4. Recalculation flow

`CalculationEngineService` (stateless; ADR 0004):

- `recalculateFrom(period, db?)` — recalculates every month from `period` forward. With `db` it runs inside the caller's
  transaction, otherwise it opens its own `$transaction`.
- `recalculateMonthAtomically(monthId, db?)` — resolves the month, calls `recalculateFrom(month.period, tx)` and increments
  `version` on all months with `period ≥ month.period`. Throws `NotFoundException('MONTH_NOT_FOUND')` for an unknown id.

Algorithm (CALC-02…CALC-07):

1. Load the affected months (`period ≥ start`, ascending).
2. Restore opening balances from the snapshots of the latest earlier month (its `closing` per envelope).
3. Load allocations, operations (ordered by `sequenceNo`) and envelopes for the affected months.
4. For each month, in order: apply initial balances, then the allocation, then operations by `sequenceNo`
   (FIN-13, FIN-14, OP-15…OP-17). Per operation compute covered/uncovered parts (OP-05, OP-09, OP-14).
5. Delete and recreate the derived rows of the month — `OperationResult` and `EnvelopeMonthSnapshot` — and carry the
   closing balances into the next month (FIN-04).
6. Collect warnings, including `ARCHIVED_ENVELOPE_WITH_BALANCE` (CALC-12), and return `{ recalculatedFrom, warnings }`.

Source data is never modified by the engine; derived data is always reproducible from it (CALC-01, DATA-13).

## 5. Error model

```
service throws  ValidationException (422) | ConflictException (409) | NotFoundException (404) | PreconditionRequiredException (428)
                      each carries  code: ApiErrorCode  and a Russian message
   → DomainExceptionFilter  (@Catch of exactly these four)
   → reply  { "error": "<ApiErrorCode>", "message": "<text>" }  with the exception's status code
```

- `ApiErrorCode` (in `packages/types/src/entities.ts`): `ALLOCATION_EXCEEDS_INCOME`, `MONTH_LOCKED`, `TRANSFER_EXCEEDS_BALANCE`,
  `ENVELOPE_NOT_EMPTY`, `ENVELOPE_NOT_FOUND`, `MONTH_NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_STATUS_TRANSITION`,
  `INVALID_PERIOD`, `ENVELOPE_NAME_DUPLICATE`, `VALIDATION_ERROR`, `OPERATION_NOT_FOUND`, `PRECONDITION_REQUIRED` (428, no `If-Match`).
  New codes are added there, never locally.
- Message texts mirror spec `MSG-*` where one exists (e.g. MSG-01, MSG-06).
- Non-fatal conditions are returned as `warnings` (`{ code, message }`) in mutation responses, not as errors (API-16).
- Unhandled errors fall through to Nest's default 500 handling.

## 6. Data model overview

Prisma schema: `apps/api/prisma/schema.prisma`; UUID v4 primary keys; money columns `Int` mapped to `*_minor`. Spec: DATA-01…DATA-13.

| Entity | Kind | Notes |
| --- | --- | --- |
| `BudgetMonth` | source | `period` (unique `YYYY-MM`), `status` (draft/open/closed/reopened), `incomeMinor`, `version` |
| `Envelope` | source | unique `name`, `status` (active/archived), `createdPeriod`, `archivedPeriod`, display order |
| `Allocation` | source | unique (month, envelope), `amountMinor` |
| `Operation` | source | `sequenceNo` (unique per month), type, source/destination envelope, requested amount, sign, `isInitial`, comment |
| `OperationResult` | derived | covered/uncovered parts and balances before/after; rebuilt by the engine |
| `EnvelopeMonthSnapshot` | derived | per envelope and month: opening, initial, allocation, expenses, adjustments, transfers, closing, uncovered by type |
| `AppSettings` | system | single row: currency RUB, locale ru-RU, schema version (seeded) |

Derived tables may be wiped and rebuilt from source tables at any time.

## 7. Client architecture (`apps/mobile`)

- **Routing:** Expo Router, file-based. `app/_layout.tsx` wraps everything in `Providers`; `app/index.tsx` redirects to
  `/(tabs)/month`; `app/(tabs)/` holds the four tabs (month, history, analytics, envelopes).
- **API access:** Orval generates React Query hooks and model types from the committed `apps/api/openapi.json` into `src/api/` (ADR 0012;
  `pnpm api:generate`, drift checked by `pnpm api:contract`); requests go through `customAxiosInstance` with base URL
  `EXPO_PUBLIC_API_URL` = API origin without `/api` (default `http://localhost:3000`).
- **Server state:** TanStack Query (`QueryProvider`: 5 min `staleTime`, no refetch on window focus).
- **Optimistic locking (API-25, API-26):** month-scoped mutations go through `useMonthMutation` (`src/lib/useMonthMutation.ts`): the
  variables carry the displayed month's cached `version`, the helper sends it as `If-Match: "<version>"` (`ifMatch` in
  `src/lib/monthVersion.ts`, through the second argument of the Orval mutator) and refetches the budget data after every settled
  request. An axios response interceptor feeds the `ETag` of every month-scoped response to `syncMonthVersionFromETag`, which
  refreshes the cached dashboard version. 409 `VERSION_CONFLICT` shows the server message (data is refetched); 428 (a client bug)
  shows a generic hint.
- **Local UI state:** Zustand stores — `monthStore` (current period), `envelopeStore` (selected envelope), `uiStore`
  (sidebar, active tab).
- **Forms:** React Hook Form + Zod resolver using schemas from `@family-budget/types`; shared `FormInput` component.
- **Styling:** NativeWind v4 only (`className`).
- **State of screens:** Envelopes is wired to the API; Month, History and Analytics are placeholders.

## 8. Cross-cutting decisions

| Topic | Decision |
| --- | --- |
| Money | integer kopecks everywhere; decimal strings on the wire (ADR 0001) |
| Contract | Zod in `packages/types` → Swagger → Orval client (ADR 0003, 0012) |
| Consistency | one transaction per mutation incl. cascade; optimistic `version` (ADR 0004, 0005) |
| Auth | none in MVP (ADR 0002) |
| Deployment | `docker-compose.yml`: PostgreSQL 16 (volume `postgres_data`), one-shot `migrate` service (`prisma migrate deploy`), API image (host `postgres`, healthcheck `/api/v1/health`); verified by `pnpm smoke:compose` |
