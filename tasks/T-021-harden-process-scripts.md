---
id: T-021
title: Harden process scripts (with-lock, task-start, task-clean)
status: in_progress
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: infra
size: S
branch: task/T-021-harden-process-scripts
pr: null
---

# T-021. Harden process scripts (with-lock, task-start, task-clean)

## Goal

Fix the reviewer findings of PR #5 (T-018) in the process scripts, cover them with `node --test` tests, and let `task:start` create and claim a new task in one step.

## Context

- `scripts/with-lock.mjs`, `scripts/task-start.mjs`, `scripts/task-clean.mjs`, `scripts/verify.mjs`, `docs/workflow.md`, `docs/testing.md`.
- Must not touch `docs/spec/**`, `docs/decisions/**`, `epics/**` (human-merge paths).

## Definition of Done

- [x] with-lock: stale-lock takeover is race-free (atomic rename of the stale lock); test with two concurrent waiters
- [x] with-lock: the command is spawned without a shell (argv preserved, exit code propagated); test `sh -c 'exit 7'` returns 7
- [x] with-lock: SIGINT/SIGTERM is forwarded to the child process group, the lock is released after the child exits; test: grandchild is gone
- [x] with-lock: an empty/unparsable lock file older than ~10s is stale; test
- [x] task-clean: refuses `git branch -D` when the local branch has commits that are neither the PR head nor in origin/master; pure decision function unit-tested
- [x] task-start: rolls back the worktree and branch on failure unless `--keep`; `--new "<title>" --epic E-xx --area <a> --size <S|M>` creates and claims a task; tested
- [x] `pnpm test:scripts` runs `scripts/__tests__/*.test.mjs` with `node --test` and is part of `verify:quick` and `verify`
- [x] `docs/workflow.md` and `docs/testing.md` describe the changes
- [x] `pnpm verify` and `pnpm e2e:smoke` are green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changes to `docs/spec/**`, `docs/decisions/**`, `epics/**`.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Fixes the PR #5 reviewer findings; 21 `node --test` tests (`pnpm test:scripts`, now a step of `verify:quick` and `verify`).

- `with-lock`: stale takeover by atomic rename of the stale file (single winner, content re-verified, live lock restored if
  grabbed by mistake), create only via `wx`; empty/unparsable lock older than 10s is stale; command spawned without a shell in
  its own process group; SIGINT/SIGTERM/SIGHUP forwarded to the group, lock released after the child exits, exit 128+signal;
  missing command exits 127. `package.json` scripts (`e2e:smoke`/`e2e:full`) need no change.
- `task-clean`: `decideClean` refuses unless the PR is MERGED and local HEAD == `headRefOid` or the branch is in origin/master;
  otherwise lists the unpushed commits.
- `task-start`: rollback of worktree + branch on failure (`--keep` to retain); new `--new "<title>" --epic --area --size`
  (next free id from origin/master files and task branches, file from the template, claimed in one commit).
- Docs: `docs/workflow.md` (rollback, `--new`, clean safety, follow-up rule), `docs/testing.md`, `AGENTS.md`.
- Known limit: if a waiter renames a freshly created live lock by mistake and a third process creates the lock in the
  microseconds before it is restored, the restore is skipped (two holders possible); needs three-way timing on a lock that was just
  taken over.
