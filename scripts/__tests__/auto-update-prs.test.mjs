// scripts/ops/auto-update-prs.sh with a fake `gh` on PATH: which PRs get update-branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installGuards, makeTmp, repoRoot } from './helpers.mjs';

installGuards();

const FAKE_GH = `#!/usr/bin/env bash
echo "$*" >> "$GH_CALLS"
# like the real gh, pr list and repo view need a git checkout as cwd
case "$1 $2" in "pr list"|"repo view") git rev-parse --git-dir >/dev/null 2>&1 || { echo "failed to run git" >&2; exit 1; } ;; esac
case "$1 $2" in
  "pr list") cat "$GH_PRS" ;;
  "repo view") echo "Owner/repo" ;;
  "api -X") [ -z "\${GH_API_FAIL:-}" ] ;;
esac
`;

const pr = (number, mergeStateStatus, extra = {}) => ({
  number,
  mergeStateStatus,
  isDraft: false,
  headRefName: `task/T-${number}`,
  autoMergeRequest: { mergeMethod: 'SQUASH' },
  ...extra,
});

const run = (prs, env = {}, cwd = undefined) => {
  const dir = makeTmp('auto-update-');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), FAKE_GH, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'prs.json'), JSON.stringify(prs));
  const calls = path.join(dir, 'calls.log');
  const r = spawnSync('bash', [path.join(repoRoot, 'scripts/ops/auto-update-prs.sh')], {
    env: { PATH: `${bin}:${process.env.PATH}`, GH_CALLS: calls, GH_PRS: path.join(dir, 'prs.json'), ...env },
    encoding: 'utf8',
    cwd,
  });
  const log = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean) : [];
  return { r, apiCalls: log.filter((l) => l.startsWith('api ')) };
};

test('BEHIND PR with auto-merge gets a merge update-branch call on the derived repo', () => {
  const { r, apiCalls } = run([pr(7, 'BEHIND')]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(apiCalls, ['api -X PUT repos/Owner/repo/pulls/7/update-branch']);
  assert.match(r.stdout, /#7 .*update-branch requested/);
});

test('runs from outside a git checkout (systemd cwd is /)', () => {
  const { r, apiCalls } = run([pr(7, 'BEHIND')], {}, '/');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(apiCalls.length, 1);
});

test('REPO overrides the derived slug', () => {
  const { apiCalls } = run([pr(7, 'BEHIND')], { REPO: 'a/b' });
  assert.deepEqual(apiCalls, ['api -X PUT repos/a/b/pulls/7/update-branch']);
});

for (const state of ['CLEAN', 'BLOCKED', 'UNSTABLE', 'HAS_HOOKS', 'UNKNOWN']) {
  test(`${state} PR is left alone`, () => {
    const { r, apiCalls } = run([pr(1, state)]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(apiCalls, []);
    assert.match(r.stdout, /nothing to update/);
  });
}

test('BEHIND PR without auto-merge is left alone', () => {
  assert.deepEqual(run([pr(2, 'BEHIND', { autoMergeRequest: null })]).apiCalls, []);
});

test('draft BEHIND PR is left alone', () => {
  assert.deepEqual(run([pr(3, 'BEHIND', { isDraft: true })]).apiCalls, []);
});

test('DIRTY PR is logged as needing the author and not updated', () => {
  const { r, apiCalls } = run([pr(4, 'DIRTY')]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(apiCalls, []);
  assert.match(r.stdout, /#4 .*merge conflicts.*author/);
});

test('mixed list updates only the eligible PRs; empty list is a no-op', () => {
  const { apiCalls } = run([pr(1, 'BEHIND'), pr(2, 'CLEAN'), pr(3, 'BEHIND', { autoMergeRequest: null }), pr(5, 'BEHIND')]);
  assert.deepEqual(apiCalls.map((c) => c.split('/')[4]), ['1', '5']);
  const empty = run([]);
  assert.equal(empty.r.status, 0, empty.r.stderr);
  assert.deepEqual(empty.apiCalls, []);
});

test('DRY_RUN logs without calling the API', () => {
  const { r, apiCalls } = run([pr(1, 'BEHIND')], { DRY_RUN: '1' });
  assert.deepEqual(apiCalls, []);
  assert.match(r.stdout, /would update-branch/);
});

test('a failed update-branch is logged and does not abort the run', () => {
  const { r, apiCalls } = run([pr(1, 'BEHIND'), pr(2, 'BEHIND')], { GH_API_FAIL: '1' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(apiCalls.length, 2);
  assert.match(r.stderr, /#1 .*FAILED/);
});
