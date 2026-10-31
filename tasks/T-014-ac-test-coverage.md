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

- [x] `node scripts/spec-check.mjs --strict-coverage` exits 0 (all AC-* referenced from test files; UI-only AC may be referenced from mobile/e2e tests) — AC-21 is allowlisted in `scripts/spec-coverage-deferred.json` until the UI forms exist
- [x] Engine coverage report shows all uncovered-amount branches covered (attach summary in Result)
- [x] At least one test is named `it('AC-22: derived data is identical after rebuilding from source')` (restart persistence at API level: recalc from sources reproduces stored results)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Browser scenarios (T-015).
- Docker restart (T-016).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

PR: see `pr:` in the front matter.

- New `apps/api/src/acceptance/acceptance.mvp-scenarios.int-spec.ts` (HTTP + real DB + real engine) for the ACs with no end-to-end test: AC-01, AC-03 (allocation 100000.01 on income 100000, excess 0.01), AC-04, AC-14 (all seven mutation kinds, not just income/allocations), AC-18, AC-22 (restart on a fresh app instance, then `recalculateFrom` rebuild; compared apart from surrogate ids/timestamps).
- Already covered, unchanged: AC-02, 05, 06, 07, 08, 09, 10, 11, 12, 13, 15, 16, 17, 19, 20 (existing tests cite the id and assert the example numbers).
- Deferred: AC-21 (no day field in forms) is UI-only; `scripts/spec-coverage-deferred.json` lists it with task T-011 (forms) / T-015 (e2e). `spec-check --strict-coverage` accepts only allowlisted gaps and fails on stale/unknown/incomplete entries (tests in `scripts/__tests__/spec-check.test.mjs`). Not wired into `pnpm verify` (DoD asks only for exit 0); suggest adding it once AC-21 lands and the allowlist is empty.
- Engine coverage (`calculation-engine.service.ts`, unit tests only): statements 92.15 %, branches 87.3 %, functions 88.2 %. Every uncovered-amount branch of `applyOperation` (expense, transfer, negative adjustment) is covered by unit tests; the remaining uncovered lines are `recalculateMonthAtomically` (covered by the integration tests), a defensive throw for a transfer without destination and the skip of untouched envelopes.
- No product defects found.
