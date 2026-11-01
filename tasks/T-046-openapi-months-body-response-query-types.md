---
id: T-046
title: "OpenAPI: typed POST /months body, GET /months response and query params"
status: in_progress
epic: E-00
depends: [T-027, T-037, T-050]
blocked_by: []
spec: [API-01, API-02, API-12, API-14]
acceptance: []
area: api
size: S
branch: task/T-046-openapi-months-body-response-query-types
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

- [x] `pnpm api:generate` run; `openapi.json` has a request body for POST /months, a typed 200 for GET /months, typed query params
- [x] Mobile uses the generated hooks/types; mobile component tests and `pnpm e2e:smoke` green
- [x] `pnpm api:contract` green
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- New endpoints.

## Handoff log

<!-- Append-only. -->

## Result

Typed at the controllers (Zod schemas added to `packages/types`, rendered with `zodOpenApiSchema`): `POST /months` body (`@ApiBody`) and 201 response, `GET /months` 200, `GET /envelopes`, `POST /envelopes` 201, `PATCH /envelopes/{id}` 200, `POST /envelopes/{id}/archive` 200 and `GET /health` 200 (all were `void`), query params `period`/`envelopeId` of `GET /operations`, `period` of `GET /dashboard/monthly`, `year` of `GET /analytics/yearly` (were `unknown`).

Mobile: `useCreateMonth` now wraps the generated `useMonthsControllerCreateV1` (no `If-Match`: `POST /months` is not month-scoped, API-25); local `MonthsListResponse`, `CreateMonthBody`, `EnvelopesListResponse` removed, `MonthSummary`/`EnvelopeWithBalance` alias generated types, list hooks lost their `TData` casts.

Guard: `apps/api/src/openapi.contract.spec.ts` (part of `test:unit`, hence verify) fails on any 2xx response without schema, untyped parameter, or POST/PUT/PATCH without body schema (close/reopen/archive exempt).

Deviation: envelopes/health endpoints fixed too (task asked for any other `void`/`unknown`).
