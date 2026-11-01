---
id: T-055
title: "E2E: real transfer overrun on edit"
status: todo
epic: E-04
depends: [T-054]
blocked_by: []
spec: [OP-07, HIST-09]
acceptance: []
area: mobile
size: S
branch: null
pr: null
---

# T-055. E2E: real transfer overrun on edit

## Goal

A Playwright spec edits an existing transfer so that it really exceeds the source balance and checks the user-visible error with the available amount.

## Context

- `e2e/operations.e2e.ts`, `e2e/support/` helpers (`api.createMonth`, `api.createEnvelope`).
- Message text: MSG-03; the available amount comes from the structured field (T-053).
- Run through `pnpm e2e:full` (machine-wide lock).

## Definition of Done

- [ ] `it('OP-07 / HIST-09: editing a transfer above the source balance shows the overrun error')` e2e passes (`pnpm e2e:full`)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Production code changes (T-053, T-054).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
