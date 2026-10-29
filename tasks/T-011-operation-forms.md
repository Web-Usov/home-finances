---
id: T-011
title: Mobile: expense, transfer and adjustment forms
status: todo
epic: E-04
depends: [T-004, T-009]
blocked_by: []
spec: [UI-10, OP-06, OP-07, OP-12, OP-13, HIST-05, MSG-02, MSG-03, MSG-04, MSG-06, SCOPE-24, ENV-03]
acceptance: [AC-05, AC-06, AC-07, AC-09, AC-10, AC-21]
area: mobile
size: M
branch: null
pr: null
---

# T-011. Mobile: expense, transfer and adjustment forms

## Goal

Quick actions "Списать", "Перевести", "Скорректировать" open forms (month-only, no day field) that show the available balance, warn per MSG-02..MSG-04 and submit to `POST /api/v1/operations`.

## Context

- Entry points: dashboard quick actions from T-009. API: `POST /operations` from T-004 (generated hooks in `apps/mobile/src/api/operations`).
- Warnings texts verbatim from `docs/spec/60-ui.md` (MSG-02, MSG-03, MSG-04). Expense/negative adjustment above balance: allow after confirmation (OP-06, OP-12). Transfer above balance: not saved, offer to transfer the available amount (OP-07, MSG-03).
- Comment optional, max 500 chars (HIST-05, OP-13). Archived envelopes are not selectable (ENV-12).
- Form patterns: `FormInput.tsx`, React Hook Form + Zod from `@family-budget/types`.

## Definition of Done

- [ ] Mobile tests: `it('MSG-02 / OP-06: expense above balance asks confirmation and shows X and Y')`, `it('MSG-03 / OP-07 / AC-07: transfer above balance offers the available amount')`, `it('MSG-04 / OP-12: negative adjustment above balance asks confirmation')`, `it('AC-21: forms have no day field')`
- [ ] Playwright spec `e2e/operations.e2e.ts` covering `AC-05`, `AC-06`, `AC-07`, `AC-09`, `AC-10`
- [ ] Screenshots of each warning state attached as artifacts
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- History list, edit and delete (T-012).
- Envelope creation with initial balance (exists).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
