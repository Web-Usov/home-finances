---
id: T-055
title: "E2E: real transfer overrun on edit"
status: done
epic: E-04
depends: [T-054]
blocked_by: []
spec: [OP-07, HIST-09]
acceptance: []
area: mobile
size: S
branch: task/T-055-e2e-transfer-overrun-on-edit
pr: https://github.com/Web-Usov/home-finances/pull/64
---

# T-055. E2E: real transfer overrun on edit

## Goal

A Playwright spec edits an existing transfer so that it really exceeds the source balance and checks the user-visible error with the available amount.

## Context

- `e2e/operations.e2e.ts`, `e2e/support/` helpers (`api.createMonth`, `api.createEnvelope`).
- Message text: MSG-03; the available amount comes from the structured field (T-053).
- Run through `pnpm e2e:full` (machine-wide lock).

## Definition of Done

- [x] `it('OP-07 / HIST-09: editing a transfer above the source balance shows the overrun error')` e2e passes (`pnpm e2e:full`)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Production code changes (T-053, T-054).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

- New untagged e2e `e2e/history-transfer-overrun.e2e.ts` (runs in `e2e:full`): a later expense reduces the source; editing the transfer above the balance at its position shows the MSG-03 text and "Перевести только 8 000,00 ₽" (the 409 `available`); pressing it saves; API check: amount equals available, ids and sequence order unchanged. Screenshots attached.
- Two T-054 review component tests added to `OperationForm.test.tsx` (archived envelope that is not the operation's own stays hidden; archived destination preselected and labelled).
- Deviation: the spec file is named by feature rather than extending `operations.e2e.ts` (that describe is `@smoke`).
