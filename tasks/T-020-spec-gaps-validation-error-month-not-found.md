---
id: T-020
title: Spec gaps from pilot reviews (error codes, working month and period on operations, reopen preview, message format)
status: done
epic: E-00
depends: []
blocked_by: []
spec: [API-17, API-18, API-19, API-20, API-21, ENV-03, ENV-14, OP-10, MON-12, MON-16, UI-16, MSG-07]
acceptance: []
area: docs
size: M
branch: task/T-020-spec-gaps-validation-error-month-not-found
pr: https://github.com/Web-Usov/home-finances/pull/12
---

# T-020. Spec gaps from pilot reviews (error codes, working month and period on operations, reopen preview, message format)

Planner task. Touches `docs/spec/**`, so the PR needs human review and is merged by the human (no auto-merge).

## Goal

Close the spec gaps collected from the T-001..T-017 reviews so code and spec agree: error codes and HTTP statuses, the error for an initial balance without a month, a reopen-preview endpoint (MON-12), an optional `period` on `POST /operations`, ru-RU amounts in messages; register the response-shape question as Q-04; file the follow-up api / tech-debt tasks.

## Context

- Original gaps: `VALIDATION_ERROR` missing from API-18 (T-001); initial balance without a month threw `MONTH_LOCKED` (T-017).
- Extended with the orchestrator's follow-up list: INVALID_STATUS_TRANSITION (T-006), unified mutation response shape (T-003, Q-04), MSG amount format (T-003), reopen preview (T-006, needed by T-009), `period` on `POST /operations` (T-004 review, needed by T-011), tech-debt items.
- T-006 hygiene note: its DoD cited MON-02 for "draft cannot be closed" (should be MON-01); it is already merged, so no edit.
- Rules added: API-19, API-20, API-21, MON-16, ENV-14, UI-16, MSG-07; modified in place: API-18, MON-12; new open question: Q-04.
- Follow-up tasks: T-023 (MONTH_NOT_FOUND), T-024 (reopen preview), T-025 (`period`), T-026 (ru-RU messages), T-027 (summary shape, blocked by Q-04), T-028 (reopen race), T-029 (version in tx), T-030 (openapi uuid keys), T-031 (int test for MON-10/11). UI tasks T-009, T-010, T-011 now depend on the matching api tasks.

## Definition of Done

- [x] API-18 lists `VALIDATION_ERROR` and `INVALID_STATUS_TRANSITION` among the key error codes (API-19 maps codes to HTTP statuses)
- [x] ENV-14 states the error for an initial balance when no month exists (`MONTH_NOT_FOUND`), rule ids kept stable
- [x] Reopen preview (API-20), `period` on `POST /operations` (API-21, MON-16, UI-16) and ru-RU message amounts (MSG-07) are specified; the response-shape question is Q-04
- [x] Follow-up api / tech-debt tasks exist on the board; UI tasks depend on the new api tasks
- [x] `pnpm spec:check`, `pnpm tasks:check` and `pnpm verify:quick` pass
- [x] PR description starts with "⚠️ Requires human review (docs/spec)" and is not auto-merged
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Code changes (they belong to the follow-up tasks).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Spec proposals and follow-up tasks are in the PR; every rule edit awaits the human's decision (see the PR body). Not decided by the planner: Q-04 (response shape). T-006 DoD wording needs no edit (already merged).
