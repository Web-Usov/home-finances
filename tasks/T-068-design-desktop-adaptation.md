---
id: T-068
title: "Design: desktop adaptation of key screens"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-067]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-01, NFR-20, NFR-22, REP-03, REP-05]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-068. Design: desktop adaptation of key screens

## Goal

Page "03 Экраны / Desktop" has wide-layout (≥ 1280 px, plus a tablet-width check) frames for Month, allocation editor, History, Analytics and Envelopes with the sidebar navigation.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief sections 3-4 (wide layout, "+ десктоп" screens).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Sidebar navigation (UI-01) with the four sections and the month switcher placement defined.
- [ ] Desktop frames for Month (summary + envelope table), allocation editor, History (table-like list with filters), Analytics (chart + table side by side), Envelopes.
- [ ] Content max width, columns and breakpoints stated as tokens/annotations (mapping to Tailwind breakpoints).
- [ ] Checklist filled; frames `needs_review`; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Prototype and handoff (next task).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
