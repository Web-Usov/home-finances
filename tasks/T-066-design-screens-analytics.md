---
id: T-066
title: "Design: Analytics screen (reports and charts)"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-065]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-04, REP-02, REP-03, REP-04, REP-05, REP-06, REP-07, REP-08, REP-09, REP-10, NFR-20, NFR-22]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-066. Design: Analytics screen (reports and charts)

## Goal

Page "03 Экраны / Аналитика" has mobile frames for the year selector and the three reports with charts and tables.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 4 ("Аналитика"). Current screen: `apps/mobile/src/components/analytics/*` (read-only). Demo data: 12 months of 2026 with plausible values.

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Income/allocated/free report: grouped chart over 12 months, table with exact values and yearly totals; free funds not summed with envelope balances (REP-04).
- [ ] Envelope balances report: envelope × month table, active/archived filter (REP-06), line chart with envelope selection (REP-07); legend and series distinguishable not only by color (NFR-22).
- [ ] Uncovered report: main metric by month (REP-08), additional cuts transfers and negative adjustments (REP-09), drill-down affordance to History (REP-10).
- [ ] Chart style defined from tokens (axes, grid, series palette, tooltips/values), readable at 360 px without page-wide horizontal scroll (NFR-20); empty year and loading states.
- [ ] Frames `needs_review`; checklist filled; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Desktop layout (Desktop task).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
