# 75. Модель данных

> **Назначение файла:** сущности хранилища и ограничения целостности.
> **Префикс ID:** `DATA`.

| ID | **Сущность** | **Ключевые поля** | **Назначение и ограничения** |
|----|--------------|-------------------|------------------------------|
| **[DATA-01]** | budget_month | period, status, income_minor, version | Одна запись на YYYY-MM; period уникален |
| **[DATA-02]** | envelope | name, status, created_period, archived_period, display_order | Название уникально без учёта регистра |
| **[DATA-03]** | allocation | month_id, envelope_id, amount_minor | Уникальная пара месяц + конверт |
| **[DATA-04]** | operation | month_id, sequence_no, type, source_envelope_id, destination_envelope_id, requested_minor, sign, is_initial, comment | Исходные пользовательские данные; sequence_no стабилен |
| **[DATA-05]** | operation_result | covered_minor, uncovered_minor, source_balance_before/after, destination_balance_before/after | Производный результат, пересоздаваемый движком |
| **[DATA-06]** | envelope_month_snapshot | opening, initial, allocation, expenses_requested, expenses_covered, adjustment_applied, transfers_in/out, closing, uncovered_by_type | Производная агрегированная запись для дашбордов |
| **[DATA-07]** | app_settings | currency, locale, schema_version | Одна системная запись; RUB и ru-RU в MVP |

## Ограничения целостности

- **[DATA-08]** все денежные исходные значения неотрицательные; знак корректировки хранится отдельно;

- **[DATA-09]** source_envelope_id и destination_envelope_id перевода различаются;

- **[DATA-10]** комбинация month_id + sequence_no уникальна;

- **[DATA-11]** операция ссылается только на конверт, доступный в выбранном месяце;

- **[DATA-12]** optimistic version предотвращает незаметную перезапись данных при двух открытых вкладках;

- **[DATA-13]** производные записи можно полностью удалить и восстановить из источников истины.
