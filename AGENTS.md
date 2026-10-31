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
e2e/                 Playwright workspace (@family-budget/e2e)
scripts/             repo tooling (verify, api-contract, spec-check, tasks, smoke-compose)
tasks/, epics/       work items: detailed tasks (EN), epics (RU); tasks/README.md is the generated board
docker-compose.yml   PostgreSQL 16 + one-shot `migrate` + API
```

## Commands

```bash
pnpm install
pnpm dev                 # api + mobile in parallel (turbo)
pnpm verify              # merge gate: typecheck, lint, test:unit, test:scripts, spec:check, tasks:check, test:int, build, api:contract
pnpm verify:quick        # typecheck, lint, test:unit, test:scripts, spec:check, tasks:check (pre-commit hook)
pnpm build / typecheck / lint
pnpm test:unit           # no DB;  pnpm test:int needs the test DB (docs/testing.md)
pnpm e2e:smoke           # Playwright @smoke (CI job `e2e`);  pnpm e2e:full = all specs (machine-wide lock, ~2 GB RAM)
pnpm api:generate        # regenerate apps/api/openapi.json + Orval client;  pnpm api:contract = fail on drift
pnpm smoke:compose       # docker compose up/restart/persistence check (touching Docker files)
pnpm spec:check          # spec rule IDs: uniqueness, dangling references, coverage report
pnpm tasks:check | tasks:board | tasks:next | tasks:set   # task system (scripts/tasks.mjs)
pnpm test:scripts        # node --test for scripts/__tests__ (part of verify)
pnpm task:start T-xxx    # claim: worktree + branch + env + install + claim commit;  pnpm task:clean T-xxx after the merge
pnpm task:start --new "<title>" --epic E-xx --area <a> --size <S|M>   # file follow-up work as a new task and claim it
pnpm db:up               # start PostgreSQL (docker compose)
pnpm db:migrate          # prisma migrate dev
pnpm db:seed             # seed AppSettings (RUB, ru-RU)
pnpm db:studio
pnpm db:reset            # destructive: prisma migrate reset --force
```

`pnpm verify` is the merge gate and what CI job `verify` runs (jobs `contract` and `e2e` are the other required checks).
Run it before declaring work done. Test details: `docs/testing.md`.

## Where to find things

| Need | Location |
| --- | --- |
| Product rules (Russian, with rule IDs) | `docs/spec/README.md` |
| Why decisions were made (Russian) | `docs/decisions/README.md` |
| Modules, request/recalculation flow, error model | `docs/architecture.md` |
| Testing strategy and commands | `docs/testing.md` |
| Agent workflow (one task = one branch = one PR) | `docs/workflow.md` |
| Owner's preview (auto-deployed master, URLs, logs, reset) | `docs/preview.md` |
| Work items | `tasks/` (detailed, EN), `epics/` (RU); board in `tasks/README.md` |
| DB schema | `apps/api/prisma/schema.prisma` |
| Domain types / error codes | `packages/types/src/` |
| Historical plans (do not follow) | `docs/archive/` |

Per-package guides: `apps/api/AGENTS.md`, `apps/mobile/AGENTS.md`, `packages/types/AGENTS.md`.

## Workflow

One task = one session = one branch (`task/T-xxx-slug`) = one git worktree = one PR. Full lifecycle: `docs/workflow.md`.

1. `/next` (`pnpm tasks:next`) picks a ready task; `/next T-xxx` (`pnpm task:start T-xxx`) creates the worktree and sets `in_progress`.
2. Implement tests-first, cite rule IDs in test names, commit as `type(scope): subject [T-xxx]`.
3. `/verify` (`pnpm verify`), then `/ship`: push, PR from the template, then one commit setting `done` + PR url; `/ship` never merges.
4. `/review <pr|T-xxx>` runs the reviewer; verdict is a PR comment (same GitHub account, no self-approval; required approvals = 0).
   On LGTM only the reviewer enables `gh pr merge --squash --auto` (not for spec/ADR/epics PRs: the human merges).
5. Never end a session with uncommitted changes: `/handoff` (WIP commit, push, Handoff log entry in the task file).
6. Spec ambiguity: set the task `blocked`, add a Q-proposal to the Handoff log. Only the planner changes `docs/spec/**`,
   `docs/decisions/**`, `epics/**` (human review).

Agents (`.opencode/agents/`): `implementer`, `reviewer`, `planner`, `qa`. Commands (`.opencode/commands/`): `/next`,
`/verify`, `/handoff`, `/ship`, `/review`, `/status`, `/milestone`.

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

## Tooling notes

- **No prettier.** Do not run prettier (or any other formatter): ESLint is the only formatter/linter (`pnpm lint`). Match the
  surrounding style.
- After editing `packages/types` run the root `pnpm typecheck` (turbo builds the types package first); `pnpm --filter api typecheck`
  alone sees the stale `dist` of the types package.
- The turbo cache is shared across worktrees: replayed logs may show paths of other worktrees; harmless.
- Ports 3100 (preview API) and 8100 (preview web) are reserved for the preview (`docs/preview.md`): never bind, reuse or kill them from tests, dev servers or agents.
- Commit headers are at most 100 characters; pre-commit checks the working tree, so stage everything you commit.
- Claim a task with `pnpm task:start T-xxx`, clean up after the merge with `pnpm task:clean T-xxx`.

## Conventions

- Commits: conventional style, `type(scope): message`, English.
- API routes are prefixed `/api/v1` (URI versioning); Swagger UI at `/api`, JSON at `/api/swagger.json`; health at `/api/v1/health`.
- Errors: throw domain exceptions (`ValidationException` 422, `ConflictException` 409, `NotFoundException` 404) with an
  `ApiErrorCode`; the global filter renders `{ error, message }`.
- Database ids are UUID v4; month `version` is the optimistic-lock counter (ADR 0005).
- Do not touch generated code in `apps/mobile/src/api` by hand. After changing controllers/DTOs run `pnpm api:generate`
  (writes the committed `apps/api/openapi.json`, then Orval; no running server needed); `pnpm api:contract` fails on drift.
- `EXPO_PUBLIC_API_URL` is the API **origin** (`http://localhost:3000`), without `/api`; generated paths already start with `/api/v1`. The value `same-origin` (or `/`) makes the client use the page origin (preview, `docs/preview.md`).
- Integration tests use the separate DB `family_budget_test` (`apps/api/.env.test`), never the dev DB.
