---
id: T-020
title: Spec gaps from pilot reviews (API-18 VALIDATION_ERROR, initial balance without a month)
status: todo
epic: E-00
depends: []
blocked_by: []
spec: [API-17, API-18, ENV-03, OP-10]
acceptance: []
area: docs
size: S
branch: null
pr: null
---

# T-020. Spec gaps from pilot reviews (API-18 VALIDATION_ERROR, initial balance without a month)

Planner task. Touches `docs/spec/**`, so the PR needs human review and is merged by the human (no auto-merge).

## Goal

Close two spec gaps found while reviewing T-001 and T-017, so the code and the spec agree on error codes.

## Context

- API-17 makes `ZodValidationPipe` answer 422 with code `VALIDATION_ERROR`, but the list of key error codes in API-18 does not contain it.
- Creating an envelope with an initial balance when no month exists currently throws `MONTH_LOCKED` (`EnvelopesService.create`, see T-017 Context). ENV-03 / OP-10 do not say which error applies. Proposal: `MONTH_NOT_FOUND` (422/404 per API conventions), because there is no month to apply the initial adjustment to; `MONTH_LOCKED` means a month exists but is closed.
- Planner adds the question to `docs/spec/99-open-questions.md` if the decision is not obvious, and a follow-up api task if code must change (error code in `packages/types` already has `MONTH_NOT_FOUND`).

## Definition of Done

- [ ] API-18 lists `VALIDATION_ERROR` among the key error codes
- [ ] The spec states the error returned when an envelope with an initial balance is created while no month exists (proposal: `MONTH_NOT_FOUND`), with the rule id kept stable; if the human chooses otherwise, the decision is recorded as a `Q-NN`
- [ ] If the chosen code differs from the current behavior (`MONTH_LOCKED`), a follow-up api task exists on the board
- [ ] `pnpm spec:check` and `pnpm tasks:check` pass
- [ ] PR description says that it touches `docs/spec/**` and needs human review before merge
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Code changes (they belong to the follow-up api task).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
