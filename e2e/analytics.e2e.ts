import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';

/** Screenshots are review artifacts: attach them to the report explicitly. */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

const YEAR = new Date().getFullYear();
const JAN = `${YEAR}-01`;

test.describe('analytics', { tag: '@smoke' }, () => {
  test('AC-20 / REP-01 / REP-10: three yearly reports; an uncovered value opens the matching history rows', async ({ page, api }, testInfo) => {
    await api.createMonth(JAN, '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '1000.00');
    await api.createOperation(JAN, { type: 'expense', sourceEnvelopeId: envelope.id, amount: '3000.00', comment: 'Большая покупка' });

    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: String(YEAR), exact: true })).toBeVisible();

    // Report 1: income / allocated / free by month, totals.
    await expect(page.getByRole('heading', { name: 'Доход и распределение' })).toBeVisible();
    const income = page.getByLabel(`Доход, Январь ${YEAR}`);
    await expect(income).toContainText(/100\s000,00/);
    await expect(page.getByLabel('Доход, итого за год')).toContainText(/100\s000,00/);
    await expect(page.getByLabel(`Доход, Март ${YEAR}`)).toContainText('—');

    // Report 2: envelope balances; months without the envelope are "—".
    await expect(page.getByRole('heading', { name: 'Балансы конвертов' })).toBeVisible();
    const balances = page.getByLabel('Продукты', { exact: true });
    await expect(balances).toContainText('—');

    // Report 3: uncovered operations.
    await expect(page.getByRole('heading', { name: 'Непокрытые операции' })).toBeVisible();
    await expect(page.getByLabel(`Непокрытые, Январь ${YEAR}`)).toContainText(/2\s000,00/);
    await shot(page, testInfo, '1-analytics-three-reports');

    // 360 px: no page-level horizontal scroll (NFR-20).
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
    await shot(page, testInfo, '2-analytics-360px');

    // REP-10: drill-down to the history rows behind the number.
    await page.getByRole('link', { name: new RegExp(`^Январь ${YEAR}, списания`) }).click();
    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByRole('heading', { name: `Январь ${YEAR}` })).toBeVisible();
    await expect(page.getByLabel(/^Операция \d+: Списание/)).toContainText('Большая покупка');
    await shot(page, testInfo, '3-analytics-drilldown-history');
  });
});
