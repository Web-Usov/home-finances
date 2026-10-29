---
description: Project status - task board, open PRs, latest CI runs
---

Open PRs:

!`gh pr list --json number,title,headRefName,isDraft,statusCheckRollup --jq '.[] | "#\(.number) \(.title) [\(.headRefName)] draft=\(.isDraft)"' 2>&1 || true`

Latest CI runs:

!`gh run list -L 5 2>&1 || true`

Ready tasks:

!`pnpm tasks:next 2>&1 || true`

Now run `pnpm tasks:board` and read `tasks/README.md` (if the regenerated file differs from git, do not commit it;
mention that the board is stale). Produce a compact status report:

1. Board: counts per status and per epic, tasks in progress / review / blocked with their branches.
2. Open PRs and whether their checks (`verify`, `contract`, `e2e`) pass (`gh pr checks <n>` for each).
3. Latest CI runs on master and anything red.
4. What should happen next (one to three concrete actions).
