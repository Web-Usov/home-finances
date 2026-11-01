import type { Page, TestInfo } from '@playwright/test';
import { getE2eEnv } from './env.mjs';

/** Named step screenshot attached to the report (milestone acceptance artifact). */
export async function shot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

export const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, ...(typeof name === 'string' ? { exact: true } : {}) });
export const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

export interface DashboardEnvelope {
  name: string;
  status: string;
  opening: string;
  closing: string;
  replenished: string;
  spent: string;
  transfersIn: string;
  transfersOut: string;
  uncovered: { total: string };
}

export interface DashboardDto {
  month: { period: string; status: string };
  summary: { income: string; allocated: string; free: string; replenished: string; spent: string };
  envelopes: DashboardEnvelope[];
}

/** Dashboard of `period` as the API computed it (the source of truth the UI renders). */
export async function dashboardFromApi(page: Page, period: string) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/dashboard/monthly?period=${period}`);
  const body = (await res.json()) as DashboardDto;
  const byName = (name: string) => {
    const found = body.envelopes.find((e) => e.name === name);
    if (!found) throw new Error(`envelope ${name} is not on the ${period} dashboard`);
    return found;
  };
  return { ...body, byName };
}

export async function monthStatusesFromApi(page: Page) {
  const res = await page.request.get(`${getE2eEnv().apiUrl}/api/v1/months`);
  const body = (await res.json()) as { months: { period: string; status: string }[] };
  return body.months.map((m) => `${m.period}:${m.status}`);
}

/** Fills the allocation editor of the displayed month (`amounts` are ruble strings per envelope name) and saves it. */
export async function saveAllocation(page: Page, amounts: Record<string, string>) {
  await button(page, 'Изменить распределение').click();
  for (const [name, amount] of Object.entries(amounts)) {
    await page.getByLabel(`Распределение: ${name}`).fill(amount);
  }
  await button(page, 'Сохранить распределение').click();
  await button(page, 'Сохранить распределение').waitFor({ state: 'detached' });
}
