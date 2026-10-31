---
id: T-010
title: Mobile: allocation editor with live totals and overflow block
status: done
epic: E-03
depends: [T-009]
blocked_by: []
spec: [UI-11, UI-12, UI-13, UI-14, UI-15, FIN-02, FIN-11, MSG-01, MSG-06, API-04, SCOPE-25]
acceptance: [AC-02, AC-03, AC-04]
area: mobile
size: M
branch: task/T-010-allocation-editor
pr: https://github.com/Web-Usov/home-finances/pull/24
---

# T-010. Mobile: allocation editor with live totals and overflow block

## Goal

The month screen has an editor for income and one amount row per active envelope, showing the total allocated and free funds permanently; saving is blocked with the exact overflow when allocation exceeds income.

## Context

- API: `PUT /api/v1/months/:period/allocations` (`AllocationsController`, done) and `PATCH /months/:period` for income (T-003). Generated hooks in `apps/mobile/src/api`.
- Shared schema `SaveAllocationsRequestSchema` in `packages/types`; forms use React Hook Form + Zod resolver (see `FormInput.tsx`).
- New month: values are prefilled by the API copy from the previous month (UI-12); the editor must show them as editable.
- Money math uses integer kopecks via `parseMoneyMinor`; no floats. Message MSG-01 verbatim with exact X.
- Handle `VERSION_CONFLICT` (reload prompt) and `MONTH_LOCKED`.

## Definition of Done

- [x] Mobile tests: `it('UI-13: totals and free funds update while typing')`, `it('UI-14 / MSG-01 / AC-03: 100000.01 on income 100000 blocks save and shows 0,01 overflow')`, `it('UI-12 / AC-04: copied allocation is shown as editable values')`, `it('MSG-06: editor is read-only in a closed month')`
- [x] Playwright spec `e2e/allocation-editor.e2e.ts` covering `AC-02`, `AC-03` and `AC-04`
- [x] Screenshots of the editor (normal and overflow) attached as artifacts
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Envelope creation (exists).
- Operation forms (T-011).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Added `AllocationEditor` (opened from the month dashboard via "Изменить распределение"), `lib/allocation.ts` (live totals via
integer kopecks), `useSaveAllocations`. E2E: `e2e/allocation-editor.e2e.ts` (@smoke), screenshots attached to the Playwright report.

- Initial values come from the dashboard (`envelopes[].replenished` = stored allocation snapshot); there is no GET allocations endpoint.
- The editor includes the income field (UI-11). When it changed, PATCH income and PUT allocations are sent in the safe order
  (income first when raised, after the allocations when lowered), re-reading the month version from the dashboard in between,
  because the mutation response shape is not relied upon (pending unified-response question).
- A new draft month has income 0 but copied allocations; the editor shows that as an overflow until the income is entered.
