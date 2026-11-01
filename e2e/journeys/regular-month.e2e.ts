import { expect, test } from '../fixtures/test';
import { button, dashboardFromApi, radio, saveAllocation, shot } from '../support/ui';

test.describe('journey: regular month', () => {
  test('NFR-27 / SCOPE-28 / AC-19: expense, transfer and adjustment recalculate at once; the transfer leaves replenished and spent alone', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты', '10000.00');
    await api.createEnvelope('Дом', '5000.00');

    await page.goto('/month');
    await saveAllocation(page, { Продукты: '40000', Дом: '20000' });
    await expect(page.getByLabel(/^Остаток: 50\s000,00/)).toBeVisible();
    await shot(page, testInfo, '01-month-start');

    // Expense: 3 000 from Продукты.
    await button(page, 'Списать').click();
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('3000');
    await page.getByLabel('Комментарий', { exact: true }).fill('Продукты на неделю');
    await button(page, 'Сохранить списание').click();
    await expect(page.getByText('Списание сохранено.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 47\s000,00/)).toBeVisible();
    await shot(page, testInfo, '02-after-expense');

    const beforeTransfer = await dashboardFromApi(page, '2026-01');
    expect(beforeTransfer.byName('Продукты')).toMatchObject({ replenished: '40000.00', spent: '3000.00', closing: '47000.00' });

    // AC-19: a transfer of 4 000 Продукты → Дом changes two balances only.
    await button(page, 'Перевести').click();
    await radio(page, 'Откуда: Продукты').click();
    await radio(page, 'Куда: Дом').click();
    await page.getByLabel('Сумма', { exact: true }).fill('4000');
    await button(page, 'Сохранить перевод').click();
    await expect(page.getByText('Перевод сохранён.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 43\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 29\s000,00/)).toBeVisible();
    await expect(page.getByText(/^4\s000,00\s₽ \/ 0,00\s₽$/)).toBeVisible();
    await shot(page, testInfo, '03-after-transfer');

    const afterTransfer = await dashboardFromApi(page, '2026-01');
    expect(afterTransfer.byName('Продукты')).toMatchObject({ closing: '43000.00', transfersOut: '4000.00', replenished: '40000.00', spent: '3000.00' });
    expect(afterTransfer.byName('Дом')).toMatchObject({ closing: '29000.00', transfersIn: '4000.00', replenished: '20000.00', spent: '0.00' });
    expect(afterTransfer.summary.replenished).toBe(beforeTransfer.summary.replenished);
    expect(afterTransfer.summary.spent).toBe(beforeTransfer.summary.spent);

    // Adjustment +500 on Дом: balance only; income and free funds stay.
    await button(page, 'Скорректировать').click();
    await radio(page, 'Конверт: Дом').click();
    await page.getByLabel('Сумма', { exact: true }).fill('500');
    await button(page, 'Сохранить корректировку').click();
    await expect(page.getByText('Корректировка сохранена.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 29\s500,00/)).toBeVisible();
    await shot(page, testInfo, '04-after-adjustment');

    const final = await dashboardFromApi(page, '2026-01');
    expect(final.summary.income).toBe('100000.00');
    expect(final.summary.free).toBe('40000.00');
    expect(final.byName('Дом').closing).toBe('29500.00');
  });
});
