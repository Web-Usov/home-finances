---
id: T-053
title: "Structured available field in TRANSFER_EXCEEDS_BALANCE 409 and client usage"
status: todo
epic: E-04
depends: [T-011, T-012, T-050]
blocked_by: []
spec: [OP-07, MSG-03]
acceptance: []
area: api
size: M
branch: null
pr: null
---

# T-053. Structured available field in TRANSFER_EXCEEDS_BALANCE 409 and client usage

## Goal

The 409 `TRANSFER_EXCEEDS_BALANCE` body carries a structured `available` amount (decimal string) and the mobile client reads it instead of parsing the message text.

## Context

- API: error rendering for `TRANSFER_EXCEEDS_BALANCE` in `apps/api/src/operations/` and the global exception filter; error schema in `packages/types`. Keep `error` and `message` unchanged (MSG-03).
- Mobile: `OperationForm` / error mapping in `apps/mobile` (T-011, T-012 reviews).
- Do not edit `apps/mobile/src/api` by hand; run `pnpm api:generate`.

## Definition of Done

- [ ] `it('OP-07 / MSG-03: 409 body contains available as a decimal string')` int test passes
- [ ] `it('OP-07: form shows the available amount from the response field')` mobile component test passes (no message parsing)
- [ ] `pnpm api:contract` green
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Replace offer in the form and archived-source preselect (T-054).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
