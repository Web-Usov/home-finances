import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures/test';

/** Screenshots are review artifacts: attach them to the report explicitly. */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  // The app scrolls inside its own container, so a full-page shot would only show the top: callers scroll first.
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

const YEAR = 2026;
const JAN = `${YEAR}-01`;

test.describe('analytics', { tag: '@smoke' }, () => {
  test('AC-20 / REP-01 / REP-10: three yearly reports; an uncovered value opens the matching history rows', async ({ page, api }, testInfo) => {
    await api.createMonth(JAN, '100000.00');
    const { envelope } = await api.createEnvelope('Продукты', '1000.00');
    await api.createEnvelope('Отпуск', '5000.00');
    await api.createMonth(`${YEAR}-02`);
    await api.createOperation(JAN, { type: 'expense', sourceEnvelopeId: envelope.id, amount: '3000.00', comment: 'Большая покупка' });

    await page.goto(`/analytics?year=${YEAR}`);
    await expect(page.getByRole('heading', { name: String(YEAR), exact: true })).toBeVisible();

    // Report 1: income / allocated / free by month, totals.
    await expect(page.getByRole('heading', { name: 'Доход и распределение' })).toBeVisible();
    const income = page.getByLabel(`Доход, Январь ${YEAR}`);
    await expect(income).toContainText(/100\s000,00/);
    // MON-17: February (created without income) copies January's 100 000, so the year total is 200 000.
    await expect(page.getByLabel(`Доход, Февраль ${YEAR}`)).toContainText(/100\s000,00/);
    await expect(page.getByLabel('Доход, итого за год')).toContainText(/200\s000,00/);
    await expect(page.getByLabel(`Доход, Март ${YEAR}`)).toContainText('—');

    // Report 2: envelope balances; months without the envelope are "—".
    await expect(page.getByRole('heading', { name: 'Балансы конвертов' })).toBeVisible();
    const balances = page.getByLabel('Продукты', { exact: true });
    await expect(balances).toContainText('—');

    // Report 3: uncovered operations.
    await expect(page.getByRole('heading', { name: 'Непокрытые операции' })).toBeVisible();
    await expect(page.getByLabel(`Непокрытые, Январь ${YEAR}`)).toContainText(/2\s000,00/);
    // REP-10: the per-envelope breakdown links with the envelope filter.
    await expect(page.getByLabel(`Непокрытые по конверту, Январь ${YEAR}, Продукты`)).toContainText(/2\s000,00/);

    // REP-07: line chart with an envelope picker (multi-select); legend lists the picked envelopes.
    const chart = page.getByTestId('balance-chart');
    const legend = page.getByTestId('balance-legend');
    await expect(chart.locator('[data-testid^="balance-series-"]')).toHaveCount(2);
    await expect(legend).toContainText('Продукты');
    await expect(legend).toContainText('Отпуск');
    await shot(page, testInfo, '1-analytics-income-report');
    await page.getByRole('heading', { name: 'Балансы конвертов' }).scrollIntoViewIfNeeded();
    await shot(page, testInfo, '2-analytics-balances-chart-both');
    await page.getByRole('checkbox', { name: 'График: Продукты' }).click();
    await expect(chart.locator('[data-testid^="balance-series-"]')).toHaveCount(1);
    await expect(legend).not.toContainText('Продукты');
    await expect(legend).toContainText('Отпуск');
    await shot(page, testInfo, '3-analytics-chart-picker');
    await page.getByRole('heading', { name: 'Непокрытые операции' }).scrollIntoViewIfNeeded();
    await shot(page, testInfo, '4-analytics-uncovered');

    // 360 px: no page-level horizontal scroll (NFR-20) and adjacent table cells never overlap.
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
    for (const table of ['Доход, распределение и свободные средства по месяцам', 'Непокрытые операции по месяцам и типам', 'Балансы конвертов по месяцам']) {
      const rows = page.getByRole('table', { name: table }).getByRole('row');
      for (let r = 0; r < Math.min(await rows.count(), 4); r++) {
        const cells = rows.nth(r).locator('[role="cell"], [role="columnheader"], [role="rowheader"]');
        const boxes = [];
        for (let c = 0; c < (await cells.count()); c++) boxes.push(await cells.nth(c).boundingBox());
        for (let c = 1; c < boxes.length; c++) {
          const prev = boxes[c - 1];
          const cur = boxes[c];
          if (!prev || !cur) throw new Error(`cell without a box in ${table}`);
          expect(cur.x, `${table}: row ${r} cell ${c} overlaps the previous one`).toBeGreaterThanOrEqual(prev.x + prev.width - 0.5);
        }
      }
    }
    await page.getByRole('heading', { name: 'Доход и распределение' }).scrollIntoViewIfNeeded();
    await shot(page, testInfo, '5-analytics-360px-income');
    await page.getByRole('heading', { name: 'Балансы конвертов' }).scrollIntoViewIfNeeded();
    await shot(page, testInfo, '6-analytics-360px-balances');

    // REP-10: drill-down to the history rows behind the number.
    await page.getByRole('link', { name: new RegExp(`^Январь ${YEAR}, списания`) }).click();
    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByRole('heading', { name: `Январь ${YEAR}` })).toBeVisible();
    await expect(page.getByLabel(/^Операция \d+: Списание/)).toContainText('Большая покупка');
    await shot(page, testInfo, '7-analytics-drilldown-history');

    // The shared period switcher keeps its title on one line at 360 px.
    const title = page.getByRole('heading', { name: `Январь ${YEAR}` });
    expect((await title.boundingBox())?.height ?? 99).toBeLessThan(28);
  });
});
