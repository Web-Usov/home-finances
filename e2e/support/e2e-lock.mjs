// Machine-wide `e2e` lock (same lock as `pnpm e2e:*` via scripts/with-lock.mjs), so that a direct `playwright test` is
// serialized with every other e2e run on the machine. Called from playwright.config.ts at load time, not from a
// globalSetup: Playwright starts the webServers (API + Expo web export, the heavy part) BEFORE globalSetup runs.
// The lock is released in global-teardown and, as a safety net, on process exit; a killed process leaves a stale lock
// that the next waiter takes over (dead pid). Under `with-lock.mjs e2e -- ...` the lock is already held: no-op.
import { acquireSync } from '../../scripts/lib/lock.mjs';

const KEY = Symbol.for('family-budget.e2e-lock');

export function acquireE2eLock() {
  if (globalThis[KEY]) return; // config module evaluated twice in this process
  try {
    globalThis[KEY] = acquireSync('e2e');
  } catch (e) {
    if (e.code !== 'LOCK_TIMEOUT') throw e;
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}

export function releaseE2eLock() {
  globalThis[KEY]?.release();
  globalThis[KEY] = undefined;
}
