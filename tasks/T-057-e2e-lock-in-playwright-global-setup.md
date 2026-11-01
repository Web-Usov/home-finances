---
id: T-057
title: "E2E: take the machine-wide lock inside Playwright globalSetup"
status: todo
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: infra
size: S
branch: null
pr: null
---

# T-057. E2E: take the machine-wide lock inside Playwright globalSetup

## Goal

A direct `playwright test` call is serialized by the same machine-wide `e2e` lock as `pnpm e2e:smoke`/`e2e:full`, so it cannot be bypassed.

## Context

- `e2e/playwright.config.ts`, `scripts/with-lock.mjs` (lock file `<tmpdir>/family-budget-e2e.lock`), `docs/testing.md` (e2e section).
- The lock must not deadlock when the process already runs under `with-lock.mjs` (re-entrancy: detect via an env var) and must be released in globalTeardown or on exit/signals.

## Definition of Done

- [ ] a test in `scripts/__tests__/` shows a second invocation waits while the first holds the lock, and that nested use via `with-lock.mjs` does not deadlock
- [ ] `pnpm e2e:smoke` is green; `docs/testing.md` describes the behaviour
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing lock timeouts or the stale-lock logic.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
