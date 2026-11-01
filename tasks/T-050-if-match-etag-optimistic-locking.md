---
id: T-050
title: "Optimistic locking via If-Match / ETag headers for all month-scoped mutations"
status: todo
epic: E-01
depends: []
blocked_by: []
spec: [API-25, API-26, API-27, API-17, API-18, API-19, API-21, DATA-12, UI-16]
acceptance: []
area: api
size: M
branch: null
pr: null
---

# T-050. Optimistic locking via If-Match / ETag headers for all month-scoped mutations

## Goal

One locking mechanism everywhere (human decision on PR #33, ADR 0005 addendum): the client sends the expected month version in `If-Match: "<version>"` on every month-scoped mutation and reads the current version from the `ETag` response header. The `version` field leaves request bodies and the `?version=` query leaves `DELETE`. Area is api + mobile + e2e (one vertical slice, kept as one task so the contract never breaks between PRs).

## Context

- Spec: API-25 (which requests, header form), API-26 (`ETag` on month-scoped reads and mutations, CORS expose/allow), API-27 (428 `PRECONDITION_REQUIRED`, 409 `VERSION_CONFLICT`, check order). ADR 0005 addendum (2026-11-01). Month-scoped mutations: `PATCH /months/:period`, `PUT /months/:period/allocations`, `POST /months/:period/close|reopen`, `POST /operations` (target month, API-21), `PATCH|DELETE /operations/:id` (operation month). Not affected: `POST /months`, envelope endpoints, `GET reopen-preview` needs no `If-Match`.
- API: parse `If-Match` in one shared decorator/guard-style helper in `apps/api/src/common/` (strip quotes and an optional `W/` prefix; non-numeric -> 422 `VALIDATION_ERROR`; missing -> 428 `PRECONDITION_REQUIRED`; stale -> existing 409 `VERSION_CONFLICT`). Add `PRECONDITION_REQUIRED` to `ApiErrorCode` in `packages/types` and the error filter (status 428). Keep the order existence -> version -> status -> business rules (architecture.md, month lock). Set `ETag` on month-scoped reads (`GET /dashboard/monthly`, `GET /months`, reopen-preview) and on mutation responses (target month version after the cascade); keep `version` in bodies.
- Remove `version` from `CreateOperationRequestSchema`, `UpdateOperationRequestSchema`, `UpdateIncomeRequestSchema`, `SaveAllocationsRequestSchema`, `CloseMonthRequestSchema`, `ReopenMonthRequestSchema` and drop `DeleteOperationQuerySchema` in `packages/types/src/schemas.ts`. Declare the `If-Match` header parameter and the `ETag` response header in OpenAPI (`@ApiHeader`), then `pnpm api:generate`; the generated client is never edited by hand.
- CORS in `apps/api/src/main.ts`: `exposedHeaders: ['ETag']`, `allowedHeaders` includes `If-Match`.
- Mobile (`apps/mobile`): mutations send `If-Match` from the cached month version and refresh it from the `ETag` of every response (Orval mutator in `src/api`, or per-hook `headers`); 409 handling stays (refetch). Update the docs in `docs/architecture.md` (month-scoped mutations paragraph) and `apps/api/AGENTS.md` if they mention the body `version`.
- e2e: helpers/fixtures in `e2e/fixtures/api.ts` and the specs that call the API directly must send `If-Match`.
- Coordinates with T-041..T-046 (all work with the new contract; T-046 depends on this task).

## Definition of Done

- [ ] `it('API-25 / API-27: mutation without If-Match answers 428 PRECONDITION_REQUIRED')` for every endpoint listed in API-25 (int/http tests)
- [ ] `it('API-27: stale If-Match answers 409 VERSION_CONFLICT before the month status is checked')`
- [ ] `it('API-26: month-scoped reads and mutations return ETag equal to the month version')` incl. a cascade mutation (ETag = target month version after recalculation)
- [ ] `it('API-27: malformed If-Match answers 422 VALIDATION_ERROR')`
- [ ] Request schemas no longer contain `version`; `openapi.json` documents `If-Match`; `pnpm api:generate` run, `pnpm api:contract` green
- [ ] CORS test/assertion: `Access-Control-Expose-Headers` contains `ETag`, `If-Match` is allowed
- [ ] Mobile component tests: mutations send `If-Match` from the cached version, `ETag` refreshes it, 409 refetches (existing tests updated)
- [ ] `pnpm e2e:smoke` green (fixtures send `If-Match`); `pnpm e2e:full` green
- [ ] Docs updated (`docs/architecture.md`, package AGENTS.md); no edits to `docs/spec/**` or `docs/decisions/**`
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] API tasks that mutate financial data: a test asserts the cascade bumped the BudgetMonth `version` (ADR 0005)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Adding locking to envelope endpoints or `POST /months`.
- Switching 409 to 412 (decided: keep `VERSION_CONFLICT`).

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
