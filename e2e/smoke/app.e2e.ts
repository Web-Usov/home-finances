import type { EnvelopeDto } from '../fixtures/api';
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
    const body = (await res.json()) as { envelopes: { name: string; balanceMinor: number }[] };
    expect(body.envelopes.map((e) => e.name)).toContain('Продукты');
    // ENV-03 / OP-10: the initial balance typed in the form is persisted as the balance.
    expect(body.envelopes.find((e) => e.name === 'Продукты')?.balanceMinor).toBe(150_000);
  });

  test('shows an envelope created via the API', async ({ page, api }) => {
    await api.createMonth('2026-01');
    const { envelope } = await api.createEnvelope('Транспорт', '200.00');
    expect(envelope.balanceMinor).toBe(20_000);
    await page.goto('/envelopes');
    await expect(page.getByText('Транспорт')).toBeVisible();
    // NFR-24: ru-RU money format (shared with the month screen).
    await expect(page.getByText(/^200,00\s₽$/)).toBeVisible();

    // ENV-03 / OP-10 / FIN-14: the balance survives a re-read (derived data was recalculated).
    const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/envelopes`);
    const body = (await res.json()) as { envelopes: EnvelopeDto[] };
    expect(body.envelopes.find((e) => e.id === envelope.id)?.balanceMinor).toBe(20_000);
  });
});

test.describe('wide-screen navigation', { tag: '@smoke' }, () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('UI-01: sidebar replaces the tab bar and switches between the four sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/month$/);

    const sidebar = page.getByRole('navigation', { name: 'Основная навигация' });
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('tablist')).toBeHidden();

    const routes: [string, RegExp][] = [
      ['История', /\/history$/],
      ['Аналитика', /\/analytics$/],
      ['Конверты', /\/envelopes$/],
      ['Месяц', /\/month$/],
    ];
    for (const [title, url] of routes) {
      const link = sidebar.getByRole('link', { name: title });
      await link.click();
      await expect(page).toHaveURL(url);
      await expect(link).toHaveAttribute('aria-current', 'page');
    }

    // keyboard: the links are focusable
    await sidebar.getByRole('link', { name: 'Конверты' }).focus();
    await expect(sidebar.getByRole('link', { name: 'Конверты' })).toBeFocused();
  });
});
