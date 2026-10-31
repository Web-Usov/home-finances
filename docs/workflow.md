# Workflow: from task to merged PR

Audience: agents (and the human orchestrating them). Language: English.
Rules in short: **one task = one session = one branch = one git worktree = one PR**. A session never ends with
uncommitted changes. Merging happens only through a PR whose required checks (`verify`, `contract`, `e2e`) are green.

Roles (OpenCode agents in `.opencode/agents/`): `implementer`, `reviewer`, `planner`, `qa`. Slash commands in
`.opencode/commands/`: `/next`, `/verify`, `/handoff`, `/ship`, `/review`, `/status`, `/milestone`.

## 1. Pick a task

```bash
pnpm tasks:next                      # todo tasks whose depends are done and blocked_by is empty
```

Choose one. The status change happens inside the task's own worktree (section 2) so that it travels with the branch.

- Take exactly one task. Do not pick a task that touches the same module as an `in_progress` task of another session
  (see "Parallel work").
- Read the task file fully, then the spec files holding its `spec:` rule IDs (`docs/spec/`, grep the ID), the ADRs it
  names and `docs/architecture.md`. Rules are cited by ID, never by line number.
- `/next T-xxx` (= `pnpm task:start T-xxx`) does the status change and the worktree and prints the task.

## 2. Isolate: worktree per task

One command, run from the main checkout (branch names use the task template convention `task/T-xxx-slug`; the directory
is the lowercase id + slug):

```bash
pnpm task:start T-xxx
```

It validates that the task is ready (`todo`, `depends` done, `blocked_by` empty, read from `origin/master`), runs
`git fetch`, creates `../finance-wt/t-xxx-slug` on `task/T-xxx-slug` from `origin/master` (the absolute path is printed),
copies `apps/api/.env` from the main checkout, creates `apps/api/.env.test` from the main checkout's file or else from
`apps/api/.env.test.example`, runs `pnpm install --frozen-lockfile --prefer-offline` (no timeout: under load it can take minutes, so do not wrap `task:start` in a short timeout), sets `in_progress` + `branch`, regenerates the board and
makes the claim commit `chore(tasks): start T-xxx [T-xxx]` as the first commit of the branch (so `master` never carries
in-progress noise). `.env` files are git-ignored and never committed. Continue in the printed directory.

Claims are therefore visible on `master` only after merge; the orchestrator avoids double assignment by giving each
session an explicit task id (and by running `gh pr list` / `git branch -r` before picking).

If any step fails after the worktree was created (install, env, commit), the script rolls back: it removes the worktree
and the branch and says so, so a retry starts clean (just run the same command again). `--keep` leaves them in place and prints how to resume
or discard them.

### Filing new work: `--new`

Follow-up work discovered during implementation or review is filed as its own task, not smuggled into the current PR:

```bash
pnpm task:start --new "Short imperative title" --epic E-00 --area infra --size S
```

It creates `tasks/T-NNN-slug.md` from `tasks/_template.md` (next free id: highest id among task files on `origin/master`, task files in any
local/remote ref (unmerged PRs) and task branch names, plus one; the epic must exist on `origin/master`), then claims it exactly like a normal task, in a worktree of
its own, with the task file as the first commit (`chore(tasks): add and start T-NNN [T-NNN]`). Fill in Goal / Context / DoD there.
Alternatives: add the task as `status: todo` in the current PR (the task file is part of the diff), or, if it needs a planner
decision, propose it in `## Result` as before. Do not start a second task inside the current session unless it blocks the
current one.

Cleanup after the PR is merged (from the main checkout):

```bash
pnpm task:clean T-xxx            # removes worktree + local branch; refuses unless `gh pr view` says MERGED
pnpm task:clean T-xxx --remote   # also deletes origin/task/T-xxx-slug (skip if GitHub deletes merged branches)
```

`task:clean` also refuses to delete the local branch when it would lose work: the branch HEAD must equal the PR's
`headRefOid` or be fully contained in `origin/master`; otherwise it lists the commits that were never pushed.

Manual equivalent (if the scripts are unavailable): `git worktree add ../finance-wt/t-xxx-slug -b task/T-xxx-slug origin/master`,
copy the env files, `pnpm install --frozen-lockfile`, `node scripts/tasks.mjs set T-xxx in_progress --branch task/T-xxx-slug`,
`pnpm tasks:board`, commit.

