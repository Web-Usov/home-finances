---
description: Run the full quality gate and summarize failures with file:line and fix suggestions
---

Run `pnpm verify` in the current worktree (it runs typecheck, lint, test:unit, test:int, build and api:contract).
$ARGUMENTS

If everything passes, answer with one line: `verify green` plus the commit SHA (`git rev-parse --short HEAD`).

If something fails, do not fix anything yet. Report per failing step: the command, the failing `file:line`, the error
in one sentence, whether it is caused by this branch's changes (check `git diff origin/master --stat`), and a concrete
fix suggestion. Order by dependency (typecheck errors first). Then ask whether to apply the fixes.
Never skip, delete or loosen a test or lint rule just to get green.
