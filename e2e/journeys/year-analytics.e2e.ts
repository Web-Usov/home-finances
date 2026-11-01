import { expect, test } from '../fixtures/test';
import { shot } from '../support/ui';

const YEAR = 2026;
const period = (m: number) => `${YEAR}-${String(m).padStart(2, '0')}`;

test.describe('journey: analytics after the year', () => {
  test('AC-20 / REP-01: twelve months lived through, the yearly reports sum them up', async ({ page, api }, testInfo) => {
    await api.createMonth(period(1), '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '1000.00');
    await api.createOperation(period(1), { type: 'expense', sourceEnvelopeId: envelope.id, amount: '3000.00', comment: 'Январь' });
    for (let m = 2; m <= 12; m++) {
      await api.createMonth(period(m), '100000.00');
      await api.closeMonth(period(m - 1));
    }
    await api.createOperation(period(12), { type: 'expense', sourceEnvelopeId: envelope.id, amount: '500.00', comment: 'Декабрь' });
    await api.closeMonth(period(12));

    await page.goto(`/analytics?year=${YEAR}`);
    await expect(page.getByRole('heading', { name: String(YEAR), exact: true })).toBeVisible();

    await expect(page.getByLabel(`Доход, Январь ${YEAR}`)).toContainText(/100\s000,00/);
    await expect(page.getByLabel(`Доход, Декабрь ${YEAR}`)).toContainText(/100\s000,00/);
    await expect(page.getByLabel('Доход, итого за год')).toContainText(/1\s200\s000,00/);
    await expect(page.getByLabel(`Непокрытые, Январь ${YEAR}`)).toContainText(/2\s000,00/);
    await expect(page.getByLabel(`Непокрытые, Декабрь ${YEAR}`)).toContainText(/500,00/);
    await shot(page, testInfo, '01-year-income-report');
    await page.getByRole('heading', { name: 'Непокрытые операции' }).scrollIntoViewIfNeeded();
    await shot(page, testInfo, '02-year-uncovered-report');
  });
});
