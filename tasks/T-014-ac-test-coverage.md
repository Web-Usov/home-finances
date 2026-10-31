---
id: T-014
title: Acceptance: tests for AC-01..AC-22 and strict spec coverage
status: in_progress
epic: E-06
depends: [T-005, T-006, T-007, T-008]
blocked_by: []
spec: [DOD-02, DOD-03, NFR-25, NFR-26, NFR-28]
acceptance: [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-22]
area: api
size: M
branch: task/T-014-ac-test-coverage
pr: null
---

# T-014. Acceptance: tests for AC-01..AC-22 and strict spec coverage

## Goal

Every AC-* is referenced by at least one automated test (API-level acceptance suite), gaps found by `spec-check` are closed, and the engine has unit coverage of all uncovered-amount branches.

## Context

- Run `node scripts/spec-check.mjs --verbose` to list AC and rules without a test reference; AC-21 and UI parts are covered by UI tasks (T-011..T-013) and e2e (T-015).
- Add an acceptance suite `apps/api/test/acceptance/*.int-spec.ts` (or the repo's integration test location from `docs/testing.md`) with one `describe` per AC, named like `it('AC-08: ...')`.
- Do not duplicate existing lower-level tests; reference the AC in the test name where one already proves it (rename), add new tests only for gaps.
- DOD-03: check engine branch coverage for uncovered paths (expense, transfer, negative adjustment).

## Definition of Done

- [ ] `node scripts/spec-check.mjs --strict-coverage` exits 0 (all AC-* referenced from test files; UI-only AC may be referenced from mobile/e2e tests)
- [ ] Engine coverage report shows all uncovered-amount branches covered (attach summary in Result)
- [ ] At least one test is named `it('AC-22: derived data is identical after rebuilding from source')` (restart persistence at API level: recalc from sources reproduces stored results)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Browser scenarios (T-015).
- Docker restart (T-016).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
