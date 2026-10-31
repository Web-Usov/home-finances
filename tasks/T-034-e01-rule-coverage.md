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

- [ ] Each of the 13 rules is cited by a test that asserts it
- [ ] `pnpm spec:check` shows every rule of `epics/E-01-*.md` referenced from tests
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Behaviour changes beyond small defect fixes; spec changes.

## Handoff log

## Result

