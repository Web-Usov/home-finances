---
id: T-064
title: "Design: operation forms and reopen confirmation"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-063]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-10, UI-16, MSG-02, MSG-03, MSG-04, MSG-06, AC-21, NFR-22, NFR-24]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-064. Design: operation forms and reopen confirmation

## Goal

Page "03 Экраны / Операции" has mobile frames for the expense, transfer and adjustment forms with all warning states and the reopen dialog.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 4 ("Операции"). Spec: OP-*, HIST-09, MON-12, SCOPE-31..SCOPE-34. Current forms: `apps/mobile/src/components/month/*` (read-only).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Expense form: normal; uncovered part warning with MSG-02 text verbatim and a confirmation action.
- [ ] Transfer form: normal; refusal with MSG-03 text verbatim and the "Перевести только X ₽" action.
- [ ] Adjustment form (±): positive; negative with MSG-04 text verbatim.
- [ ] Form fields: money input, envelope select (including archived source when editing), comment, month selector showing only a month (no day field, AC-21), validation errors; keyboard focus order annotated (NFR-22).
- [ ] Reopen confirmation: shows the recalculation range ("с … по …", months in correct case), confirm and cancel.
- [ ] Frames are `needs_review`; checklist filled; owner comments answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- History edit/delete (History task).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
