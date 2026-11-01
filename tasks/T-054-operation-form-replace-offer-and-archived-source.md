---
id: T-054
title: "OperationForm: replace offer when the transfer source changed, preselect archived source"
status: in_progress
epic: E-04
depends: [T-053]
blocked_by: []
spec: [OP-07, HIST-09]
acceptance: []
area: mobile
size: M
branch: task/T-054-operation-form-replace-offer-and-archived-source
pr: null
---

# T-054. OperationForm: replace offer when the transfer source changed, preselect archived source

## Goal

When editing a transfer and the user changes its source envelope, the form offers the replace flow correctly, and an archived source envelope is preselected in edit mode instead of being dropped.

## Context

- `OperationForm` and the history edit flow in `apps/mobile` (T-011, T-012). Follow-ups from the T-011/T-012 reviews.
- Depends on T-053 (same module, structured `available`).
- Edit semantics: HIST-09 / HIST-13 (balance at the transfer own position after replay).

## Definition of Done

- [x] `it('HIST-09: changing the transfer source offers the replace flow')` mobile component test passes
- [x] `it('HIST-09: edit preselects an archived source envelope')` mobile component test passes
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- E2E for the overrun case (T-055).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

`OperationForm` in edit mode keeps the operation's own archived source/destination envelope in the pickers, preselected and flagged "(архив)" (ENV-12 still hides archived envelopes from new choices and new forms). The "Перевести только X" offer uses the 409 `available` field (T-053), so it also works after the transfer source was changed in edit mode; the stored `sourceBalanceBefore` fallback applies only to an unchanged source. Component tests added in `OperationForm.test.tsx`. No e2e (T-055).
