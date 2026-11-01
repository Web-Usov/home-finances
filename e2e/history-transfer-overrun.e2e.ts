import { expect, test } from './fixtures/test';
import { getE2eEnv } from './support/env.mjs';
import { button, shot } from './support/ui';

interface OperationDto {
  id: string;
  type: string;
  sequenceNo: number;
  requestedMinor: number;
}

test.describe('history: transfer overrun on edit', () => {
  test('OP-07 / HIST-09 / MSG-03: editing a transfer above the balance at its position shows the overrun error and transfers only the available amount', async ({ page, api }, testInfo) => {
    await api.createMonth('2026-01', '100000.00');
    const home = (await api.createEnvelope('Дом', '10000.00')).envelope;
    const trip = (await api.createEnvelope('Отпуск')).envelope;
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: home.id, amount: '2000.00', comment: 'Ремонт' });
    await api.createOperation('2026-01', { type: 'transfer', sourceEnvelopeId: home.id, destinationEnvelopeId: trip.id, amount: '3000.00' });
    // A later operation also reduces the source: it must not change the balance the transfer is checked against.
    await api.createOperation('2026-01', { type: 'expense', sourceEnvelopeId: home.id, amount: '4000.00', comment: 'Позже' });

    const listOperations = async () => {
      const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/operations?period=2026-01`);
      return ((await res.json()) as { operations: OperationDto[] }).operations;
    };
    const before = await listOperations();
    const transferBefore = before.find((op) => op.type === 'transfer');
    if (!transferBefore) throw new Error('seeded transfer is missing');

    await page.goto('/history');
    await expect(page.getByLabel(/^Операция \d+: Перевод/)).toBeVisible();
    await button(page, `Изменить операцию ${transferBefore.sequenceNo}`).click();
    // Balance at the transfer's position: 10 000 - 2 000 = 8 000; ask for 9 000.
    await page.getByLabel('Сумма', { exact: true }).fill('9000');
    await button(page, 'Сохранить изменения').click();

    // MSG-03 text comes from the server; the offered X is the 409 `available` field.
    await expect(page.getByText(/^Доступно 8\s000,00\s₽\. Перевести только 8\s000,00\s₽\?$/)).toBeVisible();
    await expect(page.getByText('Операция изменена.')).toHaveCount(0);
    const offer = button(page, /^Перевести только 8\s000,00\s₽$/);
    await expect(offer).toBeVisible();
    expect((await listOperations()).find((op) => op.id === transferBefore.id)?.requestedMinor).toBe(300_000); // source amount is not saved
    await shot(page, testInfo, '1-transfer-overrun-error');

    await offer.click();
    await expect(page.getByText('Операция изменена.')).toBeVisible();
    await shot(page, testInfo, '2-transfer-reduced-to-available');

    const after = await listOperations();
    expect(after.map((op) => op.id)).toEqual(before.map((op) => op.id));
    expect(after.map((op) => op.sequenceNo)).toEqual(before.map((op) => op.sequenceNo));
    expect(after.find((op) => op.id === transferBefore.id)).toMatchObject({ sequenceNo: transferBefore.sequenceNo, requestedMinor: 800_000 });
  });
});
