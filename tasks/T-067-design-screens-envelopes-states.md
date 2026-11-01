---
id: T-067
title: "Design: Envelopes screen and empty/error/loading states"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-066]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-05, MSG-05, MSG-06, NFR-20, NFR-22, NFR-24]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-067. Design: Envelopes screen and empty/error/loading states

## Goal

Page "03 Экраны / Конверты" and "Общие состояния" cover the Envelopes screen and all shared empty, error, loading and notification states.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 4 ("Конверты", "Общие"). Current screen: `apps/mobile/src/components/envelopes/*` (read-only).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Envelopes: list of active and archived (name, status, balance, created/archived month), create, rename, reorder, archive; archive refused with MSG-05 text verbatim ("Сначала обнулите конверт. Текущий остаток: X ₽."); empty list.
- [ ] Shared states: network/API error, stale version (409) with retry, loading skeletons, empty states for Month/History/Analytics, success and info toasts.
- [ ] Navigation frames: bottom tab bar (4 sections) and its active/focus states.
- [ ] Checklist filled; frames `needs_review`; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Desktop layout (next task).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
