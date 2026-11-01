---
id: T-015
title: E2E: full Playwright scenarios for the MVP flows
status: in_progress
epic: E-06
depends: [T-010, T-012, T-013]
blocked_by: []
spec: [NFR-27, DOD-02, SCOPE-23, SCOPE-24, SCOPE-25, SCOPE-26, SCOPE-27, SCOPE-28, SCOPE-29, SCOPE-30, SCOPE-31, SCOPE-32, SCOPE-33, SCOPE-34]
acceptance: [AC-01, AC-04, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-21]
area: mobile
size: M
branch: task/T-015-e2e-full-scenarios
pr: null
---

# T-015. E2E: full Playwright scenarios for the MVP flows

## Goal

The `e2e:full` suite runs the MVP user journeys against API + Expo web on the test DB: first launch, regular month, draft, close with auto-promotion, correcting the past, archiving an envelope; screenshots of key steps are kept as artifacts for milestone acceptance.

## Context

- Playwright workspace `e2e/` (see `docs/testing.md`, ADR 0007). Smoke spec already exists; scenarios from earlier UI tasks live in `e2e/*.e2e.ts` — consolidate, do not duplicate.
- Journeys follow NFR-27 and SCOPE-23..SCOPE-34; AC coverage must be named in test titles (`AC-17: ...`).
- Each test resets the DB through the helper from the e2e setup; tests are order-independent.
- Screenshots saved at named steps (`page.screenshot({ path })` or `toHaveScreenshot` disabled for visual diffs) and uploaded by CI as `playwright-report`.

## Definition of Done

- [x] `pnpm e2e:full` is green locally
- [x] Tests exist and cite rule IDs: `AC-01` first launch, `AC-16`/`AC-17` draft and auto-promotion, `AC-14`/`AC-15` lock and reopen, `AC-18` archive blocked with non-zero balance then allowed at zero, `AC-19` transfer on dashboard, `AC-21` no day field
- [x] Key-step screenshots are produced as artifacts and listed in the Result section
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Visual regression baselines.
- Cross-browser matrix (Chromium only).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Journey specs live in `e2e/journeys/` (untagged: run by `e2e:full`; the existing `@smoke` specs are unchanged and are not duplicated). Shared helpers: `e2e/support/ui.ts`.

| Journey | Rules |
| --- | --- |
| `first-launch` | AC-01, SCOPE-23..SCOPE-27 |
| `regular-month` | AC-19, SCOPE-28 |
| `draft-and-close` | AC-16, AC-17, SCOPE-29, SCOPE-30 |
| `correct-the-past` | AC-14, AC-15, SCOPE-31..SCOPE-34 |
| `archive-envelope` | AC-18 |
| `no-day-field` (2 tests) | AC-21 |
| `year-analytics` | AC-20 |

Named step screenshots (`testInfo.attach`, Playwright report): first-launch `01-first-launch-empty`, `02-first-month-created`, `03-envelopes-with-balances`, `04-first-dashboard`; regular-month `01-month-start`, `02-after-expense`, `03-after-transfer`, `04-after-adjustment`; draft-and-close `01-draft-with-expense`, `02-january-closed`, `03-february-open`; correct-the-past `01-reopen-preview`, `02-january-corrected`, `03-february-recalculated`; archive-envelope `01-archive-blocked`, `02-archived-at-zero`, `03-archived-in-analytics`; no-day-field `01-expense-form-month-only`, `02-history-edit-form-month-only`; year-analytics `01-year-income-report`, `02-year-uncovered-report`.

Verified: `pnpm e2e:full` 24 passed (~4 min), `pnpm e2e:smoke` 14 passed, `pnpm verify` green. Dates are pinned to 2026; every test resets the DB through the `api` fixture.

Finding / follow-up: creating envelopes on the Envelopes tab does not refresh the cached month dashboard, so the allocation editor lacks them until reload. The first-launch journey reloads as a workaround; filed as T-048 (todo).

