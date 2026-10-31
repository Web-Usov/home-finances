---
id: T-038
title: "Preview environment: auto-deploy master for the owner"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-06            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-038-preview-environment-auto-deploy-master          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-038. Preview environment: auto-deploy master for the owner

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

A persistent preview of the app on the dev host for the owner, auto-updated after every merge to `master`
(web on port 8100, API on 127.0.0.1:3100, DB `family_budget_preview`), with demo data and systemd units.

## Context

- `docs/preview.md` (new), `scripts/preview/*` (updater, web server + `/api` proxy, systemd templates, demo seed).
- Client same-origin mode: `apps/mobile/src/lib/apiBaseUrl.ts` + `axios-instance.ts`; e2e/dev defaults unchanged.
- Machine-wide lock `scripts/with-lock.mjs` (name `e2e`) is reused so builds do not collide with e2e runs.

## Definition of Done

- [x] `apps/mobile/src/lib/apiBaseUrl.test.ts` covers default, explicit origin and `same-origin` / `/` modes
- [x] `scripts/__tests__/preview-serve-web.test.mjs`: SPA fallback, `/version.json`, `/api` proxy, traversal guard
- [x] `scripts/preview/update.sh` swaps a blue/green slot atomically; a failed build keeps the old release (verified on the host)
- [x] systemd units installed and running on the host; first deploy and demo seed done; endpoints verified with curl
- [x] `docs/preview.md` linked from `AGENTS.md` and `docs/README.md`
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Things that belong to other tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->

Preview runs on the dev host (see `docs/preview.md`): web `:8100`, API `127.0.0.1:3100`, DB `family_budget_preview`, systemd
units + 2-minute timer, blue/green slots under `/root/workspace/finance-preview`. Verified on the host: first deploy, demo seed,
update swap a -> b, failed build (type error) keeps the old release serving.

Deviations / notes:
- `API_HOST` env added to `apps/api/src/main.ts` (default `0.0.0.0`) so the preview API binds to loopback.
- Until this PR is merged the host's `preview.env` has `PREVIEW_REF=origin/task/T-038-...` (master has no preview scripts yet);
  remove that line after the merge so the updater follows `origin/master`.
- Migrations are forward-only; a rolled-back release runs against the migrated DB.

