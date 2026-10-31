// update.sh guards that must fire before anything is fetched or built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installGuards, makeTmp, repoRoot } from './helpers.mjs';

installGuards();

const run = (databaseUrl, extra = {}) => {
  const home = makeTmp('preview-upd-');
  return spawnSync('bash', [path.join(repoRoot, 'scripts/preview/update.sh')], {
    env: { PATH: process.env.PATH, PREVIEW_HOME: home, DATABASE_URL: databaseUrl, ...extra },
    encoding: 'utf8',
  });
};

for (const url of [
  'postgresql://budget:budget@127.0.0.1:5432/family_budget?schema=public',
  'postgresql://budget:budget@127.0.0.1:5432/family_budget_test?schema=public',
  'postgresql://budget:budget@127.0.0.1:5432/family_budget_preview_test',
  'postgresql://budget:budget@127.0.0.1:5432/other_family_budget_preview?schema=public',
]) {
  test(`refuses a DATABASE_URL that is not exactly family_budget_preview: ${url.split('/').pop()}`, () => {
    const r = run(url);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /refusing/);
  });
}

test('refuses to be pointed at another database name through PREVIEW_DB_NAME', () => {
  const r = run('postgresql://budget:budget@127.0.0.1:5432/family_budget_test', { PREVIEW_DB_NAME: 'family_budget_test' });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /must be family_budget_preview/);
});
