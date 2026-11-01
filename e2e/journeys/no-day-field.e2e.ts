import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { button, radio, shot } from '../support/ui';

/** AC-21: a financial date is a month everywhere; no day/date input or visible full date exists on the open form. */
async function expectNoDayField(page: Page, where: string) {
  await expect(page.locator('input[type="date"], input[type="datetime-local"], input[type="time"]'), `${where}: date input`).toHaveCount(0);
  await expect(page.getByLabel(/день|дата|число|\bday\b|\bdate\b/i), `${where}: day label`).toHaveCount(0);
  await expect(page.getByPlaceholder(/день|дата|ДД|\bDD\b/i), `${where}: day placeholder`).toHaveCount(0);
  const text = await page.locator('body').innerText();
  expect(text, `${where}: full date shown`).not.toMatch(/\b\d{1,2}\.\d{1,2}\.\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);
}

test.describe('journey: month-only dates', () => {
  test('AC-21: no day field in any user form', async ({ page, api }, testInfo) => {
    await page.goto('/month');
    await expect(page.getByText('Начните с первого месяца')).toBeVisible();
    await expectNoDayField(page, 'first month form');
    await page.getByLabel('Первый месяц').fill('2026-01');
    await page.getByLabel('Доход месяца').fill('100000');
    await button(page, 'Создать месяц').click();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();

    await api.createEnvelope('Продукты', '10000.00');
    await api.createEnvelope('Дом');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await expectNoDayField(page, 'dashboard');

    await button(page, 'Изменить доход').click();
    await expect(page.getByLabel('Доход месяца')).toBeVisible();
    await expectNoDayField(page, 'income form');
    await button(page, 'Отмена').click();

    await button(page, 'Изменить распределение').click();
    await expect(page.getByLabel('Доход для распределения')).toBeVisible();
    await expectNoDayField(page, 'allocation editor');
    await button(page, 'Закрыть редактор').click();

    for (const [action, radioName] of [['Списать', 'Конверт: Продукты'], ['Перевести', 'Откуда: Продукты'], ['Скорректировать', 'Конверт: Продукты']] as const) {
      await button(page, action).click();
      await expect(radio(page, radioName)).toBeVisible();
      await expect(page.getByText('Месяц: Январь 2026')).toBeVisible();
      await expectNoDayField(page, `${action} form`);
      if (action === 'Списать') await shot(page, testInfo, '01-expense-form-month-only');
      await button(page, 'Закрыть форму операции').click();
    }

    await button(page, 'Создать следующий').click();
    await expect(page.getByText('Черновик февраля 2026 создан.')).toBeVisible();
    await button(page, 'Закрыть').click();
    await expect(page.getByLabel('Статус месяца: Закрыт')).toBeVisible();
    await button(page, 'Открыть повторно').click();
    await expect(button(page, 'Подтвердить повторное открытие')).toBeVisible();
    await expectNoDayField(page, 'reopen confirmation');
    await button(page, 'Отмена').click();

    await page.getByRole('tablist').getByRole('link', { name: 'Конверты' }).click();
    await page.getByText('Создать конверт').click();
    await expect(page.getByPlaceholder('Напр. Продукты')).toBeVisible();
    await expectNoDayField(page, 'envelope create form');
    await page.getByText('Отмена', { exact: true }).click();
    await page.getByText('Переименовать', { exact: true }).first().click();
    await expectNoDayField(page, 'envelope rename form');
  });

  test('AC-21: no day field in history rows or the operation edit form', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '10000.00');
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: envelope.id, amount: '1000.00', comment: 'Покупка' });

    await page.goto('/history');
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    await expect(page.getByLabel(/^Операция \d+: Списание/)).toContainText('Покупка');
    await expectNoDayField(page, 'history list');
    await page.getByRole('button', { name: /^Изменить операцию/ }).first().click();
    await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeVisible();
    await expectNoDayField(page, 'operation edit form');
    await shot(page, testInfo, '02-history-edit-form-month-only');
  });
});