## 3. Implement

- Tests first where practical: write the DoD tests named in the task, see them fail, then implement.
- Test names cite rule IDs (`it('OP-05 / AC-06: ...')`) and must actually assert the rule, not just run the code.
  `pnpm spec:check` reports rule coverage and dangling IDs.
- Respect the hard invariants in `AGENTS.md` (kopecks, `@family-budget/types`, logic only in services/engine, ...).
- UI tasks add Playwright specs under `e2e/` and attach screenshots (Playwright report artifact in CI).
- Stay in scope. Anything in "Out of scope" or discovered extra work becomes a note in the task `Result`, a proposed
  follow-up task, or a handoff entry — not part of this PR.
- Commit small and often. Commit format: `type(scope): subject [T-xxx]` (English; `type` is one of
  feat, fix, refactor, test, docs, chore, ci, build, perf; the **whole header is at most 100 characters**, the task suffix
  included). The commit-msg hook prints the exact reason when it rejects a message (e.g. `header is 112 chars, max 100`)
  together with the expected format and an example.
- The pre-commit hook runs `pnpm verify:quick` on the **working tree**, not on the index: stage everything you commit
  (`git add -A`), otherwise it checks code that is not in the commit and may miss or invent failures. It is quiet on
  success and prints the output of the failing step only (`VERIFY_VERBOSE=1` shows everything).
- Run `pnpm verify:quick` while working, `pnpm test:unit` / `pnpm test:int` for focused runs. Integration tests use a
  schema per jest worker, so parallel runs by several agents do not collide.
- Never edit generated API client code by hand: change the API, then `pnpm api:generate`; `pnpm api:contract` fails on drift.

## 4. Never end a session with uncommitted changes

Either ship (section 5) or hand off (`/handoff`):

1. `git add -A && git commit -m "wip(scope): what is done [T-xxx]"` (WIP commits are allowed on task branches; they are
   squashed on merge).
2. `git push -u origin task/T-xxx-slug`.
3. Append an entry to the task's `## Handoff log`: date, done, next steps, branch + commit SHA, gotchas (failing tests,
   decisions taken, files to look at). Commit and push that too.

The next session starts from the task file and its Handoff log, in the same worktree (or recreates it with
`git worktree add ../finance-wt/t-xxx-slug task/T-xxx-slug`).

## 5. Ship

Order (`/ship` automates this):

1. `git fetch origin && git merge origin/master` if the branch is behind (resolve `tasks/README.md` by re-running
   `pnpm tasks:board`). Do not rebase-and-force-push; force pushes are denied.
2. `pnpm verify` is green (and `pnpm e2e:smoke` for UI tasks). Keep the evidence summary for the PR body.
3. Every DoD checkbox in the task file is ticked and verifiable; `## Result` is filled (what changed, deviations, follow-ups).
4. Push, open the PR, then ONE commit that marks the task done:

```bash
git push -u origin task/T-xxx-slug
gh pr create --title "type(scope): subject [T-xxx]" --body-file <body built from .github/pull_request_template.md>
node scripts/tasks.mjs set T-xxx done --pr <PR URL>      # see "Done status" below
pnpm tasks:board && pnpm tasks:check
git commit -am "docs(tasks): mark T-xxx done [T-xxx]" && git push
```

5. Wait ~30s after the push (GitHub registers checks with a delay), then `gh pr checks <n> --watch`; if it says there are no
   checks yet, sleep 15s and retry until they appear.

`/ship` stops here and never merges or enables auto-merge. Next step: `/review <pr>` (section 6); the reviewer enables
auto-merge after `VERDICT: LGTM`. After the merge run `pnpm task:clean T-xxx` (it finds the branch through the task file's `branch:` field, so renumbered
tasks work too).

PR title format equals the commit format (header max 100 chars), because the squash commit takes the PR title.

### Done status

Branch protection forbids a post-merge commit on `master`, so `done` cannot be set afterwards. The approach is:

- The task stays `in_progress` while working. The `review` status is still valid in `tasks.mjs` but **optional**: the
  flow does not use it, so there is no separate `review` commit.
