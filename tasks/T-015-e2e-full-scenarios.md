---
id: T-015
title: E2E: full Playwright scenarios for the MVP flows
status: todo
epic: E-06
depends: [T-010, T-012, T-013]
blocked_by: []
spec: [NFR-27, DOD-02, SCOPE-23, SCOPE-24, SCOPE-25, SCOPE-26, SCOPE-27, SCOPE-28, SCOPE-29, SCOPE-30, SCOPE-31, SCOPE-32, SCOPE-33, SCOPE-34]
acceptance: [AC-01, AC-04, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-21]
area: mobile
size: M
branch: null
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

- [ ] `pnpm e2e:full` is green locally
- [ ] Tests exist and cite rule IDs: `AC-01` first launch, `AC-16`/`AC-17` draft and auto-promotion, `AC-14`/`AC-15` lock and reopen, `AC-18` archive blocked with non-zero balance then allowed at zero, `AC-19` transfer on dashboard, `AC-21` no day field
- [ ] Key-step screenshots are produced as artifacts and listed in the Result section
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Visual regression baselines.
- Cross-browser matrix (Chromium only).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
