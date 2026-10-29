import { test as base, expect } from '@playwright/test';
import { ApiFixture } from './api';
import { getE2eEnv } from '../support/env.mjs';

/** `test` with an `api` fixture; it is auto-used, so the DB is reset before every test. */
export const test = base.extend<{ api: ApiFixture }>({
  api: [
    async ({ request }, use) => {
      const api = new ApiFixture(request, getE2eEnv().apiUrl);
      await api.reset();
      await use(api);
    },
    { auto: true },
  ],
});

export { expect };
