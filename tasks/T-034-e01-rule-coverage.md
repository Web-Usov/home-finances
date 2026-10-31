---
id: T-034
title: "E-01: tests citing every epic rule"
status: in_progress
epic: E-01
depends: []
blocked_by: []
spec: [MON-02, MON-05, MON-06, MON-07, OP-04, OP-09, OP-11, OP-13, OP-15, OP-16, FIN-05, FIN-06, API-18]
acceptance: []
area: api
size: M
branch: task/T-034-e01-rule-coverage
pr: null
---

# T-034. E-01: tests citing every epic rule

## Goal

The E-01 milestone report found 13 epic rules with no test referencing them. Every one of them is asserted by a test that
cites its ID (existing test renamed only if it truly asserts the rule, otherwise a new test).

## Context

- Rules: MON-02, MON-05, MON-06, MON-07, OP-04, OP-09, OP-11, OP-13, OP-15, OP-16, FIN-05, FIN-06, API-18 (`docs/spec/`).
- Tests under `apps/api/src/modules/{months,operations}/`; use `createTestApp` for HTTP + DB, the real engine for formulas.
- A defect found by a new test is fixed minimally if small and in E-01 scope; otherwise `it.todo` plus a note in Result.

## Definition of Done

- [x] Each of the 13 rules is cited by a test that asserts it
- [x] `pnpm spec:check` shows every rule of `epics/E-01-*.md` referenced from tests
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Behaviour changes beyond small defect fixes; spec changes.

## Handoff log

## Result

Added `months.create-rules.int-spec.ts` (MON-02, 05, 06, 07), `operations.balance-rules.int-spec.ts` (OP-04, 09, 11, 13, 15, 16,
FIN-06) and `months.error-codes.int-spec.ts` (API-18: ALLOCATION_EXCEEDS_INCOME 422; MONTH_LOCKED, TRANSFER_EXCEEDS_BALANCE,
ENVELOPE_NOT_EMPTY, VERSION_CONFLICT 409, each typed against `ApiErrorCode`). Existing tests renamed because they already assert the
rule: FIN-05 (AC-12 edit keeps sequence_no) and FIN-06 (AC-13 delete recalculates the later month). No defect found, no production code changed.

`pnpm spec:check --verbose` after the change (none of the 50 rules of `epics/E-01-*.md` is in the "not referenced" list):

```
prefix   rules  referenced  covered-by-tests
API         18          15                12
FIN         14          11                 7
HIST        12          11                 7
MON         15          15                15
OP          18          18                18
CALC        14          11                 3
```

Note: the uncovered API/FIN/CALC/HIST rules are outside E-01's `spec:` list (e.g. API-01, API-02, API-04, API-07..09).