- After `gh pr create` the PR URL exists; the **last commit of the PR** sets `status: done` and `pr: <url>`
  (`node scripts/tasks.mjs set`), regenerates the board, and only then the PR goes to review. Auto-merge is enabled by the reviewer after LGTM.
- `pnpm tasks:check` enforces the done contract: a `done` task has `pr`, no unchecked `- [ ]` in "Definition of Done" and a
  non-empty "Result" section (HTML comments are ignored).
- `pnpm tasks:check` also fails when a task id of the branch is used on `origin/master` by a different file (id collision
  between two branches); it needs the `origin/master` ref and is skipped without it (CI fetches it).
- Squash-merge therefore lands the code and the `done` status atomically. `pnpm tasks:check --gh` (run by the
  orchestrator on `master` periodically) warns if a task is `done` but its PR is not merged — that flags PRs closed
  without merge; the fix is a new task-status PR.
- If a PR is closed unmerged, set the status back to `in_progress` in the next commit. Fixes after `CHANGES REQUESTED` are
  plain commits on top of the `done` commit.

## 6. Review

`/review <PR number | T-xxx>` runs the `reviewer` agent (fresh context, read-only) against the PR:
`gh pr view`, `gh pr diff`, the task file, the cited spec rules, `gh pr checks`. It follows the checklist in its prompt
and ends with a verdict: `LGTM` or `CHANGES REQUESTED` with a numbered finding list (file:line, rule, fix).

Approval limitation (honest note): the PR author and the reviewer agent use the **same GitHub account**, and GitHub
does not allow approving your own PR. So:

- The reviewer posts `gh pr review <n> --comment --body-file <tmpfile>` directly (body written under `/tmp`; no `--approve`
  attempt; fallback `gh pr comment <n> --body "..."`). It reads PR files with `git fetch origin <head>` +
  `git show origin/<head>:<path>` (no worktree needed); `gh pr diff <n>` has no pathspec, so filter it with `grep`.
