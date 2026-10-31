---
id: T-027
title: Unify month mutation response shape (data.summary)
status: todo
epic: E-01
depends: [T-020, T-029]
blocked_by: [Q-04]
spec: [API-03, API-04, API-10, API-16]
acceptance: [AC-02]
area: api
size: M
branch: null
pr: null
---

# T-027. Unify month mutation response shape (data.summary)

## Goal

Implement the decision of Q-04 (recommended: every month-scoped mutation returns `data.summary: MonthSummary`; envelope balances come from `GET /dashboard/monthly`).

## Context

- BLOCKED until the human decides Q-04 (docs/spec/99-open-questions.md); the planner then adds the API rule and rewrites this task if the decision differs from the recommendation.
- Affected: `PATCH /months/:period` (`MonthSummary` today), `PUT /months/:period/allocations` (full summary with envelope snapshots today), `POST /operations` (already `summary`).
- Regenerate the Orval client; breaking for mobile callers: T-010 depends on this task.

## Definition of Done

- [ ] `it('API-16 / Q-04: PATCH months, PUT allocations and POST operations return data.summary of the same schema')` passes
- [ ] Existing int-specs and e2e helpers are updated to the new shape
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Mobile screens (T-009, T-010).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
