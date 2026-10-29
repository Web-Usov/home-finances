# apps/api — backend guide

NestJS 10 + Fastify + Prisma 6 + PostgreSQL. Swagger/OpenAPI generated from controllers and Zod schemas.
Global rules (money, periods, types, language, spec references) are in the root `AGENTS.md`; architecture details in
`docs/architecture.md`.

## Module map (`src/`)

| Path | Responsibility | State |
| --- | --- | --- |
| `main.ts` | Fastify bootstrap, prefix `api`, URI versioning (default `v1`), Swagger UI at `/api`, JSON at `/api/swagger.json` (`src/openapi.ts` dumps `openapi.json` without a DB), `DomainExceptionFilter`, open CORS | done |
| `common/` | `ZodValidationPipe`, domain exceptions (422/409/404), `DomainExceptionFilter`, `zodOpenApiSchema` | done |
| `prisma/` | `PrismaService` (global client) | done |
| `health/` | `GET /api/v1/health` | done |
| `modules/calculation-engine/` | stateless cascade recalculation (`recalculateFrom`, `recalculateMonthAtomically`) | done, unit + integration tests |
| `modules/envelopes/` | list/create/update/archive; create with an initial balance inserts the `initial_balance` operation and recalculates the month in the same transaction | done |
| `modules/allocations/` | `PUT /months/:period/allocations` (version check, closed-month check, recalculation) | done |
| `modules/months/` | list, create (draft/auto-open, allocation copy) | partial — `updateIncome`, `close`, `reopen` still return `{ message: 'Not implemented' }` |
| `modules/operations/` | list/create/update/delete | stubs — all `Not implemented` |
| `modules/reporting/` | dashboard + yearly analytics | stubs — return empty shapes |
| `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/` | 7 entities (BudgetMonth, Envelope, Allocation, Operation, OperationResult, EnvelopeMonthSnapshot, AppSettings), idempotent seed | done |

Tasks track the remaining work; check `tasks/` before assuming a stub is free to implement.

## Local conventions

- Controllers are thin: `@ApiTags`/`@ApiOperation`/`@ApiResponse`, validate the body with
  `@Body(new ZodValidationPipe(Schema))`, delegate to the service, return plain objects. No business logic, no `unknown` DTOs.
- Services own business rules. Mutations: `prisma.$transaction(async (tx) => { write source data; engine.recalculateMonthAtomically(monthId, tx) })`.
  Mutations return the affected month summary plus `warnings`.
- Pass the interactive `tx` into the engine; never call it after the transaction has committed.
- Errors: throw `ValidationException` (422), `ConflictException` (409) or `NotFoundException` (404) with a code from
  `ApiErrorCode` in `@family-budget/types`. Add new codes there, not locally.
- Order of checks for month-scoped mutations (as in allocations): existence → `version` (`VERSION_CONFLICT`) → month status (`MONTH_LOCKED`) → business rules.
- User-facing error messages are Russian and must match the spec `MSG-*` texts where one exists.
- Prisma: UUID primary keys (`@id @default(uuid()) @db.Uuid`), money columns `Int` mapped to `*_minor`. Change the schema only
  together with a migration (`pnpm db:migrate`).
- After controller/DTO changes run `pnpm api:generate` and commit `apps/api/openapi.json` and the regenerated client.
- Request schemas in Swagger come from `zodOpenApiSchema(schema)` — never hand-written.
- Cite spec rules by ID in comments (`// OP-08`), not by line number.

## Tests

- Unit: `*.service.spec.ts` / `*.spec.ts` next to the code, Prisma mocked. When mocking `$transaction` pass a DISTINCT `tx` object
  and assert `toHaveBeenCalledWith(id, tx)` on the engine (same-transaction proof); for cascades also assert the BudgetMonth
  `version` bump (ADR 0005). Name new files by feature: `<module>.<feature>.int-spec.ts`.
- Integration: `*.int-spec.ts` (`jest.int.config.js`), real PostgreSQL test DB `family_budget_test` with a schema per jest worker
  (`pnpm db:up`, `apps/api/.env.test`); factories in `test/db.ts`, HTTP-level app helper `createTestApp(modules)` in `test/http.ts`. Details: `docs/testing.md`.
- Engine formulas must be covered by DB-free unit tests (`calculation-engine.service.spec.ts`).

## Commands

```bash
cd apps/api
pnpm dev                 # nest start --watch
pnpm build               # nest build
pnpm typecheck           # after editing packages/types use the ROOT `pnpm typecheck` (turbo builds types first)
pnpm test:unit           # jest, no DB
pnpm test:int            # jest -c jest.int.config.js, needs test DB
pnpm lint                # eslint (flat config)
pnpm openapi             # write openapi.json (use root `pnpm api:generate`)
pnpm start:prod          # node dist/main
npx prisma migrate dev   # create + apply migration
npx prisma generate      # after schema changes
npx prisma studio
```

## Tooling

- No prettier: do not run prettier; ESLint is the only formatter/linter (`pnpm lint`).
- After editing `packages/types`, run the root `pnpm typecheck`, not `pnpm --filter api typecheck` (the latter uses the stale built
  types). The turbo cache is shared across worktrees; logs may show other worktree paths (harmless).

## Anti-patterns

- Float math on money; business logic in controllers; HTTP concerns in the engine.
- Adding auth middleware (ADR 0002); using class-validator DTOs (ADR 0003).
- Editing derived tables (`OperationResult`, `EnvelopeMonthSnapshot`) outside the engine.
- Skipping Prisma migrations when the schema changes.
