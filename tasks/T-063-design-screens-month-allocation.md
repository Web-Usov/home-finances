---
id: T-063
title: "Design: Month screen (all states) and allocation editor"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-062]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-02, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-13, UI-14, UI-16, MSG-01, MSG-06, NFR-30]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-063. Design: Month screen (all states) and allocation editor

## Goal

Page "03 Экраны / Месяц" has mobile frames for every Month state and the allocation editor states.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 4 (inventory, "Месяц"). Current screen: `apps/mobile/src/components/month/*` (read-only).
- Spec: UI-06..UI-16, MON-01, MON-04, SCOPE-23..SCOPE-26.

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Month frames (360 and 390 px): open (with uncovered amounts and an adjustment indicator), draft, closed (read-only, quick actions disabled, MSG-06), reopened (distinct status and recalculation hint), and the empty first-month setup.
- [ ] Summary: income, allocated, free (negative free funds shown with "−" and emphasis, NFR-30), net adjustment, uncovered by type; envelope rows with balance, replenishment, spends; no negative envelope balance anywhere (NFR-24).
- [ ] Allocation editor frames: normal; over income with the exact excess and MSG-01 text verbatim, save blocked; read-only; totals and free funds always visible (UI-13).
- [ ] Quick actions "Списать", "Перевести", "Скорректировать" placed per UI-10; month switcher and header actions per UI-06.
- [ ] Frames are `needs_review`; checklist filled; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Operation forms (next task), desktop adaptation.
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
