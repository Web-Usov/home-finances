# Доска задач (генерируется, не редактировать)

> Файл создаётся командой `node scripts/tasks.mjs board`. Источник правды — frontmatter файлов `tasks/T-*.md` и `epics/E-*.md`.

Всего задач: 21 — todo: 16, in_progress: 0, review: 0, blocked: 0, done: 5.

## E-00. Технический долг и соответствие спеке — planned (5/7)

Эпик: [E-00-tech-debt.md](../epics/E-00-tech-debt.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-001](T-001-zod-pipe-422.md) | ZodValidationPipe returns 422 and drop legacy global ValidationPipe | done | api | S | — | [PR](https://github.com/Web-Usov/home-finances/pull/3) |
| [T-002](T-002-spec-rule-ids-in-code.md) | Replace "SPECIFICATION.md line NNN" comments with rule IDs | todo | docs | S | — | — |
| [T-017](T-017-envelope-initial-balance-recalc.md) | Envelope created with an initial balance must show that balance (recalculate month) | done | api | S | — | [PR](https://github.com/Web-Usov/home-finances/pull/4) |
| [T-018](T-018-process-v1-retro.md) | Process v1: apply pilot retro | done | infra | M | — | [PR](https://github.com/Web-Usov/home-finances/pull/5) |
| [T-019](T-019-remove-class-validator-deps.md) | Remove unused class-validator and class-transformer dependencies | done | api | S | — | [PR](https://github.com/Web-Usov/home-finances/pull/8) |
| [T-020](T-020-spec-gaps-validation-error-month-not-found.md) | Spec gaps from pilot reviews (API-18 VALIDATION_ERROR, initial balance without a month) | todo | docs | S | — | — |
| [T-021](T-021-harden-process-scripts.md) | Harden process scripts (with-lock, task-start, task-clean) | done | infra | S | — | [PR](https://github.com/Web-Usov/home-finances/pull/6) |

## E-01. Ядро API: месяцы и операции — planned (1/4)

Эпик: [E-01-core-api.md](../epics/E-01-core-api.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-003](T-003-months-income-update.md) | Months: update income with cascade recalculation | done | api | M | T-001 | [PR](https://github.com/Web-Usov/home-finances/pull/7) |
| [T-004](T-004-operations-list-create.md) | Operations: history list and create (expense, transfer, adjustment) | todo | api | M | T-003 | — |
| [T-005](T-005-operations-update-delete.md) | Operations: update and delete with stable sequence and recalculation | todo | api | M | T-004 | — |
| [T-006](T-006-month-close-reopen.md) | Months: close, reopen and draft promotion | todo | api | M | T-003 | — |

## E-02. Отчётность API — planned (0/2)

Эпик: [E-02-reporting-api.md](../epics/E-02-reporting-api.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-007](T-007-dashboard-monthly-api.md) | Reporting: monthly dashboard endpoint | todo | api | M | T-004, T-006 | — |
| [T-008](T-008-analytics-yearly-api.md) | Reporting: yearly analytics endpoint (three reports) | todo | api | M | T-004 | — |

## E-03. Экран «Месяц» и редактор распределения — planned (0/2)

Эпик: [E-03-month-screen.md](../epics/E-03-month-screen.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-009](T-009-month-dashboard-screen.md) | Mobile: month dashboard screen, period switcher and month actions | todo | mobile | M | T-006, T-007 | — |
| [T-010](T-010-allocation-editor.md) | Mobile: allocation editor with live totals and overflow block | todo | mobile | M | T-009 | — |

## E-04. Операции и история (UI) — planned (0/2)

Эпик: [E-04-operations-ui.md](../epics/E-04-operations-ui.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-011](T-011-operation-forms.md) | Mobile: expense, transfer and adjustment forms | todo | mobile | M | T-004, T-009 | — |
| [T-012](T-012-history-screen.md) | Mobile: history screen with filters, edit and delete | todo | mobile | M | T-005, T-011 | — |

## E-05. Годовая аналитика (UI) — planned (0/1)

Эпик: [E-05-analytics-ui.md](../epics/E-05-analytics-ui.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-013](T-013-analytics-screen.md) | Mobile: yearly analytics screen | todo | mobile | M | T-008, T-012 | — |

## E-06. Приёмка MVP и поставка — planned (0/3)

Эпик: [E-06-mvp-release.md](../epics/E-06-mvp-release.md)

| ID | Title | Status | Area | Size | Depends | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [T-014](T-014-ac-test-coverage.md) | Acceptance: tests for AC-01..AC-22 and strict spec coverage | todo | api | M | T-005, T-006, T-007, T-008 | — |
| [T-015](T-015-e2e-full-scenarios.md) | E2E: full Playwright scenarios for the MVP flows | todo | mobile | M | T-010, T-012, T-013 | — |
| [T-016](T-016-docker-compose-e2e.md) | Delivery: docker compose from scratch and persistence after restart | todo | infra | S | T-014 | — |
