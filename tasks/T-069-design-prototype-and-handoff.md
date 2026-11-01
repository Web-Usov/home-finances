---
id: T-069
title: "Design: clickable prototype and handoff document"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-068]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-10, UI-16, MSG-02, MSG-03, MON-12, REP-10]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-069. Design: clickable prototype and handoff document

## Goal

Page "04 Прототип" has a clickable prototype of the main flows, and `docs/design/handoff.md` is filled with the token table, component specs and frame links for the future implementation epic.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 7 (handoff template). Doop: wire frames with `data-doop-on` / `data-doop-action` per the Doop guide; set the start with `set_prototype_start`; verify with `get_prototype`.
- Only the owner approves; list approval state of every frame from `get_canvas` (`approval_status`).

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Prototype covers: open month -> add expense with uncovered warning (MSG-02) -> transfer refused with "Перевести только X ₽" (MSG-03) -> close month -> reopen with the range -> History with the "Только непокрытые" filter -> Analytics drill-down (REP-10); `get_prototype` shows no broken links.
- [ ] All inventory frames are `ready_for_dev` (owner approval) — list of any exceptions agreed with the owner is in the handoff.
- [ ] `docs/design/handoff.md` is created from the template in the brief section 7: token table + `theme.extend` JSON, component list with frame links, screen list with mobile/desktop frame links and rule IDs, prototype link, icon/font notes, assumptions; the "Канвас:" field in `docs/design/README.md` is filled.
- [ ] `pnpm verify:quick` is green (spec-check passes on the new docs); task file updated (status, branch, pr, Result).
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Any implementation (separate epic after acceptance of E-07).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
