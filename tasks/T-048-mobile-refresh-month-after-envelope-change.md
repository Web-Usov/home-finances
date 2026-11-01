---
id: T-048
title: Refresh the month dashboard after envelope create/rename/archive
status: todo
epic: E-06
depends: [T-015]
blocked_by: []
spec: [SCOPE-24, SCOPE-25]
acceptance: [AC-01, AC-18]
area: mobile
size: S
branch: null
pr: null
---

# T-048. Refresh the month dashboard after envelope create/rename/archive

## Goal

An envelope created, renamed or archived on the Envelopes tab shows up on the Month tab at once (allocation editor fields, dashboard rows), without a page reload.

## Context

- Found by the T-015 first-launch journey (`e2e/journeys/first-launch.e2e.ts`): after creating envelopes on the Envelopes tab and switching back to Month, the allocation editor has no field for them. `QueryProvider` keeps data fresh for 5 minutes and `EnvelopeCreateForm` / `EnvelopeCard` / `EnvelopeRenameForm` invalidate only the envelopes list query, not the monthly dashboard (`invalidateMonthData` in `apps/mobile/src/components/month/useMonthMutations.ts` covers both).
- Spec: SCOPE-24, SCOPE-25; AC-01, AC-18.

## Definition of Done

- [ ] Create, rename and archive of an envelope also invalidate the monthly dashboard query (component test per mutation)
- [ ] `e2e/journeys/first-launch.e2e.ts`: the `page.reload()` workaround is removed and the journey stays green
- [ ] `pnpm verify` and `pnpm e2e:smoke` are green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the query cache policy (`staleTime`).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