- Branch protection must NOT require an approving review for agent PRs (it can't be satisfied); the CI checks are the
  hard gate, the reviewer verdict is a process gate enforced by the orchestrator/human.
- **The review gates the merge.** `/ship` never enables auto-merge, so a PR cannot land before the verdict. After `/ship`
  run `/review <pr>`. On `VERDICT: LGTM`, if the diff touches none of `docs/spec/**`, `docs/decisions/**`, `epics/**`,
  the reviewer runs `gh pr merge <n> --squash --auto` (GitHub merges as soon as `verify`, `contract`, `e2e` are green) and
  then reports "merged" or "auto-merge enabled" based on `gh pr view <n> --json state,autoMergeRequest`.
  Branch protection is strict (the branch must be up to date with master): if `gh pr view <n> --json mergeStateStatus` is
  `BEHIND`, the reviewer first runs `gh api -X PUT repos/Web-Usov/home-finances/pulls/<n>/update-branch` (merge only, the API default; `update_method` is denied; gh v2.45 has no `pr update-branch`; this is the reviewer's one
  permitted branch modification). GitHub merges master in and re-runs CI on the new head. If GitHub reports a conflict, the
  reviewer sends the PR back to the author, who merges `origin/master` locally, runs `pnpm tasks:board`, `pnpm verify` and
  pushes. Otherwise the reviewer enables auto-merge without comparing files: `verify` (`tasks:check`, board `--check`) and
  `contract` (`api:contract`) detect stale generated files on the updated head; if they fail, auto-merge does not happen and
  the PR goes back to the author.
  On `CHANGES REQUESTED` the reviewer only posts the comment (as a safety step it may run `gh pr merge <n> --disable-auto`);
  the implementer fixes the findings with new commits, runs `pnpm verify`, pushes, and `/review` runs again.
- **Branch protection reality:** required approving reviews = 0, because agents and the owner share the GitHub account
  `Web-Usov` and self-approval is impossible. CODEOWNERS (`docs/spec/**`, `docs/decisions/**`, `epics/**`) is therefore
  advisory only. Human review of those paths is enforced by process: a PR whose diff touches them MUST NOT get
  auto-merge: the reviewer posts LGTM, states that the PR waits for the human, and the human merges. Check with `git diff origin/master --name-only | grep -E '^(docs/spec|docs/decisions|epics)/'`.
  Required status checks stay `verify`, `contract`, `e2e`.

## 7. Blocked, ambiguity and spec changes

- Spec ambiguous or contradictory, or a needed decision is missing: stop coding that part. Set `status: blocked`
  (`node scripts/tasks.mjs set T-xxx blocked`), write the question and a proposed answer (`Q-proposal:` with options and
  the recommended one) in the task's Handoff log, run `/handoff`, and notify the human (message to the orchestrator).
- Agents never edit `docs/spec/**`, `docs/decisions/**` or `epics/**` in implementation PRs. Spec/ADR changes are
  made only by the `planner` in a dedicated docs PR that the human reviews. The planner registers the question in
  `docs/spec/99-open-questions.md` as `Q-NN`; the blocked task then lists it in `blocked_by` and is unblocked when the question
  is resolved.
- New work discovered while implementing or reviewing: file it with `pnpm task:start --new "<title>" --epic E-xx --area <a>
  --size <S|M>` (section 2), or add a `todo` task file to the current PR; mention it in `## Result`. Tasks that need spec/ADR/epic
  changes still go through the planner.

## 8. Milestones

When all tasks of an epic are `done` (`pnpm tasks:board`), the planner/orchestrator runs `/milestone E-xx`: it checks
`pnpm spec:check`, `pnpm e2e:full`, collects merged PRs and e2e screenshots and writes a **Russian** report for the
human (PRs, AC coverage, demo scenario from the epic's acceptance criteria, risks). The epic becomes `done` through a
planner PR; only the human sets `accepted` (`accepted: YYYY-MM-DD`). Findings from acceptance become new tasks.

## 9. Parallel work

- **On this machine (4 CPU, 5 GB RAM) run at most 2 implementers in parallel.** Each session runs turbo, jest and sometimes
  Expo/Playwright; more than two thrash memory.
- Tasks that touch the same module (e.g. both edit `months.service.ts`) must not run in parallel: express this with
  `depends`, or the orchestrator serialises them. Avoid parallel tasks on the same module even without a formal `depends`.
  Tasks in different modules/apps may run in parallel worktrees.
- `pnpm e2e:smoke` / `pnpm e2e:full` take a machine-wide lock (see `docs/testing.md`), so parallel agents queue instead of
  running two web exports at once.
- The turbo cache is shared across worktrees: logs replayed from a cache hit may show paths of other worktrees; harmless.
- Each worktree has its own `node_modules`, `.env`, and test schema (schema-per-jest-worker on the shared test DB), so
  parallel `pnpm test:int` runs are safe. The dev DB is not used by tests.
- `tasks/README.md` (generated) holds one block per task and no aggregate counters, so parallel PRs that change different
  tasks merge cleanly (covered by `scripts/__tests__/tasks.test.mjs`); counters are printed by `pnpm tasks:board` / `pnpm tasks:next`.
  If it still conflicts, resolve by running `pnpm tasks:board`, never by hand.
- Do not touch another session's worktree or branch.

## Command and permission cheat sheet

| Need | Command |
| --- | --- |
| Next task | `/next`, `pnpm tasks:next`; claim: `pnpm task:start T-xxx`; cleanup: `pnpm task:clean T-xxx` |
| Work gate | `pnpm verify` (`verify:quick` while iterating) |
| Contract | `pnpm api:contract` (`pnpm api:generate` to regenerate) |
| E2E | `pnpm e2e:smoke` (every PR), `pnpm e2e:full` (master / milestones), `pnpm smoke:compose` |
| Rules | `pnpm spec:check`; tasks: `pnpm tasks:check`, `pnpm tasks:board` |
| Pause | `/handoff` |
| Deliver | `/ship` |
| Review | `/review <pr|T-xxx>` |
| Overview | `/status`, `/milestone E-xx` |

Agent permissions (enforced by `.opencode/agents/*.md`): the implementer may edit everything except
`docs/spec/**`, `docs/decisions/**`, `epics/**`; force pushes are denied; every `gh pr merge` is denied. The reviewer cannot edit files and is the only agent allowed
`gh pr merge <n> --squash --auto` / `--disable-auto`; it may write temp files under `/tmp` only. The planner edits only docs/tasks/epics and never merges. The QA agent edits only `e2e/**` and never merges.
Shell permissions are best-effort pattern matches, not a security sandbox: agents must follow these rules even where a
command would technically be allowed.
