import { expect, test } from '../fixtures/test';
import { button, dashboardFromApi, monthStatusesFromApi, radio, shot } from '../support/ui';

test.describe('journey: draft and close', () => {
  test('AC-16 / AC-17 / SCOPE-29 / SCOPE-30: the draft takes operations but cannot close; closing the open month promotes it', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты', '10000.00');

    await page.goto('/month');
    await button(page, 'Изменить распределение').click();
    await page.getByLabel('Распределение: Продукты').fill('30000');
    await button(page, 'Сохранить распределение').click();
    await expect(page.getByLabel(/^Остаток: 40\s000,00/)).toBeVisible();

    // SCOPE-29: the next month is created as a draft and copies the allocation.
    await button(page, 'Создать следующий').click();
    await expect(page.getByText('Черновик февраля 2026 создан.')).toBeVisible();
    await button(page, 'Следующий месяц').click();
    await expect(page.getByLabel('Статус месяца: Черновик')).toBeVisible();
    expect((await dashboardFromApi(page, '2026-02')).byName('Продукты').replenished).toBe('30000.00');

    // AC-16: any operation is allowed in the draft, closing it is not.
    await button(page, 'Списать').click();
    await expect(page.getByText('Месяц: Февраль 2026')).toBeVisible();
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('1000');
    await button(page, 'Сохранить списание').click();
    await expect(page.getByText('Списание сохранено.')).toBeVisible();
    await expect(button(page, 'Закрыть')).toBeDisabled();
    await shot(page, testInfo, '01-draft-with-expense');

    // AC-17 / SCOPE-30: closing the current month turns the draft into the open one.
    await button(page, 'Предыдущий месяц').click();
    await expect(page.getByLabel('Статус месяца: Открыт')).toBeVisible();
    await button(page, 'Закрыть').click();
    await expect(page.getByText('Январь 2026 закрыт. Февраль 2026 теперь открыт.')).toBeVisible();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();
    await shot(page, testInfo, '02-january-closed');
    expect(await monthStatusesFromApi(page)).toEqual(['2026-01:closed', '2026-02:open']);

    await button(page, 'Следующий месяц').click();
    await expect(page.getByLabel('Статус месяца: Открыт')).toBeVisible();
    await expect(button(page, 'Закрыть')).toBeEnabled();
    // The draft's operation survives the promotion and the balance carries over (40 000 − 1 000 + 30 000).
    const february = await dashboardFromApi(page, '2026-02');
    expect(february.byName('Продукты')).toMatchObject({ opening: '40000.00', spent: '1000.00', closing: '69000.00' });
    await shot(page, testInfo, '03-february-open');
  });
});
