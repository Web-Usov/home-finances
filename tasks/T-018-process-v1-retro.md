---
id: T-018
title: "Process v1: apply pilot retro"
status: in_progress
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: infra
size: M
branch: task/T-018-process-v1-retro
pr: null
---

# T-018. Process v1: apply pilot retro

## Goal

Apply the lessons of the T-001 / T-017 pilot to the agent workflow: less manual ceremony, fewer review/CI round trips, no resource contention between parallel agents.

## Context

- `docs/workflow.md`, `docs/testing.md`, `AGENTS.md`, `apps/api/AGENTS.md`, `docs/architecture.md`.
- `.opencode/commands/*`, `.opencode/agents/*`, `tasks/_template.md`, `.github/pull_request_template.md`.
- `scripts/tasks.mjs`, `scripts/check-commit-msg.mjs`, `scripts/verify.mjs`, `lefthook.yml`, `e2e/playwright.config.ts`.
- Must not touch `docs/spec/**`, `docs/decisions/**`, `epics/**` (human-merge paths).

## Definition of Done

- [x] `pnpm task:start T-xxx` validates readiness, creates worktree + branch, copies `.env`/`.env.test`, installs, claims and commits; `pnpm task:clean T-xxx` removes worktree and branch only after the PR is merged; `/next` and `workflow.md` use them
- [x] `/ship` flow simplified: verify → DoD ticked + Result → push → `gh pr create` → one commit `status: done` + `pr` + board → push; `review` status stays valid but optional; PR template item updated; wait ~30s before `gh pr checks --watch`; reviewer wording "merged or auto-merge enabled" based on `gh pr view --json state,autoMergeRequest`
- [x] `tasks:check` fails a `done` task with unchecked `- [ ]` in Definition of Done or an empty Result (HTML comments ignored)
- [x] `check-commit-msg.mjs` prints the specific failure reason plus format and example; 100-char limit and "pre-commit checks the working tree" documented; pre-commit output is quiet on success
- [x] `pnpm e2e:smoke` / `e2e:full` take a machine-wide lock (waits with a message, detects stale locks); documented in `testing.md`; parallel-work limits (max 2 implementers, no same-module tasks) documented in `workflow.md`
- [x] `testing.md`: feature-based int-spec naming, `apps/api/test/http.ts` `createTestApp(modules)`, distinct-`tx` unit-test pattern, assert BudgetMonth `version` bump on cascades; `tasks/_template.md` has the version-bump DoD line for api tasks
- [x] `AGENTS.md` / `apps/api/AGENTS.md`: no prettier, root `pnpm typecheck` after editing `packages/types`, shared turbo cache note; envelopes row and `architecture.md` mutation pattern mention initial balance recalculation in the same transaction
- [x] Reviewer role + `/review`: `gh pr review --comment --body-file`, `/tmp` temp files allowed, `git show|ls-tree|grep|fetch` allowed, reading PR files via `git show origin/<head>:<path>`, new checklist items
- [x] Follow-up task files created and on the board (unused class-validator deps; spec gaps API-18 / MONTH_NOT_FOUND)
- [x] `pnpm verify` is green and `pnpm e2e:smoke` is green (lock exercised)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Any change to `docs/spec/**`, `docs/decisions/**`, `epics/**`.
- Changing branch protection or CI workflows.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Applied the pilot retro (items 1-9 of the request); `pnpm verify` and `pnpm e2e:smoke` green.

- `task:start` (`scripts/task-start.mjs`) validates readiness against `origin/master`, creates worktree/branch, copies env files (`.env.test` falls back to the example), installs, claims and commits; `task:clean` refuses unless `gh pr view` says MERGED (`--remote` also deletes the remote branch). Happy path of `task:start` verified in a sandbox clone; `task:clean` only its refusal paths (no merged PR existed to clean). `/next`, workflow, AGENTS updated.
- Ship flow simplified (no `review` commit; `review` stays valid but optional), PR template item, 30s wait before `gh pr checks --watch`, reviewer reports merged / auto-merge enabled.
- `tasks:check` enforces done = no unchecked DoD items + non-empty Result (HTML comments ignored); `tasks.mjs` now exports `parseFrontmatter` and only runs its CLI when executed directly.
- `check-commit-msg.mjs` prints the specific reason; pre-commit is quiet (`verify.mjs quick` captures step output, prints only failures; `VERIFY_VERBOSE=1`; lefthook `output: [failure, summary]`). Implemented in verify.mjs rather than turbo `--output-logs` since capturing also silences pnpm/jest noise.
- e2e lock: `scripts/with-lock.mjs` (tmpdir lockfile, pid, stale takeover, 30s wait messages, RAM warning); `e2e:smoke`/`e2e:full` go through it (`*:run` scripts hold the old commands). Exercised: a second waiter blocked during a real smoke run.
- `apps/api/test/http.ts` `createTestApp(modules)`; `envelopes.int-spec.ts` refactored to use it. testing.md: naming, helper, distinct-`tx` pattern, version-bump assertion; template DoD line.
- AGENTS.md / apps/api/AGENTS.md / architecture.md / reviewer role and `/review` updated as requested. Reviewer `/tmp/*` edit allow rule relies on the permission model honoring last-match-wins like the planner's rules.
- Follow-up tasks created: T-019 (remove class-validator/class-transformer), T-020 (planner: spec gaps; touches `docs/spec`, needs human merge).
- Not done: the existing envelopes http unit tests were not changed to the distinct-`tx` pattern (out of scope, pattern documented only).
