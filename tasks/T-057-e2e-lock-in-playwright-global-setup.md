---
id: T-057
title: "E2E: take the machine-wide lock inside Playwright globalSetup"
status: done
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: infra
size: S
branch: task/T-057-e2e-lock-in-playwright-global-setup
pr: https://github.com/Web-Usov/home-finances/pull/56
---

# T-057. E2E: take the machine-wide lock inside Playwright globalSetup

## Goal

A direct `playwright test` call is serialized by the same machine-wide `e2e` lock as `pnpm e2e:smoke`/`e2e:full`, so it cannot be bypassed.

## Context

- `e2e/playwright.config.ts`, `scripts/with-lock.mjs` (lock file `<tmpdir>/family-budget-e2e.lock`), `docs/testing.md` (e2e section).
- The lock must not deadlock when the process already runs under `with-lock.mjs` (re-entrancy: detect via an env var) and must be released in globalTeardown or on exit/signals.

## Definition of Done

- [x] a test in `scripts/__tests__/` shows a second invocation waits while the first holds the lock, and that nested use via `with-lock.mjs` does not deadlock
- [x] `pnpm e2e:smoke` is green; `docs/testing.md` describes the behaviour
- [x] `pnpm verify` is green
- [x] (extended) `task:start --new` allocates ids under a machine-wide `task-id` lock and pushes the claim branch before releasing it; a test with concurrent `--new` calls against a throwaway origin yields distinct ids; `docs/workflow.md` + `docs/testing.md` updated
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing lock timeouts or the stale-lock logic.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Design: lock mechanics moved from `scripts/with-lock.mjs` into `scripts/lib/lock.mjs` (`acquire`, `acquireSync`, stale takeover unchanged).
Re-entrancy through env `FAMILY_BUDGET_LOCKS_HELD` (set by the holder, inherited by children), so `with-lock e2e -- playwright test` does not
deadlock and `pnpm e2e:*` keep their outer wrapper (the preview updater still runs `with-lock.mjs` from the target sha; `update.sh` now also
fetches `scripts/lib/lock.mjs` next to it). Deviation: the Playwright config takes the lock at load time (`e2e/support/e2e-lock.mjs`), released
in `global-teardown.ts` and on exit, instead of in `globalSetup`, because Playwright starts the webServers (the heavy Expo export) before
globalSetup. Extended scope: `task:start --new` runs under lock `task-id` from `git fetch` until the claim branch is pushed to origin.
Tests: `with-lock.test.mjs` (nested no-deadlock, waiting second Playwright-style run, stale lock, exit release) and
`task-start.test.mjs` (3 concurrent `--new` against a throwaway origin give distinct ids; fails with duplicates when the lock is disabled).
`pnpm e2e:smoke`: passed on retry; one different test (analytics / history / allocation) hit its 30s timeout under heavy machine load on
each of two full runs and passed when run alone.
