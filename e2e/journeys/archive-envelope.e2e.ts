import { expect, test } from '../fixtures/test';
import { button, dashboardFromApi, radio, shot } from '../support/ui';

test.describe('journey: archiving an envelope', () => {
  test('AC-18: blocked with a non-zero balance, allowed at zero, the archived envelope stays in history and analytics', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Копилка', '2000.00');

    await page.goto('/envelopes');
    await expect(page.getByText('Копилка', { exact: true })).toBeVisible();
    await page.getByText('Архивировать', { exact: true }).click();
    await expect(page.getByText(/Сначала обнулите конверт\. Текущий остаток: 2\s000(,00)?\s₽\./)).toBeVisible();
    await expect(page.getByText('Копилка', { exact: true })).toBeVisible();
    await shot(page, testInfo, '01-archive-blocked');

    // Bring the balance to zero with an expense, then archive.
    await page.getByRole('tablist').getByRole('link', { name: 'Месяц' }).click();
    await button(page, 'Списать').click();
    await radio(page, 'Конверт: Копилка').click();
    await page.getByLabel('Сумма', { exact: true }).fill('2000');
    await button(page, 'Сохранить списание').click();
    await expect(page.getByText('Списание сохранено.')).toBeVisible();

    await page.getByRole('tablist').getByRole('link', { name: 'Конверты' }).click();
    await page.getByText('Архивировать', { exact: true }).click();
    await expect(page.getByText('Активных конвертов нет')).toBeVisible();
    await shot(page, testInfo, '02-archived-at-zero');

    const dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Копилка')).toMatchObject({ status: 'archived', closing: '0.00', spent: '2000.00' });

    // The archived envelope remains in the month, history and analytics.
    await page.goto('/month');
    await expect(page.getByText('В архиве')).toBeVisible();
    await page.goto('/history');
    await expect(page.getByLabel(/^Операция \d+: Списание/)).toContainText('Копилка');
    await page.goto('/analytics?year=2026');
    await expect(page.getByRole('row', { name: 'Копилка, архивный' })).toBeVisible();
    await shot(page, testInfo, '03-archived-in-analytics');
  });
});
