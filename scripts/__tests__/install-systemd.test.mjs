// The systemd installers must never point units into a task worktree (T-016): they refuse to run from one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitEnv, installGuards, makeTmp, repoRoot } from './helpers.mjs';

installGuards();

const installers = ['scripts/ops/install-systemd.sh', 'scripts/preview/install-systemd.sh'];

function setup() {
  const root = makeTmp('install-systemd-');
  const main = path.join(root, 'main');
  const env = gitEnv();
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  fs.mkdirSync(main);
  git(main, 'init', '-q', '-b', 'master');
  for (const rel of installers) {
    fs.mkdirSync(path.join(main, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, rel), path.join(main, rel));
  }
  git(main, 'add', '-A');
  git(main, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  const wt = path.join(root, 'wt');
  git(main, 'worktree', 'add', '-q', '-b', 'task/x', wt);
  return { main, wt, env };
}

for (const rel of installers) {
  test(`${rel} refuses to run from a worktree and names the main checkout`, () => {
    const { main, wt, env } = setup();
    const r = spawnSync('bash', [path.join(wt, rel)], { env, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refusing to install from a worktree/);
    assert.ok(r.stderr.includes(main), r.stderr);
  });

  test(`${rel} passes the worktree check in the main checkout (then stops at the root check when not root)`, (t) => {
    if (process.getuid?.() === 0) return t.skip('would really install as root');
    const { main, env } = setup();
    const r = spawnSync('bash', [path.join(main, rel)], { env, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stderr, /refusing/);
    assert.match(r.stderr, /run as root/);
  });
}
