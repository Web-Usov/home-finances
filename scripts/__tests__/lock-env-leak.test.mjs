// Regression (T-074): `task:start --new` holds the `task-id` lock (env FAMILY_BUDGET_LOCKS_HELD=task-id) while the claim
// commit runs the pre-commit hook -> verify:quick -> test:scripts. The lock-sensitive tests must not be affected by that.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanEnv, installGuards } from './helpers.mjs';

installGuards();
const dir = path.dirname(fileURLToPath(import.meta.url));

test('cleanEnv drops FAMILY_BUDGET_LOCKS_HELD and GIT_* but keeps the rest', () => {
  const saved = { held: process.env.FAMILY_BUDGET_LOCKS_HELD, git: process.env.GIT_DIR };
  process.env.FAMILY_BUDGET_LOCKS_HELD = 'task-id';
  process.env.GIT_DIR = '/nonexistent';
  try {
    const env = cleanEnv({ X: '1' });
    assert.equal('FAMILY_BUDGET_LOCKS_HELD' in env, false);
    assert.equal('GIT_DIR' in env, false);
    assert.equal(env.X, '1');
    assert.equal(env.PATH, process.env.PATH);
  } finally {
    for (const [k, v] of [['FAMILY_BUDGET_LOCKS_HELD', saved.held], ['GIT_DIR', saved.git]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('lock tests and concurrent --new pass with FAMILY_BUDGET_LOCKS_HELD=task-id in the environment', () => {
  const r = spawnSync(
    process.execPath,
    ['--test', '--test-name-pattern=.', path.join(dir, 'with-lock.test.mjs'), path.join(dir, 'task-start.test.mjs')],
    { env: { ...process.env, FAMILY_BUDGET_LOCKS_HELD: 'task-id' }, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
