---
description: Prepare the Russian milestone acceptance report for an epic (E-xx)
agent: planner
---

Prepare the milestone report for epic: $ARGUMENTS. Follow `docs/workflow.md` section 8.

1. Read `epics/E-xx-*.md` (acceptance criteria, spec rules) and list its tasks from `tasks/` (`epic: E-xx`).
   Verify all are `done` with merged PRs (`gh pr view <url> --json state,mergedAt`); `node scripts/tasks.mjs check --gh`.
   If not all done, report what remains and stop.
2. On an up-to-date `master` worktree run `pnpm spec:check` (AC and rule coverage for the epic's `spec`/`acceptance`
   ids), `pnpm verify`, `pnpm e2e:full` (and `pnpm smoke:compose` if the epic requires it). Collect Playwright screenshots/report paths.
3. Write the report in RUSSIAN to `docs/milestones/E-xx-report.md` (create the directory if needed) with: итог
   в 2-3 предложениях; таблица смёрженных PR (задача, PR, что сделано); покрытие правил и AC (покрыто/не покрыто, со
   ссылками на тесты по ID); скриншоты e2e и демо-сценарий из «Критериев приёмки вехи» шаг за шагом с ожидаемым
   результатом; известные ограничения и риски; что нужно проверить человеку.
4. Prepare (do not merge) a PR `docs(epics): milestone report E-xx` containing the report; if the epic status should
   become `done`, include that change in the same PR. Human review is required (CODEOWNERS). Never set
   `accepted` - only the human does.
5. Finish with a short Russian message for the human: where the report is, what to click through, how to accept.
