---
id: T-060
title: "Design: principles, moodboard, references and font proposal"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-17, NFR-23, NFR-24]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-060. Design: principles, moodboard, references and font proposal

## Goal

The canvas "Family Budget — Design" exists with page "00 Принципы и референсы": principles, anti-patterns, a moodboard, pinned references ("more like this") and a font shortlist with money samples, so the owner can pick the visual direction and font.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief sections 1-3 (principles, anti-patterns, platform limits, font candidates: Inter, IBM Plex Sans, Golos Text).
- Use `search_images` / `list_backgrounds` only if they serve the direction; no generic stock illustrations.

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Canvas "Family Budget — Design" exists with pages 00-04 created (empty pages allowed for 01-04); canvas link is reported in `## Result` for the owner to put into `docs/design/README.md`.
- [ ] Page 00 has a frame with the principles and the anti-pattern list from the brief.
- [ ] Page 00 has a moodboard frame with 3-6 pinned references (pinned as "more like this"), each with a one-line note why it fits (restraint, numbers first).
- [ ] Page 00 has a font proposal frame: 2-3 candidates (Cyrillic, tabular figures) shown on real samples "1 234,50 ₽", "−3 500,00 ₽", a table fragment and a heading; recommendation stated; owner choice recorded with `save_decision` after the owner decides.
- [ ] All frames are `needs_review`; owner comments are answered.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Tokens, components, screens (next tasks).
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
