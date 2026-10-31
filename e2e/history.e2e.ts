import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';
import { getE2eEnv } from './support/env.mjs';

/** Screenshots are review artifacts: attach them to the report explicitly. */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

interface DashboardEnvelopeDto {
  name: string;
  closing: string;
  spent: string;
  uncovered: { total: string };
}

async function envelopeFromApi(page: Page, period: string, name: string) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/dashboard/monthly?period=${period}`);
  const body = (await res.json()) as { envelopes: DashboardEnvelopeDto[] };
  const found = body.envelopes.find((e) => e.name === name);
  if (!found) throw new Error(`envelope ${name} is not on the dashboard`);
  return found;
}

async function operationsFromApi(page: Page, period: string) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/operations?period=${period}`);
  const body = (await res.json()) as { operations: { comment: string | null; sequenceNo: number; requestedMinor: number; type: string }[] };
  return body.operations.filter((op) => op.type !== 'initial_balance');
}

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name });
const row = (page: Page, text: string) => page.getByLabel(/^Операция \d+:/).filter({ hasText: text });

test.describe('history', { tag: '@smoke' }, () => {
  test('AC-12 / AC-13 / HIST-11: editing keeps the position, deleting recalculates the balance', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '10000.00');
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: envelope.id, amount: '1000.00', comment: 'Первая' });
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: envelope.id, amount: '2000.00', comment: 'Вторая' });

    await page.goto('/history');
    await expect(page.getByRole('heading', { name: 'Январь 2026' })).toBeVisible();
    const expenses = page.getByLabel(/^Операция \d+: Списание/);
    await expect(expenses).toHaveCount(2);
    await expect(expenses.nth(0)).toContainText('Первая');
    await expect(expenses.nth(1)).toContainText('Вторая');
    await shot(page, testInfo, '1-history-list');

    // AC-12: editing the first operation does not move it to the end.
    const before = await operationsFromApi(page, '2026-01');
    await button(page, /^Изменить операцию/).first().click();
    await page.getByLabel('Сумма', { exact: true }).fill('1500');
    await page.getByLabel('Комментарий', { exact: true }).fill('Первая (исправлено)');
    await shot(page, testInfo, '2-history-edit-form');
    await button(page, 'Сохранить изменения').click();
    await expect(page.getByText('Операция изменена.')).toBeVisible();
    await expect(expenses.nth(0)).toContainText('Первая (исправлено)');
    await expect(expenses.nth(0)).toContainText(/1\s500,00/);
    await expect(expenses.nth(1)).toContainText('Вторая');
    const after = await operationsFromApi(page, '2026-01');
    expect(after.map((op) => op.sequenceNo)).toEqual(before.map((op) => op.sequenceNo));
    expect(after[0]).toMatchObject({ comment: 'Первая (исправлено)', requestedMinor: 150_000 });
    expect((await envelopeFromApi(page, '2026-01', 'Продукты')).closing).toBe('6500.00');
    await shot(page, testInfo, '3-history-edited');

    // AC-13: deleting recalculates the balance at once.
    await button(page, /^Удалить операцию/).nth(1).click();
    await expect(page.getByText(/Удалить операцию № \d+\?/)).toBeVisible();
    await shot(page, testInfo, '4-history-delete-confirm');
    await button(page, 'Подтвердить удаление').click();
    await expect(page.getByText('Операция удалена.')).toBeVisible();
    await expect(expenses).toHaveCount(1);
    await expect(row(page, 'Вторая')).toHaveCount(0);
    expect((await envelopeFromApi(page, '2026-01', 'Продукты')).closing).toBe('8500.00');
    await shot(page, testInfo, '5-history-deleted');
  });

  test('AC-08 / HIST-11 / OP-08: a transfer left uncovered by an earlier edit is highlighted; filters narrow the list', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const home = (await api.createEnvelope('Дом', '10000.00')).envelope;
    const trip = (await api.createEnvelope('Отпуск')).envelope;
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: home.id, amount: '1000.00', comment: 'Ремонт' });
    await api.createOperation('2026-01', { type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: trip.id, amount: '9000.00' });

    await page.goto('/history');
    await expect(page.getByLabel(/^Операция \d+: Перевод/)).toBeVisible();
    await expect(page.getByText(/Не покрыто/)).toHaveCount(0);

    // Raising the earlier expense leaves 5 000 for the transfer: it stays 9 000 and 4 000 is uncovered (OP-08).
    await button(page, /^Изменить операцию/).first().click();
    await page.getByLabel('Сумма', { exact: true }).fill('5000');
    await button(page, 'Сохранить изменения').click();
    await expect(page.getByText('Операция изменена.')).toBeVisible();
    const transfer = page.getByLabel(/^Операция \d+: Перевод/);
    await expect(transfer).toContainText(/9\s000,00/);
    await expect(transfer).toContainText(/Покрыто: 5\s000,00/);
    await expect(transfer).toContainText(/⚠ Не покрыто: 4\s000,00/);
    await shot(page, testInfo, '6-history-uncovered-transfer');

    // UI-03: the type filter narrows the list.
    await page.getByRole('radio', { name: 'Тип: Переводы', exact: true }).click();
    await expect(page.getByLabel(/^Операция \d+: Списание/)).toHaveCount(0);
    await expect(transfer).toBeVisible();
    await shot(page, testInfo, '7-history-filtered');
  });

  test('HIST-10 / MSG-06 / OP-10: a closed month is read-only; the initial balance has no edit buttons', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '10000.00');
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: envelope.id, amount: '1000.00', comment: 'Первая' });

    await page.goto('/history');
    await expect(button(page, /^Изменить операцию/)).toHaveCount(1); // the expense only, not the initial balance
    await expect(page.getByLabel(/^Операция \d+: Стартовый остаток/)).toBeVisible();

    await api.closeMonth('2026-01');
    await page.reload();
    await expect(page.getByText('Месяц закрыт. Откройте его повторно, чтобы внести изменения.')).toBeVisible();
    await expect(row(page, 'Первая')).toBeVisible();
    await expect(button(page, /^Изменить операцию/)).toHaveCount(0);
    await expect(button(page, /^Удалить операцию/)).toHaveCount(0);
    await shot(page, testInfo, '8-history-closed-read-only');
  });
});
