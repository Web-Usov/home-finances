---
id: T-046
title: "OpenAPI: typed POST /months body, GET /months response and query params"
status: todo
epic: E-00
depends: [T-027, T-037]
blocked_by: []
spec: [API-01, API-02, API-12, API-14]
acceptance: []
area: api
size: S
branch: null
pr: null
---

# T-046. OpenAPI: typed POST /months body, GET /months response and query params

## Goal

The generated client is typed for `POST /months` (body), `GET /months` (response), and the `period`/`envelopeId`/`year` query params, so the mobile workarounds can go.

## Context

- `apps/api/src/modules/months/months.controller.ts` (no `@ApiBody` on create, list has no response schema), `reporting.controller.ts` and `operations.controller.ts` (`@ApiQuery` without schema, generated as `unknown`).
- Use `zodOpenApiSchema(...)` like the other controllers; add the missing Zod request/response schemas to `packages/types` if absent.
- Mobile workarounds to drop (found in T-009): raw-mutator `useCreateMonth` in `apps/mobile/src/components/month/useMonthMutations.ts`, local `MonthsListResponse`. Chained after T-037, which edits the same month components. Generated code is only regenerated, never hand-edited.

## Definition of Done

- [ ] `pnpm api:generate` run; `openapi.json` has a request body for POST /months, a typed 200 for GET /months, typed query params
- [ ] Mobile uses the generated hooks/types; mobile component tests and `pnpm e2e:smoke` green
- [ ] `pnpm api:contract` green
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- New endpoints.

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
