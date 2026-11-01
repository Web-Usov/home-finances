import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { getE2eEnv } from './support/env.mjs';

/** Screenshots are review artifacts: attach them to the report explicitly (the automatic one is only the final state). */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

async function allocatedMinorFromApi(page: Page, period: string) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/dashboard/monthly?period=${period}`);
  const body = (await res.json()) as { envelopes: { name: string; replenished: string }[]; summary: { allocated: string } };
  return body;
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('allocation editor', { tag: '@smoke' }, () => {
  test('AC-02 / AC-03 / AC-04: live free funds, overflow blocks save, saved allocation updates the dashboard and is copied', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    await api.createEnvelope('Продукты');
    await api.createEnvelope('Дом');

    await page.goto('/month');
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 100\s000,00/)).toBeVisible();

    // UI-11: one field per active envelope plus the income.
    await button(page, 'Изменить распределение').click();
    await expect(page.getByLabel('Доход для распределения')).toHaveValue('100000,00');
    await page.getByLabel('Распределение: Продукты').fill('50000');
    await page.getByLabel('Распределение: Дом').fill('25000');

    // AC-02 / UI-13: 75 000 of 100 000 leaves 25 000 free while typing.
    await expect(page.getByLabel(/^Распределено в редакторе: 75\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно в редакторе: 25\s000,00/)).toBeVisible();
    await shot(page, testInfo, '1-editor-normal');

    // AC-03 / UI-14 / MSG-01: 100 000,01 is refused with the exact excess.
    await page.getByLabel('Распределение: Продукты').fill('75000,01');
    await expect(page.getByText(/Распределено на 0,01\s₽ больше дохода\. Уменьшите суммы по конвертам\./)).toBeVisible();
    await expect(button(page, 'Сохранить распределение')).toBeDisabled();
    await shot(page, testInfo, '2-editor-overflow');
    expect((await allocatedMinorFromApi(page, '2026-01')).summary.allocated).toBe('0.00');

    // Fix the amount: the block disappears and the save goes through.
    await page.getByLabel('Распределение: Продукты').fill('50000');
    await expect(button(page, 'Сохранить распределение')).toBeEnabled();
    await button(page, 'Сохранить распределение').click();

    // The dashboard shows what the API stored.
    await expect(button(page, 'Сохранить распределение')).toHaveCount(0);
    await expect(page.getByLabel(/^Распределено: 75\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 25\s000,00/)).toBeVisible();
    await shot(page, testInfo, '3-dashboard-after-save');
    const saved = await allocatedMinorFromApi(page, '2026-01');
    expect(saved.summary.allocated).toBe('75000.00');
    expect(saved.envelopes.map((e) => `${e.name}:${e.replenished}`).sort()).toEqual(['Дом:25000.00', 'Продукты:50000.00']);

    // AC-04: the next month starts from the previous allocation as editable values.
    await button(page, 'Создать следующий').click();
    await expect(page.getByText('Черновик февраля 2026 создан.')).toBeVisible();
    await button(page, 'Следующий месяц').click();
    await expect(page.getByRole('heading', { name: 'Февраль 2026' })).toBeVisible();
    // FIN-11: free funds are signed on the dashboard (income 0, allocated 75 000).
    await expect(page.getByLabel(/^Свободно: −75\s000,00/)).toBeVisible();
    await button(page, 'Изменить распределение').click();
    await expect(page.getByLabel('Распределение: Продукты')).toHaveValue('50000,00');
    await expect(page.getByLabel('Распределение: Дом')).toHaveValue('25000,00');
    // The draft has no income yet, so the copied 75 000 overflow: the editor shows it and blocks the save.
    await expect(page.getByText(/Распределено на 75\s000,00\s₽ больше дохода\./)).toBeVisible();
    await expect(page.getByLabel(/^Свободно в редакторе: −75\s000,00/)).toBeVisible();
    await expect(button(page, 'Сохранить распределение')).toBeDisabled();
    await shot(page, testInfo, '4-copied-allocation-overflow');

    // Income and allocation are edited together; one request carries both, so the API stores them atomically (FIN-02).
    await page.getByLabel('Доход для распределения').fill('90000');
    await page.getByLabel('Распределение: Дом').fill('20000');
    await expect(page.getByLabel(/^Свободно в редакторе: 20\s000,00/)).toBeVisible();
    await shot(page, testInfo, '5-copied-allocation-edited');
    await button(page, 'Сохранить распределение').click();
    await expect(button(page, 'Сохранить распределение')).toHaveCount(0);
    await expect(page.getByLabel(/^Доход: 90\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Распределено: 70\s000,00/)).toBeVisible();
    await expect(page.getByLabel(/^Свободно: 20\s000,00/)).toBeVisible();
    expect((await allocatedMinorFromApi(page, '2026-02')).summary.allocated).toBe('70000.00');
  });
});
