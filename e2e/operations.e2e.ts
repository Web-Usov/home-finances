import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { getE2eEnv } from './support/env.mjs';

/** Screenshots are review artifacts: attach them to the report explicitly (the automatic one is only the final state). */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

interface DashboardEnvelopeDto {
  name: string;
  closing: string;
  spent: string;
  expensesCovered: string;
  adjustmentApplied: string;
  transfersIn: string;
  transfersOut: string;
  uncovered: { total: string };
}

async function dashboardFromApi(page: Page, period: string) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/dashboard/monthly?period=${period}`);
  const body = (await res.json()) as { envelopes: DashboardEnvelopeDto[]; summary: { income: string; free: string } };
  const byName = (name: string) => {
    const found = body.envelopes.find((e) => e.name === name);
    if (!found) throw new Error(`envelope ${name} is not on the dashboard`);
    return found;
  };
  return { ...body, byName };
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

test.describe('operation forms', { tag: '@smoke' }, () => {
  test('AC-05 / AC-21: expense within the balance reduces it and the form has no day field', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты', '10000.00');

    await page.goto('/month');
    await expect(page.getByLabel(/^Остаток: 10\s000,00/)).toBeVisible();

    await button(page, 'Списать').click();
    // AC-21: the month is fixed, there is no day or date input.
    await expect(page.getByText('Месяц: Январь 2026')).toBeVisible();
    await expect(page.getByLabel(/день|дата|число/i)).toHaveCount(0);
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('3000');
    await page.getByLabel('Комментарий', { exact: true }).fill('Продукты на неделю');
    await expect(page.getByText(/будет отмечена как непокрытая/)).toHaveCount(0);
    await shot(page, testInfo, '1-expense-form');
    await button(page, 'Сохранить списание').click();

    await expect(page.getByText('Списание сохранено.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 7\s000,00/)).toBeVisible();
    const dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Продукты')).toMatchObject({ closing: '7000.00', expensesCovered: '3000.00' });
    expect(dashboard.byName('Продукты').uncovered.total).toBe('0.00');
    await shot(page, testInfo, '2-expense-saved');
  });

  test('AC-06 / MSG-02: expense above the balance warns, is saved in full and shows the uncovered part', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты', '10000.00');

    await page.goto('/month');
    await button(page, 'Списать').click();
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('15000');

    await expect(page.getByText(/В конверте доступно 10\s000,00\s₽\./)).toBeVisible();
    await expect(button(page, 'Сохранить списание')).toHaveCount(0);
    await shot(page, testInfo, '3-expense-warning');
    await button(page, 'Всё равно сохранить').click();

    await expect(page.getByText('Списание сохранено.')).toBeVisible();
    // The uncovered part is the API's answer (warning after the save and the envelope row).
    await expect(page.getByText(/В конверте доступно 10\s000,00\s₽\. 5\s000,00\s₽ будут отмечены как непокрытые\./)).toBeVisible();
    await expect(page.getByText(/^Не покрыто: 5\s000,00/)).toBeVisible();
    const dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Продукты')).toMatchObject({ closing: '0.00', spent: '15000.00', expensesCovered: '10000.00' });
    expect(dashboard.byName('Продукты').uncovered.total).toBe('5000.00');
    await shot(page, testInfo, '4-expense-saved-uncovered');
  });

  test('AC-07 / MSG-03: transfer above the available amount is refused, one click transfers only the available amount', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Дом', '6000.00');
    await api.createEnvelope('Отпуск');

    await page.goto('/month');
    await button(page, 'Перевести').click();
    await radio(page, 'Откуда: Дом').click();
    await radio(page, 'Куда: Отпуск').click();
    await page.getByLabel('Сумма', { exact: true }).fill('10000,00');
    await button(page, 'Сохранить перевод').click();

    // Not saved: the API refuses and the form offers the available amount.
    await expect(page.getByText(/Доступно 6\s000,00\s₽\. Перевести только 6\s000,00\s₽\?/)).toBeVisible();
    await shot(page, testInfo, '5-transfer-refused');
    let dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Дом').closing).toBe('6000.00');
    expect(dashboard.byName('Отпуск').closing).toBe('0.00');

    await page.getByRole('button', { name: /^Перевести только 6\s000,00/ }).click();
    await expect(page.getByText('Перевод сохранён.')).toBeVisible();
    dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Дом')).toMatchObject({ closing: '0.00', transfersOut: '6000.00' });
    expect(dashboard.byName('Отпуск')).toMatchObject({ closing: '6000.00', transfersIn: '6000.00' });
    await shot(page, testInfo, '6-transfer-replaced');
  });

  test('AC-09 / AC-10 / MSG-04: adjustments change the balance, a negative one above it is applied down to zero', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Подушка', '10000.00');

    await page.goto('/month');
    // AC-09: +5 000 raises the balance and leaves income and free funds untouched.
    const before = await dashboardFromApi(page, '2026-01');
    await button(page, 'Скорректировать').click();
    await radio(page, 'Конверт: Подушка').click();
    await page.getByLabel('Сумма', { exact: true }).fill('5000');
    await shot(page, testInfo, '7-adjustment-form');
    await button(page, 'Сохранить корректировку').click();
    await expect(page.getByText('Корректировка сохранена.')).toBeVisible();
    await expect(page.getByLabel(/^Остаток: 15\s000,00/)).toBeVisible();
    let dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Подушка')).toMatchObject({ closing: '15000.00', adjustmentApplied: '5000.00' });
    expect(dashboard.summary.income).toBe(before.summary.income);
    expect(dashboard.summary.free).toBe(before.summary.free);

    // AC-10: −25 000 at balance 15 000 → balance 0, applied −15 000, uncovered 10 000.
    await button(page, 'Скорректировать').click();
    await radio(page, 'Конверт: Подушка').click();
    await radio(page, 'Уменьшить').click();
    await page.getByLabel('Сумма', { exact: true }).fill('25000');
    await expect(page.getByText(/Баланс станет 0,00\s₽/)).toBeVisible();
    await shot(page, testInfo, '8-negative-adjustment-warning');
    await button(page, 'Всё равно сохранить').click();
    await expect(page.getByText('Корректировка сохранена.')).toBeVisible();
    await expect(page.getByText(/Баланс станет 0\s₽, 10\s000,00\s₽ будут отмечены как непокрытые\./)).toBeVisible();
    dashboard = await dashboardFromApi(page, '2026-01');
    expect(dashboard.byName('Подушка')).toMatchObject({ closing: '0.00', adjustmentApplied: '-10000.00' });
    expect(dashboard.byName('Подушка').uncovered.total).toBe('10000.00');
    await shot(page, testInfo, '9-negative-adjustment-saved');
  });

  test('UI-16 / MSG-06: the form writes to the displayed (draft) month; a closed month disables the actions', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты', '10000.00');
    await api.createMonth('2026-02');

    await page.goto('/month');
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await button(page, 'Следующий месяц').click();
    await expect(page.getByLabel('Статус месяца: Черновик')).toBeVisible();

    await button(page, 'Списать').click();
    await expect(page.getByText('Месяц: Февраль 2026')).toBeVisible();
    await radio(page, 'Конверт: Продукты').click();
    await page.getByLabel('Сумма', { exact: true }).fill('1000');
    await button(page, 'Сохранить списание').click();
    await expect(page.getByText('Списание сохранено.')).toBeVisible();

    // The operation went to February (the displayed draft), not to the working month.
    const february = await dashboardFromApi(page, '2026-02');
    expect(february.byName('Продукты')).toMatchObject({ spent: '1000.00' });
    const january = await dashboardFromApi(page, '2026-01');
    expect(january.byName('Продукты')).toMatchObject({ spent: '0.00' });
    await shot(page, testInfo, '10-draft-month-expense');

    await button(page, 'Предыдущий месяц').click();
    await button(page, 'Закрыть').click();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();
    for (const name of ['Списать', 'Перевести', 'Скорректировать']) {
      await expect(button(page, name)).toBeDisabled();
    }
    await shot(page, testInfo, '11-closed-month-disabled');
  });
});
