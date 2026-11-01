---
id: T-065
title: "Design: History screen"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-064]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-03, HIST-15, MSG-06, NFR-20, NFR-24]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-065. Design: History screen

## Goal

Page "03 Экраны / История" has mobile frames for the History list and its states.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 4 ("История"). Current screen: `apps/mobile/src/components/history/*` (read-only).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] List frame: operation type, envelope(s), amount, covered, uncovered, comment; amounts aligned; transfers and adjustments distinguishable not by color alone.
- [ ] Filters (month, envelope, type) and the clearable "Только непокрытые" chip (HIST-15); reset; empty list.
- [ ] Edit and delete flows (confirmation) and the closed-month read-only state (MSG-06).
- [ ] No horizontal scrolling at 360 px; checklist filled; frames `needs_review`; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Analytics drill-down visuals (Analytics task).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
