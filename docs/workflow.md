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
- `/next T-xxx` does the status change, the worktree and prints the task.

## 2. Isolate: worktree per task

Create the worktree from an up-to-date `origin/master`, in a sibling directory (branch names use the task template
convention `task/T-xxx-slug`; the directory is the lowercase slug):

```bash
git fetch origin
git worktree add ../finance-wt/t-xxx-slug -b task/T-xxx-slug origin/master
cd ../finance-wt/t-xxx-slug
pnpm install
cp ../../finance/apps/api/.env apps/api/.env          # adjust the source path to your main checkout
cp ../../finance/apps/api/.env.test apps/api/.env.test
```

`.env` files are git-ignored and never committed. Then claim the task inside the worktree and commit it as the first
commit of the branch (so `master` never carries in-progress noise):

```bash
node scripts/tasks.mjs set T-xxx in_progress --branch task/T-xxx-slug
pnpm tasks:board
git commit -am "chore(tasks): start T-xxx [T-xxx]"
```

Claims are therefore visible on `master` only after merge; the orchestrator avoids double assignment by giving each
session an explicit task id (and by running `gh pr list` / `git branch -r` before picking).

Cleanup after the PR is merged (from the main checkout):

```bash
git worktree remove ../finance-wt/t-xxx-slug && git branch -D task/T-xxx-slug
git push origin --delete task/T-xxx-slug     # skip if GitHub deletes merged branches automatically
```

## 3. Implement

- Tests first where practical: write the DoD tests named in the task, see them fail, then implement.
- Test names cite rule IDs (`it('OP-05 / AC-06: ...')`) and must actually assert the rule, not just run the code.
  `pnpm spec:check` reports rule coverage and dangling IDs.
- Respect the hard invariants in `AGENTS.md` (kopecks, `@family-budget/types`, logic only in services/engine, ...).
- UI tasks add Playwright specs under `e2e/` and attach screenshots (Playwright report artifact in CI).
- Stay in scope. Anything in "Out of scope" or discovered extra work becomes a note in the task `Result`, a proposed
  follow-up task, or a handoff entry — not part of this PR.
- Commit small and often. Commit format: `type(scope): subject [T-xxx]` (English; `type` is one of
  feat, fix, refactor, test, docs, chore, ci, build, perf).
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

Preflight (`/ship` automates this):

1. `pnpm verify` is green (and `pnpm e2e:smoke` for UI tasks). Paste the evidence summary into the PR body.
2. Every DoD checkbox in the task file is ticked and verifiable; `## Result` is filled (what changed, deviations, follow-ups).
3. Task status is `review` with `branch` set; `pnpm tasks:board && pnpm tasks:check` pass.
4. `git fetch origin && git merge origin/master` if the branch is behind (resolve `tasks/README.md` by re-running
   `pnpm tasks:board`). Do not rebase-and-force-push; force pushes are denied.

Then:

```bash
git push -u origin task/T-xxx-slug
gh pr create --title "type(scope): subject [T-xxx]" --body-file <body built from .github/pull_request_template.md>
node scripts/tasks.mjs set T-xxx done --pr <PR URL>      # see "Done status" below
pnpm tasks:board && pnpm tasks:check
git commit -am "docs(tasks): mark T-xxx done [T-xxx]" && git push
gh pr merge --squash --auto
```

PR title format equals the commit format, because the squash commit takes the PR title.

### Done status

Branch protection forbids a post-merge commit on `master`, so `done` cannot be set afterwards. The approach is:

- The implementer sets `review` + `branch` while working.
- After `gh pr create` the PR URL exists; the **last commit of the PR** sets `status: done` and `pr: <url>`
  (`node scripts/tasks.mjs set`), regenerates the board, and only then auto-merge is enabled.
- Squash-merge therefore lands the code and the `done` status atomically. `pnpm tasks:check --gh` (run by the
  orchestrator on `master` periodically) warns if a task is `done` but its PR is not merged — that flags PRs closed
  without merge; the fix is a new task-status PR.
- If a PR is closed unmerged or changes are requested after the `done` commit, set the status back to `review`
  (`set T-xxx review`) in the next commit.

## 6. Review

`/review <PR number | T-xxx>` runs the `reviewer` agent (fresh context, read-only) against the PR:
`gh pr view`, `gh pr diff`, the task file, the cited spec rules, `gh pr checks`. It follows the checklist in its prompt
and ends with a verdict: `LGTM` or `CHANGES REQUESTED` with a numbered finding list (file:line, rule, fix).

Approval limitation (honest note): the PR author and the reviewer agent use the **same GitHub account**, and GitHub
does not allow approving your own PR. So:

