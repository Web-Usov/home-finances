---
id: T-053
title: "Structured available field in TRANSFER_EXCEEDS_BALANCE 409 and client usage"
status: done
epic: E-04
depends: [T-011, T-012, T-050]
blocked_by: []
spec: [OP-07, MSG-03]
acceptance: []
area: api
size: M
branch: task/T-053-transfer-exceeds-balance-available-field
pr: https://github.com/Web-Usov/home-finances/pull/57
---

# T-053. Structured available field in TRANSFER_EXCEEDS_BALANCE 409 and client usage

## Goal

The 409 `TRANSFER_EXCEEDS_BALANCE` body carries a structured `available` amount (decimal string) and the mobile client reads it instead of parsing the message text.

## Context

- API: error rendering for `TRANSFER_EXCEEDS_BALANCE` in `apps/api/src/operations/` and the global exception filter; error schema in `packages/types`. Keep `error` and `message` unchanged (MSG-03).
- Mobile: `OperationForm` / error mapping in `apps/mobile` (T-011, T-012 reviews).
- Do not edit `apps/mobile/src/api` by hand; run `pnpm api:generate`.

## Definition of Done

- [x] `it('OP-07 / MSG-03: 409 body contains available as a decimal string')` int test passes
- [x] `it('OP-07: form shows the available amount from the response field')` mobile component test passes (no message parsing)
- [x] `pnpm api:contract` green
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Replace offer in the form and archived-source preselect (T-054).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

`ConflictException` takes optional `extras` (`available`) that `DomainExceptionFilter` merges into the body; `assertTransferCovered` sets `available` = `formatMoneyMinor(availableMinor)` (create: month closing of the source; edit: `sourceBalanceBefore` at the transfer's sequence position). `error` and the MSG-03 `message` are unchanged. `ApiErrorResponseSchema` (types) documents the 409 body in Swagger for POST/PATCH; OpenAPI and client regenerated. Mobile: `describeMonthError` returns `available`; `OperationForm` "Перевести только X" uses it, falling back to the dashboard closing (create) or stored result (edit) only when absent. Tests: int `operations.int-spec.ts` / `operations.update-delete.int-spec.ts`, mobile `OperationForm.test.tsx`, `apiErrors.test.ts`.
