---
id: T-011
title: Mobile: expense, transfer and adjustment forms
status: done
epic: E-04
depends: [T-004, T-009, T-025, T-026]
blocked_by: []
spec: [UI-10, OP-06, OP-07, OP-12, OP-13, HIST-05, MSG-02, MSG-03, MSG-04, MSG-06, SCOPE-24, ENV-03]
acceptance: [AC-05, AC-06, AC-07, AC-09, AC-10, AC-21]
area: mobile
size: M
branch: task/T-011-operation-forms
pr: https://github.com/Web-Usov/home-finances/pull/35
---

# T-011. Mobile: expense, transfer and adjustment forms

## Goal

Quick actions "Списать", "Перевести", "Скорректировать" open forms (month-only, no day field) that show the available balance, warn per MSG-02..MSG-04 and submit to `POST /api/v1/operations`.

## Context

- Entry points: dashboard quick actions from T-009. API: `POST /operations` from T-004 (generated hooks in `apps/mobile/src/api/operations`).
- Operations are created for the month shown on screen: always send `period` and that month's `version` (API-21, UI-16, T-025), so reopened months and drafts work; message amounts are ru-RU (MSG-07, T-026).
- Warnings texts verbatim from `docs/spec/60-ui.md` (MSG-02, MSG-03, MSG-04). Expense/negative adjustment above balance: allow after confirmation (OP-06, OP-12). Transfer above balance: not saved, offer to transfer the available amount (OP-07, MSG-03).
- Comment optional, max 500 chars (HIST-05, OP-13). Archived envelopes are not selectable (ENV-12).
- Form patterns: `FormInput.tsx`, React Hook Form + Zod from `@family-budget/types`.

## Definition of Done

- [x] Mobile tests: `it('MSG-02 / OP-06: expense above balance asks confirmation and shows X and Y')`, `it('MSG-03 / OP-07 / AC-07: transfer above balance offers the available amount')`, `it('MSG-04 / OP-12: negative adjustment above balance asks confirmation')`, `it('AC-21: forms have no day field')`
- [x] Playwright spec `e2e/operations.e2e.ts` covering `AC-05`, `AC-06`, `AC-07`, `AC-09`, `AC-10`
- [x] Screenshots of each warning state attached as artifacts
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- History list, edit and delete (T-012).
- Envelope creation with initial balance (exists).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

PR: see `pr:` in the front matter.

What changed (mobile only, no API change):

- `OperationForm.tsx` (expense / transfer / adjustment ±), `QuickActionsPanel.tsx` (state: open form + result notice), `useCreateOperation.ts`.
  `MonthDashboard.tsx` changes by one line (`QuickActions` -> `QuickActionsPanel key={period}`) to keep T-037 merges easy.
- Every request carries `period` + that month's `version` (UI-16, API-21). Archived envelopes are not offered (ENV-12). Amount input is ru-RU
  (both separators); the comment is optional and omitted when empty; there is no day field (AC-21; the entry is removed from `scripts/spec-coverage-deferred.json`).
- Expense / negative adjustment above the `closing` balance returned by the dashboard: a warning is shown and the save button becomes
  "Всё равно сохранить" (OP-06, OP-12). The uncovered part Y is NOT computed on the client: it is shown after the save from the API warning (MSG-02 / MSG-04 texts, ru-RU since T-026).
- Transfer above the available amount: the API answers 409 `TRANSFER_EXCEEDS_BALANCE` (shown verbatim); the form then offers "Перевести только X", which retries with
  the source envelope's `closing` from the dashboard (OP-07, MSG-03, AC-07). Closed month: form disabled with MSG-06.
- After a request settles the dashboard, months, envelopes and operations queries are invalidated.

Tests: `OperationForm.test.tsx` (16 cases), `e2e/operations.e2e.ts` (5 @smoke tests: AC-05, AC-06, AC-07, AC-09, AC-10, AC-21, UI-16 draft month, MSG-06 closed); screenshots are attached to the Playwright report (`e2e/playwright-report`, CI artifact `playwright-report`).

Deviations: the warning shown BEFORE saving is "В конверте доступно X ₽. Остальная часть будет отмечена как непокрытая." (not the verbatim MSG-02/MSG-04 with Y),
because Y would need client-side balance arithmetic; the verbatim MSG-02/MSG-04 text with Y is shown after the save from the API response. The transfer-refusal text is the API message.