- The reviewer posts `gh pr review <n> --comment --body "<verdict + findings>"` (it tries `--approve` only if the
  account differs; an error is expected otherwise).
- Branch protection must NOT require an approving review for agent PRs (it can't be satisfied); the CI checks are the
  hard gate, the reviewer verdict is a process gate enforced by the orchestrator/human.
- Auto-merge is enabled at the end of `/ship` and waits for CI. Run `/review` while CI runs. On
  `CHANGES REQUESTED` the reviewer (or the orchestrator) runs `gh pr merge <n> --disable-auto`; the implementer fixes the findings with
  new commits, runs `pnpm verify`, pushes, and `/review` runs again. There is a race if CI finishes before the review
  does; for risky changes the orchestrator holds back auto-merge until the verdict is in (`/ship hold`).
- **Branch protection reality:** required approving reviews = 0, because agents and the owner share the GitHub account
  `Web-Usov` and self-approval is impossible. CODEOWNERS (`docs/spec/**`, `docs/decisions/**`, `epics/**`) is therefore
  advisory only. Human review of those paths is enforced by process: a PR whose diff touches them MUST NOT get
  auto-merge. The implementer/planner opens it with `/ship hold` (or `gh pr create` without `gh pr merge --auto`) and
  the human merges. Check with `git diff origin/master --name-only | grep -E '^(docs/spec|docs/decisions|epics)/'`.
  Required status checks stay `verify`, `contract`, `e2e`.

## 7. Blocked, ambiguity and spec changes

- Spec ambiguous or contradictory, or a needed decision is missing: stop coding that part. Set `status: blocked`
  (`node scripts/tasks.mjs set T-xxx blocked`), write the question and a proposed answer (`Q-proposal:` with options and
  the recommended one) in the task's Handoff log, run `/handoff`, and notify the human (message to the orchestrator).
- Agents never edit `docs/spec/**`, `docs/decisions/**` or `epics/**` in implementation PRs. Spec/ADR changes are
  made only by the `planner` in a dedicated docs PR that the human reviews. The planner registers the question in
  `docs/spec/99-open-questions.md` as `Q-NN`; the blocked task then lists it in `blocked_by` and is unblocked when the question
  is resolved.
- New work discovered while implementing: propose it in `## Result` (follow-up task title + rationale); the planner
  creates the task.

## 8. Milestones

When all tasks of an epic are `done` (`pnpm tasks:board`), the planner/orchestrator runs `/milestone E-xx`: it checks
`pnpm spec:check`, `pnpm e2e:full`, collects merged PRs and e2e screenshots and writes a **Russian** report for the
human (PRs, AC coverage, demo scenario from the epic's acceptance criteria, risks). The epic becomes `done` through a
planner PR; only the human sets `accepted` (`accepted: YYYY-MM-DD`). Findings from acceptance become new tasks.

## 9. Parallel work

- Tasks that touch the same module (e.g. both edit `months.service.ts`) must not run in parallel: express this with
  `depends`, or the orchestrator serialises them. Tasks in different modules/apps may run in parallel worktrees.
- Each worktree has its own `node_modules`, `.env`, and test schema (schema-per-jest-worker on the shared test DB), so
  parallel `pnpm test:int` runs are safe. The dev DB is not used by tests.
- Conflicts on `tasks/README.md` (generated) are resolved by running `pnpm tasks:board`, never by hand.
- Do not touch another session's worktree or branch.

## Command and permission cheat sheet

| Need | Command |
| --- | --- |
| Next task | `/next`, `pnpm tasks:next` |
| Work gate | `pnpm verify` (`verify:quick` while iterating) |
| Contract | `pnpm api:contract` (`pnpm api:generate` to regenerate) |
| E2E | `pnpm e2e:smoke` (every PR), `pnpm e2e:full` (master / milestones), `pnpm smoke:compose` |
| Rules | `pnpm spec:check`; tasks: `pnpm tasks:check`, `pnpm tasks:board` |
| Pause | `/handoff` |
| Deliver | `/ship` |
| Review | `/review <pr|T-xxx>` |
| Overview | `/status`, `/milestone E-xx` |

Agent permissions (enforced by `.opencode/agents/*.md`): the implementer may edit everything except
`docs/spec/**`, `docs/decisions/**`, `epics/**`; force pushes are denied; `gh pr merge` is allowed only as
`--squash --auto`. The reviewer cannot edit files. The planner edits only docs/tasks/epics and never merges. The QA agent edits only `e2e/**`.
Shell permissions are best-effort pattern matches, not a security sandbox: agents must follow these rules even where a
command would technically be allowed.
