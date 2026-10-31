---
id: T-039
title: "Preview: keep API up (Restart=always, health watchdog)"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-06            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-039-preview-keep-api-up-restart-always          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-039. Preview: keep API up (Restart=always, health watchdog)

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

The preview API/web survive clean exits, stray SIGTERMs and OOM pressure: systemd always restarts them and a watchdog restarts an unhealthy API.

## Context

- Incident 2026-10-31 22:15: `family-budget-preview-api` exited cleanly (`Deactivated successfully`, no signal/OOM line in the journal), `Restart=on-failure` did not restart it, `/api` gave 502.
- Files: `scripts/preview/systemd/*`, `scripts/preview/watchdog.sh`, `scripts/preview/install-systemd.sh`, `docs/preview.md`.

## Definition of Done

- [x] API and web units: `Restart=always`, `RestartSec=3`, start limit, `OOMScoreAdjust` -200; update unit +500
- [x] Watchdog timer (1 min): 2 consecutive failed health checks restart the API; covered by `scripts/__tests__/preview-watchdog.test.mjs`
- [x] Repo has no use of port 3100 by tests/scripts; docs state 3100/8100 are reserved
- [x] Units re-installed on the host; SIGTERM of the API recovers in seconds; health via 8100 OK
- [x] `docs/preview.md` has availability + 502 troubleshooting sections
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing app code (`apps/`).

## Handoff log

## Result

Root cause: the API got a clean stop at 22:15:06 (systemd counts SIGTERM/exit 0 as success), `Restart=on-failure` ignored it. The sender is not identifiable from the journal; the repo has no kill-by-port code (e2e uses OS-assigned free ports, `reuseExistingServer: false`), so a manual or agent `kill` on port 3100 is the likely cause. Fixed by `Restart=always`, the watchdog, OOM score tuning and documenting the reserved ports.
