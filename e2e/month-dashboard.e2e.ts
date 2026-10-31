import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { getE2eEnv } from './support/env.mjs';

/** Screenshots are review artifacts: attach them to the report explicitly (the automatic one is only the final state). */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

async function monthsFromApi(page: Page) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/months`);
  const body = (await res.json()) as { months: { period: string; status: string; incomeMinor: number }[] };
  return body.months;
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('month dashboard', { tag: '@smoke' }, () => {
  test('AC-01 / AC-14 / AC-16: first month, income, next-month draft, close', async ({ page }, testInfo) => {
    await page.goto('/month');

    // Empty state: no months yet (SCOPE-23).
    await expect(page.getByText('Начните с первого месяца')).toBeVisible();
    await shot(page, testInfo, '1-empty-state');

    // AC-01: first month with income through the UI; it becomes "Открыт" (MON-05).
    await page.getByLabel('Первый месяц').fill('2026-01');
    await page.getByLabel('Доход месяца').fill('100000');
    await button(page, 'Создать месяц').click();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await expect(page.getByLabel('Статус месяца: Открыт')).toBeVisible();
    await expect(page.getByLabel(/^Доход: 100\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 100\s000,00/)).toBeVisible();
    await shot(page, testInfo, '2-open-month');

    // UI-02: change the income; the dashboard shows the value recalculated by the API.
    await button(page, 'Изменить доход').click();
    await page.getByLabel('Доход месяца').fill('120000,50');
    await button(page, 'Сохранить доход').click();
    await expect(page.getByLabel(/^Доход: 120\s000,50/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 120\s000,50/)).toBeVisible();
    expect((await monthsFromApi(page))[0]).toMatchObject({ period: '2026-01', incomeMinor: 12_000_050 });

    // AC-16 / MON-07: next month is created as a draft; a draft cannot be closed.
    await button(page, 'Создать следующий').click();
    await expect(page.getByText('Создан черновик: Февраль 2026.')).toBeVisible();
    await expect(button(page, 'Создать следующий')).toBeDisabled();
    await button(page, 'Следующий месяц').click();
    await expect(page.getByRole('heading', { name: 'Февраль 2026' })).toBeVisible();
    await expect(page.getByLabel('Статус месяца: Черновик')).toBeVisible();
    await expect(button(page, 'Закрыть')).toBeDisabled();
    await expect(button(page, 'Списать')).toBeEnabled();
    await shot(page, testInfo, '3-draft-month');

    // MON-08 / AC-14: closing the open month promotes the draft and locks the closed month.
    await button(page, 'Предыдущий месяц').click();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await button(page, 'Закрыть').click();
    await expect(page.getByText('Месяц Январь 2026 закрыт. Месяц Февраль 2026 теперь открыт.')).toBeVisible();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();
    await expect(page.getByText('Месяц закрыт. Откройте его повторно, чтобы внести изменения.')).toBeVisible();
    for (const name of ['Списать', 'Перевести', 'Скорректировать', 'Изменить доход', 'Закрыть']) {
      await expect(button(page, name)).toBeDisabled();
    }
    await shot(page, testInfo, '4-closed-month');

    const statuses = (await monthsFromApi(page)).map((m) => `${m.period}:${m.status}`);
    expect(statuses).toEqual(['2026-01:closed', '2026-02:open']);
  });

  test('AC-15 / MON-12: reopen a closed month after confirmation and show the recalculated range', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createMonth('2026-02', '50000.00');
    await api.closeMonth('2026-01');

    await page.goto('/month');
    // Working month first (open), then step back to the closed one.
    await expect(page.getByRole('heading', { name: 'Февраль 2026' })).toBeVisible();
    await button(page, 'Предыдущий месяц').click();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();

    await button(page, 'Открыть повторно').click();
    await expect(page.getByText('Открыть Январь 2026 повторно?')).toBeVisible();
    await shot(page, testInfo, '5-reopen-confirmation');

    await button(page, 'Подтвердить повторное открытие').click();
    await expect(page.getByLabel('Статус месяца: Открыт повторно')).toBeVisible();
    await expect(page.getByText('Месяц открыт повторно. Пересчитаны месяцы с Январь 2026 по Февраль 2026.')).toBeVisible();
    await expect(button(page, 'Списать')).toBeEnabled();
    await expect(button(page, 'Открыть повторно')).toBeDisabled();
    await shot(page, testInfo, '6-reopened-month');

    expect((await monthsFromApi(page)).map((m) => m.status)).toEqual(['reopened', 'open']);
  });
});

test.describe('month dashboard layout', () => {
  test('NFR-20: no horizontal scroll at 360 px', async ({ page, api }) => {
    await api.createMonth('2026-01', '100000.00');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/month');
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();

    const overflow = await page.evaluate<number>('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
