# Family Budget — agent guide

Single-user family budget web app: monthly income is split across savings "envelopes"; spends, transfers and adjustments are
recalculated by a deterministic cascade engine. Monorepo: pnpm + Turborepo, NestJS + Fastify + Prisma + PostgreSQL API,
Expo (React Native Web) + NativeWind client, shared Zod types.

## Hard invariants (never violate)

- **Money is integer kopecks** (`Int` in Prisma, `number` in TS). Never use float for money. Convert only with
  `parseMoneyMinor` / `formatMoneyMinor` from `@family-budget/types`. API transports amounts as decimal strings (`"15000.00"`).
- **No auth in MVP.** Do not add authentication, guards or users (ADR 0002).
- **Periods are `YYYY-MM` strings.** No days, no exact dates (ADR 0006).
- **Types and validation schemas come only from `@family-budget/types`** (Zod). Never duplicate a type/schema in an app.
  Request bodies are validated with `ZodValidationPipe`, not class-validator (ADR 0003).
- **Mobile styling is NativeWind only** (`className`). No `StyleSheet.create`.
- **Business logic lives only in API services and `CalculationEngineService`.** Never in controllers, never in the client.
  The engine is stateless, HTTP-free, and receives an external transaction client (ADR 0004).
- **Source data + cascade recalculation commit in one transaction.** Derived rows (results, snapshots) are rebuilt, never edited.
- **Never commit `.env` or secrets**; use `.env.example`.
- **Do not hardcode the API URL** in the client; use `EXPO_PUBLIC_API_URL`.

## Repo map

```
apps/api/            NestJS API (modules: months, envelopes, allocations, operations, calculation-engine, reporting)
apps/mobile/         Expo Router client (tabs: month, history, analytics, envelopes), generated API client in src/api
packages/types/      Zod schemas, TS entities, ApiErrorCode, money helpers (single source of truth)
packages/tsconfig/   shared tsconfig presets
packages/eslint-config/  shared lint config
docs/                spec, decisions (ADR), architecture, archive
scripts/             repo tooling (spec-check.mjs)
tasks/, epics/       work items (task system, being introduced)
docker-compose.yml   PostgreSQL 16 + API
```

## Commands

```bash
pnpm install
pnpm dev                 # api + mobile in parallel (turbo)
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm db:up               # start PostgreSQL (docker compose)
pnpm db:migrate          # prisma migrate dev
pnpm db:seed             # seed AppSettings (RUB, ru-RU)
pnpm db:studio
pnpm db:reset            # destructive: prisma migrate reset --force
node scripts/spec-check.mjs   # spec rule IDs: uniqueness, dangling references, test coverage report
```

`pnpm verify` is the merge gate (typecheck, lint, tests, build, API contract, tasks check). It is being introduced;
until it lands, run `typecheck`, `lint` and `test` before declaring work done.

## Where to find things

| Need | Location |
| --- | --- |
| Product rules (Russian, with rule IDs) | `docs/spec/README.md` |
| Why decisions were made (Russian) | `docs/decisions/README.md` |
| Modules, request/recalculation flow, error model | `docs/architecture.md` |
| Testing strategy and commands | `docs/testing.md` |
| Agent workflow (one task = one branch = one PR) | `docs/workflow.md` (coming) |
| Work items | `tasks/` (detailed, EN), `epics/` (RU) — being introduced |
| DB schema | `apps/api/prisma/schema.prisma` |
| Domain types / error codes | `packages/types/src/` |
| Historical plans (do not follow) | `docs/archive/` |

Per-package guides: `apps/api/AGENTS.md`, `apps/mobile/AGENTS.md`, `packages/types/AGENTS.md`.

## Referencing the spec

- Cite rules **by ID** (`OP-04`, `AC-06`, `MSG-02`) in tasks, code comments, tests and PRs. **Never by line number** — lines move.
- Tests that prove a rule should mention its ID in the test name or a comment, so `spec-check` can report coverage.
- Do not edit `docs/spec/**` or `docs/decisions/**` as a side effect of a feature task; changes there need a planner task
  and human review. IDs are stable and never reused; deprecated rules are struck through, not deleted.

## Language rule

- **Russian:** epics, key features, spec rules (`docs/spec/**`), ADRs (`docs/decisions/**`).
- **English:** detailed tasks, all AGENTS.md, workflow/testing/architecture docs, agent configs, code, comments, tests,
  commit messages, PR text.
- **UI strings stay Russian** (ru-RU).

## Conventions

- Commits: conventional style, `type(scope): message`, English.
- API routes are prefixed `/api/v1` (URI versioning); Swagger JSON at `/api/swagger.json`; health at `/api/v1/health`.
- Errors: throw domain exceptions (`ValidationException` 422, `ConflictException` 409, `NotFoundException` 404) with an
  `ApiErrorCode`; the global filter renders `{ error, message }`.
- Database ids are UUID v4; month `version` is the optimistic-lock counter (ADR 0005).
- Do not touch generated code in `apps/mobile/src/api` by hand — regenerate with `pnpm --filter @family-budget/mobile orval`
  (needs the API running).
