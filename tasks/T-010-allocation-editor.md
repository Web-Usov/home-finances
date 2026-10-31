---
id: T-010
title: Mobile: allocation editor with live totals and overflow block
status: todo
epic: E-03
depends: [T-009, T-026, T-027]
blocked_by: []
spec: [UI-11, UI-12, UI-13, UI-14, UI-15, FIN-02, FIN-11, MSG-01, MSG-06, API-04, SCOPE-25]
acceptance: [AC-02, AC-03, AC-04]
area: mobile
size: M
branch: null
pr: null
---

# T-010. Mobile: allocation editor with live totals and overflow block

## Goal

The month screen has an editor for income and one amount row per active envelope, showing the total allocated and free funds permanently; saving is blocked with the exact overflow when allocation exceeds income.

## Context

- API: `PUT /api/v1/months/:period/allocations` (`AllocationsController`, done) and `PATCH /months/:period` for income (T-003). Generated hooks in `apps/mobile/src/api`.
- Shared schema `SaveAllocationsRequestSchema` in `packages/types`; forms use React Hook Form + Zod resolver (see `FormInput.tsx`).
- New month: values are prefilled by the API copy from the previous month (UI-12); the editor must show them as editable.
- Money math uses integer kopecks via `parseMoneyMinor`; no floats. Message MSG-01 verbatim with exact X.
- Response shape follows Q-04 (T-027); overflow message amounts are ru-RU formatted by the server (MSG-07, T-026).
- Handle `VERSION_CONFLICT` (reload prompt) and `MONTH_LOCKED`.

## Definition of Done

- [ ] Mobile tests: `it('UI-13: totals and free funds update while typing')`, `it('UI-14 / MSG-01 / AC-03: 100000.01 on income 100000 blocks save and shows 0,01 overflow')`, `it('UI-12 / AC-04: copied allocation is shown as editable values')`, `it('MSG-06: editor is read-only in a closed month')`
- [ ] Playwright spec `e2e/allocation-editor.e2e.ts` covering `AC-02`, `AC-03` and `AC-04`
- [ ] Screenshots of the editor (normal and overflow) attached as artifacts
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Envelope creation (exists).
- Operation forms (T-011).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
