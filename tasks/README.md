# Доска задач (генерируется, не редактировать)

> Файл создаётся командой `node scripts/tasks.mjs board`. Источник правды — frontmatter файлов `tasks/T-*.md` и `epics/E-*.md`. Сводные счётчики не хранятся в файле: их печатает `pnpm tasks:board`.

## E-00. Технический долг и соответствие спеке — planned

Эпик: [E-00-tech-debt.md](../epics/E-00-tech-debt.md)

- [T-001](T-001-zod-pipe-422.md) ZodValidationPipe returns 422 and drop legacy global ValidationPipe — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/3)

- [T-002](T-002-spec-rule-ids-in-code.md) Replace "SPECIFICATION.md line NNN" comments with rule IDs — **done** · docs · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/21)

- [T-017](T-017-envelope-initial-balance-recalc.md) Envelope created with an initial balance must show that balance (recalculate month) — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/4)

- [T-018](T-018-process-v1-retro.md) Process v1: apply pilot retro — **done** · infra · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/5)

- [T-019](T-019-remove-class-validator-deps.md) Remove unused class-validator and class-transformer dependencies — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/8)

- [T-020](T-020-spec-gaps-validation-error-month-not-found.md) Spec gaps from pilot reviews (error codes, working month and period on operations, reopen preview, message format) — **done** · docs · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/12)

- [T-021](T-021-harden-process-scripts.md) Harden process scripts (with-lock, task-start, task-clean) — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/6)

- [T-022](T-022-process-stability-conflict-free-board.md) Process stability: conflict-free board, robust script tests — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/11)

- [T-023](T-023-initial-balance-month-not-found.md) Envelope with an initial balance and no month returns MONTH_NOT_FOUND — **done** · api · S · depends: T-020 · [PR](https://github.com/Web-Usov/home-finances/pull/26)

- [T-026](T-026-money-ru-messages.md) ru-RU money formatting in server messages — **done** · api · S · depends: T-005, T-025, T-020 · [PR](https://github.com/Web-Usov/home-finances/pull/32)

- [T-028](T-028-single-reopened-month-db.md) Enforce a single reopened month in the database (MON-13 race) — **done** · api · S · depends: T-006 · [PR](https://github.com/Web-Usov/home-finances/pull/36)

- [T-029](T-029-version-check-in-tx.md) Re-check month version inside the transaction in allocations.save and other mutations — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/25)

- [T-030](T-030-openapi-allocations-uuid-keys.md) Keep propertyNames uuid for the allocations map in openapi.json — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/29)

- [T-033](T-033-task-id-allocation.md) Task id allocation sees task files of all remote branches — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/18)

- [T-035](T-035-reviewer-update-branch-flow-fixes.md) Reviewer update-branch flow fixes — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/20)

- [T-036](T-036-lock-month-row-in-every-month-scoped.md) Lock month row in every month-scoped mutation (optimistic lock race) — **done** · api · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/25)

- [T-040](T-040-spec-follow-ups-batch-2.md) Spec follow-ups batch 2 — **done** · docs · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/33)

