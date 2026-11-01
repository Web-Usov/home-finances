import { expect, test } from '../fixtures/test';
import { button, dashboardFromApi, monthStatusesFromApi, radio, saveAllocation, shot } from '../support/ui';

test.describe('journey: correcting the past', () => {
  test('AC-14 / AC-15 / SCOPE-31..SCOPE-34: reopen January, add an operation, later months recalculate and keep their statuses', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '10000.00');
    await page.goto('/month');
    await saveAllocation(page, { Продукты: '30000' });

    // February copies the allocation (30 000) and gets its own spending of 35 000; then January is closed.
    await api.createMonth('2026-02', '100000.00');
    await api.createOperation('2026-02', { type: 'expense', sourceEnvelopeId: envelope.id, amount: '35000.00', comment: 'Февраль' });
    await api.closeMonth('2026-01');
    expect(await monthStatusesFromApi(page)).toEqual(['2026-01:closed', '2026-02:open']);
    const febBefore = await dashboardFromApi(page, '2026-02');
    expect(febBefore.byName('Продукты')).toMatchObject({ opening: '40000.00', closing: '35000.00' });
    expect(febBefore.byName('Продукты').uncovered.total).toBe('0.00');

    await page.goto('/month');
    await expect(page.getByRole('heading', { name: 'Февраль 2026' })).toBeVisible();
    await button(page, 'Предыдущий месяц').click();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();

    // AC-14: the closed month accepts no changes.
    for (const name of ['Списать', 'Перевести', 'Скорректировать', 'Изменить доход', 'Изменить распределение']) {
      await expect(button(page, name)).toBeDisabled();
    }

    // SCOPE-31 / SCOPE-32: reopen with a warning that shows the recalculation range.
    await button(page, 'Открыть повторно').click();
    await expect(page.getByText('Будут пересчитаны месяцы с января 2026 по февраль 2026.')).toBeVisible();
    await shot(page, testInfo, '01-reopen-preview');
    await button(page, 'Подтвердить повторное открытие').click();
    await expect(page.getByLabel('Статус месяца: Открыт повторно')).toBeVisible();
    expect(await monthStatusesFromApi(page)).toEqual(['2026-01:reopened', '2026-02:open']);

    // SCOPE-33: correct the past with an expense added to the reopened month; dependent balances update on their own.
    await button(page, 'Списать').click();
    await expect(page.getByText('Месяц: Январь 2026')).toBeVisible();
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('38000');
    await page.getByLabel('Комментарий', { exact: true }).fill('Забытая покупка');
    await button(page, 'Сохранить списание').click();
    await expect(page.getByText('Списание сохранено.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 2\s000,00/)).toBeVisible();
    await shot(page, testInfo, '02-january-corrected');

    const january = await dashboardFromApi(page, '2026-01');
    expect(january.byName('Продукты')).toMatchObject({ spent: '38000.00', closing: '2000.00' });
    // AC-15: February's opening balance and uncovered part are recalculated: 2 000 + 30 000 − 35 000 → 3 000 uncovered.
    const febAfter = await dashboardFromApi(page, '2026-02');
    expect(febAfter.byName('Продукты')).toMatchObject({ opening: '2000.00', closing: '0.00' });
    expect(febAfter.byName('Продукты').uncovered.total).toBe('3000.00');

    // SCOPE-34: close the corrected month again; February keeps its status.
    await button(page, 'Закрыть').click();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();
    expect(await monthStatusesFromApi(page)).toEqual(['2026-01:closed', '2026-02:open']);
    await button(page, 'Следующий месяц').click();
    await expect(page.getByLabel('Статус месяца: Открыт')).toBeVisible();
    await expect(page.getByText(/^Не покрыто: 3\s000,00/)).toBeVisible();
    await shot(page, testInfo, '03-february-recalculated');
  });
});
