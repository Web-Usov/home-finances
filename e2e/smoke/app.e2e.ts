import { expect, test } from '../fixtures/test';
import { getE2eEnv } from '../support/env.mjs';

const TABS = ['Месяц', 'История', 'Аналитика', 'Конверты'];

test.describe('app shell', { tag: '@smoke' }, () => {
  test('opens and switches between the four tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/month$/);

    const tabBar = page.getByRole('tablist');
    for (const title of TABS) {
      await expect(tabBar.getByRole('link', { name: title })).toBeVisible();
    }
    const routes: Record<string, RegExp> = {
      История: /\/history$/,
      Аналитика: /\/analytics$/,
      Конверты: /\/envelopes$/,
      Месяц: /\/month$/,
    };
    for (const [title, url] of Object.entries(routes)) {
      await tabBar.getByRole('link', { name: title }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('creates an envelope through the UI and lists it (real API)', async ({ page, api }) => {
    await api.createMonth('2026-01');
    await page.goto('/envelopes');
    await expect(page.getByText('Активных конвертов нет')).toBeVisible();

    await page.getByText('Создать конверт').click();
    await page.getByPlaceholder('Напр. Продукты').fill('Продукты');
    await page.getByPlaceholder('0.00').fill('1500');
    await page.getByText('Создать', { exact: true }).click();

    await expect(page.getByText('Продукты')).toBeVisible();
    await expect(page.getByText('Активных конвертов нет')).toBeHidden();

    // The envelope really exists in the backend, not just in client state.
    const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/envelopes`);
    const body = (await res.json()) as { envelopes: { name: string }[] };
    expect(body.envelopes.map((e) => e.name)).toContain('Продукты');
  });

  test('shows an envelope created via the API', async ({ page, api }) => {
    await api.createMonth('2026-01');
    await api.createEnvelope('Транспорт', '200.00');
    await page.goto('/envelopes');
    await expect(page.getByText('Транспорт')).toBeVisible();
  });
});
