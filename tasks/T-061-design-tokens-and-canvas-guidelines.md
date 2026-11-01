---
id: T-061
title: "Design: tokens and canvas guidelines (colors, type, spacing, radii, elevation)"
status: todo          # todo | in_progress | review | done | blocked
epic: E-07            # epics/E-xx-*.md
depends: [T-060]           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [NFR-22, NFR-23, NFR-24, NFR-30]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: [AC-21]        # AC ids this task contributes to, e.g. [AC-06]
area: design             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-061. Design: tokens and canvas guidelines (colors, type, spacing, radii, elevation)

## Goal

Page "01 Дизайн-кит" defines all design tokens in a form that maps to a Tailwind theme, and the canvas guidelines contain the same rules.

## Context

- Design session in Doop MCP (shared canvas "Family Budget — Design"); read `docs/design/README.md` (brief) and the canvas guidelines first. Call the Doop guide (`get_guide`) and `get_canvas` before editing; reuse one `agent_name`; `set_status` on focus changes; check every frame with `get_frame_screenshot`.
- Design only: no markup/code in the repository, no changes to `apps/mobile`. Frames are HTML on the canvas, not repo files.
- Statuses: the agent moves frames up to `needs_review`; only the owner sets `ready_for_dev` (HTML/size edits reset approval).
- Demo data: `docs/design/README.md` section 8 (November 2026, envelopes Продукты, Коммуналка, Отпуск, Подушка безопасности, Развлечения). Money format "1 234,50 ₽", minus "−", tabular figures.
- Review checklist: `docs/design/README.md` section 2 (anti-AI-slop list); fill it in a comment on each frame.
- Brief section 5 (token table) and section 3 (NativeWind/Tailwind mapping). Current theme keys: `apps/mobile/tailwind.config.js` (`primary-*`, `success`, `warning`, `danger`, `info`) — read-only reference.
- Use the font and direction chosen in the previous task.

## Definition of Done

Every item is checked by the owner on the Doop canvas (or by the named command).

- [ ] Frames for colors: neutral scale, one accent scale, semantic success/warning/danger/info (background, border, text, icon), surfaces; each token has a name and hex value.
- [ ] Frame for typography: family, size/line-height scale, weights, tabular figures, money styles (hero amount, row amount, table amount, negative amount with "−").
- [ ] Frames for spacing (4/8 scale and screen paddings for 360/390/desktop), radii (2-3 values), elevation/borders (2-3 levels), and the single icon set (sizes 16/20/24, stroke) with the chosen set named.
- [ ] Contrast frame: table of text/background pairs with measured ratios, all text pairs ≥ 4.5:1 (large ≥ 3:1, controls ≥ 3:1) — WCAG AA (NFR-23); status never conveyed by color alone (NFR-22).
- [ ] Canvas guidelines created (names: "Токены", "Правила денег", "Анти-паттерны", "Доступность") and readable through `get_guidelines`.
- [ ] Every token is expressible as a Tailwind theme key (name -> value); frames marked `needs_review`.
- [ ] Task file updated (status, branch, pr, Result with the canvas link and frame list)

## Out of scope

- Components and screens.
- Any code, markup or implementation in the repository (design-only epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
