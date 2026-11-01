---
id: T-062
title: "Design: core components with all states"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-061]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [NFR-20, NFR-22, NFR-24, UI-01, UI-06, UI-13]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-062. Design: core components with all states

## Goal

Page "02 Компоненты" contains the core components built only from the tokens, each with all states, at 360 px and (where it differs) desktop.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 5 (component list). Components in code today: `apps/mobile/src/components/**` (read-only reference of what exists).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Frames for: buttons (primary, secondary, text, danger), inputs incl. the money input ("1 234,50", ₽ suffix, error), envelope select, filter chips, list rows and cards, tables with numbers (right alignment, totals, sticky first column on narrow screens), month status badges (draft, open, closed, reopened — not by color alone), alerts/banners (info, warning, danger), sheets/modals, month switcher, tab bar and desktop sidebar, toasts, skeletons.
- [ ] Each component shows default, pressed/hover, focus (visible), disabled and error states where applicable.
- [ ] Touch targets ≥ 44 × 44 px (annotated); contrast checked against the contrast table.
- [ ] Only token values are used (no free hex/px values); the review checklist is filled for each frame.
- [ ] Frames are `needs_review`; owner comments are answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Screens, prototype.
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