- [T-042](T-042-period-month-range-and-transfer-period-test.md) Types: PeriodSchema rejects months outside 01-12, explicit-period transfer test — **done** · api · S · depends: T-025 · [PR](https://github.com/Web-Usov/home-finances/pull/48)

- [T-043](T-043-msg-05-text-and-negative-closing-warning.md) Envelopes: align MSG-05 text with the spec, test negative closing warning — **done** · api · S · depends: T-026 · [PR](https://github.com/Web-Usov/home-finances/pull/45)

- [T-044](T-044-shared-working-month-and-free-helpers.md) API: shared working-month and free-funds helpers, dedup yearly uncovered schema — **done** · api · S · depends: T-043, T-008 · [PR](https://github.com/Web-Usov/home-finances/pull/50)

- [T-046](T-046-openapi-months-body-response-query-types.md) OpenAPI: typed POST /months body, GET /months response and query params — **done** · api · S · depends: T-027, T-037, T-050 · [PR](https://github.com/Web-Usov/home-finances/pull/52)

- [T-047](T-047-auto-update-behind-prs-with-auto-merge.md) Auto-update BEHIND PRs with auto-merge (host timer) — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/38)

- [T-049](T-049-language-rule-russian-for-everything.md) Language rule: Russian for everything the human reviews or decides — **done** · docs · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/44)

- [T-051](T-051-spec-follow-ups-batch-3.md) Spec follow-ups batch 3 — **done** · docs · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/51)

- [T-056](T-056-docker-hardening-and-compose-smoke.md) Docker hardening: WEB_ROOT, non-root API, watchdog state dir, compose smoke — **done** · infra · S · depends: T-050 · [PR](https://github.com/Web-Usov/home-finances/pull/55)

- [T-057](T-057-e2e-lock-in-playwright-global-setup.md) E2E: take the machine-wide lock inside Playwright globalSetup — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/56)

- [T-059](T-059-plan-epic-e-07-design-brief-epic-and.md) Plan epic E-07 design: brief, epic and design tasks — **in_progress** · docs · S · depends: — · —

## E-01. Ядро API: месяцы и операции — accepted, принят 2026-11-01

Эпик: [E-01-core-api.md](../epics/E-01-core-api.md)

- [T-003](T-003-months-income-update.md) Months: update income with cascade recalculation — **done** · api · M · depends: T-001 · [PR](https://github.com/Web-Usov/home-finances/pull/7)

- [T-004](T-004-operations-list-create.md) Operations: history list and create (expense, transfer, adjustment) — **done** · api · M · depends: T-003 · [PR](https://github.com/Web-Usov/home-finances/pull/10)

- [T-005](T-005-operations-update-delete.md) Operations: update and delete with stable sequence and recalculation — **done** · api · M · depends: T-004 · [PR](https://github.com/Web-Usov/home-finances/pull/13)

- [T-006](T-006-month-close-reopen.md) Months: close, reopen and draft promotion — **done** · api · M · depends: T-003 · [PR](https://github.com/Web-Usov/home-finances/pull/9)

- [T-024](T-024-reopen-preview-endpoint.md) Reopen preview endpoint GET /months/:period/reopen-preview — **done** · api · S · depends: T-006, T-020 · [PR](https://github.com/Web-Usov/home-finances/pull/30)

- [T-025](T-025-operations-period-param.md) Operations: optional period on POST /operations — **done** · api · M · depends: T-005, T-020 · [PR](https://github.com/Web-Usov/home-finances/pull/31)

- [T-027](T-027-unify-mutation-summary.md) Unify month mutation response shape (data.summary) — **done** · api · M · depends: T-020, T-029 · [PR](https://github.com/Web-Usov/home-finances/pull/27)

- [T-031](T-031-int-uncovered-does-not-block-close.md) Int test: uncovered operations do not block closing a month — **done** · api · S · depends: T-004, T-006 · [PR](https://github.com/Web-Usov/home-finances/pull/13)

- [T-032](T-032-months-recalculate-on-month-creation.md) Months: recalculate on month creation and draft promotion — **done** · api · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/16)

- [T-034](T-034-e01-rule-coverage.md) E-01: tests citing every epic rule — **done** · api · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/19)

- [T-041](T-041-draft-copies-income.md) Months: new month copies income from the previous month — **done** · api · S · depends: T-032, T-027 · [PR](https://github.com/Web-Usov/home-finances/pull/47)

- [T-050](T-050-if-match-etag-optimistic-locking.md) Optimistic locking via If-Match / ETag headers for all month-scoped mutations — **done** · api · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/46)

## E-02. Отчётность API — planned

Эпик: [E-02-reporting-api.md](../epics/E-02-reporting-api.md)

- [T-007](T-007-dashboard-monthly-api.md) Reporting: monthly dashboard endpoint — **done** · api · M · depends: T-004, T-006 · [PR](https://github.com/Web-Usov/home-finances/pull/14)

- [T-008](T-008-analytics-yearly-api.md) Reporting: yearly analytics endpoint (three reports) — **done** · api · M · depends: T-004 · [PR](https://github.com/Web-Usov/home-finances/pull/17)

- [T-045](T-045-operations-filters-uncovered-only-role-source.md) Operations: uncoveredOnly and role=source filters for analytics drill-down — **done** · api · M · depends: T-008, T-025 · [PR](https://github.com/Web-Usov/home-finances/pull/49)

- [T-052](T-052-operations-role-source-requires-envelope-id.md) Operations: role=source without envelopeId is a 422 — **todo** · api · S · depends: T-045 · —

## E-03. Экран «Месяц» и редактор распределения — planned

Эпик: [E-03-month-screen.md](../epics/E-03-month-screen.md)

- [T-009](T-009-month-dashboard-screen.md) Mobile: month dashboard screen, period switcher and month actions — **done** · mobile · M · depends: T-006, T-007 · [PR](https://github.com/Web-Usov/home-finances/pull/23)

- [T-010](T-010-allocation-editor.md) Mobile: allocation editor with live totals and overflow block — **done** · mobile · M · depends: T-009, T-027 · [PR](https://github.com/Web-Usov/home-finances/pull/24)

- [T-037](T-037-mobile-reopen-preview.md) Mobile: show the recalculation range before reopening (reopen preview) — **done** · mobile · S · depends: T-009, T-024 · [PR](https://github.com/Web-Usov/home-finances/pull/37)

## E-04. Операции и история (UI) — planned

Эпик: [E-04-operations-ui.md](../epics/E-04-operations-ui.md)

- [T-011](T-011-operation-forms.md) Mobile: expense, transfer and adjustment forms — **done** · mobile · M · depends: T-004, T-009, T-025, T-026 · [PR](https://github.com/Web-Usov/home-finances/pull/35)

- [T-012](T-012-history-screen.md) Mobile: history screen with filters, edit and delete — **done** · mobile · M · depends: T-005, T-011 · [PR](https://github.com/Web-Usov/home-finances/pull/39)

- [T-053](T-053-transfer-exceeds-balance-available-field.md) Structured available field in TRANSFER_EXCEEDS_BALANCE 409 and client usage — **todo** · api · M · depends: T-011, T-012, T-050 · —

- [T-054](T-054-operation-form-replace-offer-and-archived-source.md) OperationForm: replace offer when the transfer source changed, preselect archived source — **todo** · mobile · M · depends: T-053 · —

- [T-055](T-055-e2e-transfer-overrun-on-edit.md) E2E: real transfer overrun on edit — **todo** · mobile · S · depends: T-054 · —

## E-05. Годовая аналитика (UI) — planned

Эпик: [E-05-analytics-ui.md](../epics/E-05-analytics-ui.md)

- [T-013](T-013-analytics-screen.md) Mobile: yearly analytics screen — **done** · mobile · M · depends: T-008, T-012 · [PR](https://github.com/Web-Usov/home-finances/pull/41)

## E-06. Приёмка MVP и поставка — planned

Эпик: [E-06-mvp-release.md](../epics/E-06-mvp-release.md)

- [T-014](T-014-ac-test-coverage.md) Acceptance: tests for AC-01..AC-22 and strict spec coverage — **done** · api · M · depends: T-005, T-006, T-007, T-008 · [PR](https://github.com/Web-Usov/home-finances/pull/22)

- [T-015](T-015-e2e-full-scenarios.md) E2E: full Playwright scenarios for the MVP flows — **done** · mobile · M · depends: T-010, T-012, T-013 · [PR](https://github.com/Web-Usov/home-finances/pull/42)

- [T-016](T-016-docker-compose-e2e.md) Delivery: docker compose from scratch and persistence after restart — **done** · infra · S · depends: T-014 · [PR](https://github.com/Web-Usov/home-finances/pull/40)

- [T-038](T-038-preview-environment-auto-deploy-master.md) Preview environment: auto-deploy master for the owner — **done** · infra · M · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/28)

- [T-039](T-039-preview-keep-api-up-restart-always.md) Preview: keep API up (Restart=always, health watchdog) — **done** · infra · S · depends: — · [PR](https://github.com/Web-Usov/home-finances/pull/34)

- [T-048](T-048-mobile-refresh-month-after-envelope-change.md) Refresh the month dashboard after envelope create/rename/archive — **done** · mobile · S · depends: T-015 · [PR](https://github.com/Web-Usov/home-finances/pull/43)

## E-07. Дизайн — planned

Эпик: [E-07-design.md](../epics/E-07-design.md)

- [T-060](T-060-design-principles-moodboard-references.md) Design: principles, moodboard, references and font proposal — **todo** · design · S · depends: — · —

- [T-061](T-061-design-tokens-and-canvas-guidelines.md) Design: tokens and canvas guidelines (colors, type, spacing, radii, elevation) — **todo** · design · M · depends: T-060 · —

- [T-062](T-062-design-core-components.md) Design: core components with all states — **todo** · design · M · depends: T-061 · —

- [T-063](T-063-design-screens-month-allocation.md) Design: Month screen (all states) and allocation editor — **todo** · design · M · depends: T-062 · —

- [T-064](T-064-design-screens-operation-forms-reopen.md) Design: operation forms and reopen confirmation — **todo** · design · M · depends: T-063 · —

- [T-065](T-065-design-screens-history.md) Design: History screen — **todo** · design · S · depends: T-064 · —

- [T-066](T-066-design-screens-analytics.md) Design: Analytics screen (reports and charts) — **todo** · design · M · depends: T-065 · —

- [T-067](T-067-design-screens-envelopes-states.md) Design: Envelopes screen and empty/error/loading states — **todo** · design · M · depends: T-066 · —

- [T-068](T-068-design-desktop-adaptation.md) Design: desktop adaptation of key screens — **todo** · design · M · depends: T-067 · —

- [T-069](T-069-design-prototype-and-handoff.md) Design: clickable prototype and handoff document — **todo** · design · M · depends: T-068 · —
