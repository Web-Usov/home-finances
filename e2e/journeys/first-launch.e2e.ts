import { expect, test } from '../fixtures/test';
import { button, dashboardFromApi, monthStatusesFromApi, saveAllocation, shot } from '../support/ui';

test.describe('journey: first launch', () => {
  test('NFR-27 / AC-01 / SCOPE-23..SCOPE-27: first month, existing envelopes with balances, allocation, open dashboard', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/month$/);
    await expect(page.getByText('Начните с первого месяца')).toBeVisible();
    await shot(page, testInfo, '01-first-launch-empty');

    // SCOPE-23: the first accounting month and the total income.
    await page.getByLabel('Первый месяц').fill('2026-01');
    await page.getByLabel('Доход месяца').fill('100000');
    await button(page, 'Создать месяц').click();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await shot(page, testInfo, '02-first-month-created');

    // SCOPE-24: existing envelopes with their current balances (no old history is restored).
    await page.getByRole('tablist').getByRole('link', { name: 'Конверты' }).click();
    for (const [name, balance] of [['Продукты', '10000'], ['Дом', '5000']] as const) {
      await page.getByText('Создать конверт').click();
      await page.getByPlaceholder('Напр. Продукты').fill(name);
      await page.getByPlaceholder('0.00').fill(balance);
      await page.getByText('Создать', { exact: true }).click();
      // The Month tab stays mounted and now lists the new envelope too (T-048), so match the visible one only.
      await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
    }
    await expect(page.getByText(/^10\s000,00\s₽$/).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/^5\s000,00\s₽$/).filter({ visible: true })).toBeVisible();
    await shot(page, testInfo, '03-envelopes-with-balances');

    // SCOPE-25: the monthly allocation across all active envelopes.
    await page.getByRole('tablist').getByRole('link', { name: 'Месяц' }).click();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await saveAllocation(page, { Продукты: '40000', Дом: '20000' });

    // SCOPE-26 / SCOPE-27: the month stays "Открыт"; the dashboard shows income, allocation, free funds and envelope states.
    await expect(page.getByLabel('Статус месяца: Открыт')).toBeVisible();
    await expect(page.getByLabel(/^Доход: 100\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Распределено: 60\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 40\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 50\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 25\s000,00/)).toBeVisible();
    await shot(page, testInfo, '04-first-dashboard');

    const dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Продукты')).toMatchObject({ replenished: '40000.00', closing: '50000.00' });
    expect(dashboard.byName('Дом')).toMatchObject({ replenished: '20000.00', closing: '25000.00' });
    expect(await monthStatusesFromApi(page)).toEqual(['2026-01:open']);
  });
});
