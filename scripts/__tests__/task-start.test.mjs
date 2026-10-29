import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nextTaskId, slugify, renderNewTask, parseArgs } from '../task-start.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('nextTaskId is max+1, zero padded, ignores junk', () => {
  assert.equal(nextTaskId([]), 'T-001');
  assert.equal(nextTaskId(['T-001', 'T-020', 'T-007']), 'T-021');
  assert.equal(nextTaskId(['T-999']), 'T-1000');
  assert.equal(nextTaskId(['E-05', 'x']), 'T-001');
});

test('slugify makes a short kebab slug', () => {
  assert.equal(slugify('Harden process scripts (with-lock, task-start)'), 'harden-process-scripts-with-lock-task');
  assert.equal(slugify('  Fix: Ünicode & stuff!! '), 'fix-nicode-stuff');
  assert.equal(slugify('Привет'), '');
});

test('renderNewTask fills frontmatter and heading, keeps comments', () => {
  const tpl = fs.readFileSync(path.join(repoRoot, 'tasks/_template.md'), 'utf8');
  const out = renderNewTask(tpl, { id: 'T-042', title: 'Do the thing', epic: 'E-03', area: 'mobile', size: 'M' });
  assert.match(out, /^id: T-042$/m);
  assert.match(out, /^title: "Do the thing"$/m);
  assert.match(out, /^epic: E-03 +# epics/m);
  assert.match(out, /^area: mobile +# /m);
  assert.match(out, /^size: M +# /m);
  assert.match(out, /^status: todo/m);
  assert.match(out, /^# T-042\. Do the thing$/m);
  assert.throws(() => renderNewTask(tpl, { id: 'T-1', title: 'a "quoted" # title', epic: 'E-01', area: 'api', size: 'S' }));
});

test('parseArgs reads --new options and rejects unknown ones', () => {
  assert.deepEqual(parseArgs(['--new', 'T', '--epic', 'E-00', '--area', 'infra', '--size', 'S', '--keep']), {
    keep: true, positional: [], new: 'T', epic: 'E-00', area: 'infra', size: 'S',
  });
  assert.deepEqual(parseArgs(['T-001']), { keep: false, positional: ['T-001'] });
  assert.throws(() => parseArgs(['--bogus']));
  assert.throws(() => parseArgs(['--new']));
});

// ---- integration against a throwaway origin + clone ----

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-start-test-'));
  // git hooks export GIT_DIR/GIT_INDEX_FILE...; they must not leak into the throwaway repos
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const env = { ...clean, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const sh = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = path.join(dir, 'origin.git');
  const main = path.join(dir, 'main', 'finance');
  fs.mkdirSync(main, { recursive: true });
  sh(dir, 'init', '--bare', '-b', 'master', origin);
  sh(main, 'init', '-b', 'master');
  sh(main, 'remote', 'add', 'origin', origin);
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(main, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'epics'), path.join(main, 'epics'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'docs/spec'), path.join(main, 'docs/spec'), { recursive: true });
  fs.mkdirSync(path.join(main, 'tasks'));
  fs.copyFileSync(path.join(repoRoot, 'tasks/_template.md'), path.join(main, 'tasks/_template.md'));
  fs.copyFileSync(path.join(repoRoot, 'tasks/T-018-process-v1-retro.md'), path.join(main, 'tasks/T-018-process-v1-retro.md'));
  sh(main, 'add', '-A');
  sh(main, 'commit', '-m', 'init');
  sh(main, 'push', '-u', 'origin', 'master');
  // an unmerged task branch on origin whose id must not be reused
  sh(main, 'branch', 'task/T-030-pending');
  sh(main, 'push', 'origin', 'task/T-030-pending');
  sh(main, 'branch', '-D', 'task/T-030-pending');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  return { dir, main, sh, env: { ...env, TASK_START_SKIP_INSTALL: '1' }, bin };
}

const start = (fx, args, env = {}) =>
  spawnSync(process.execPath, [path.join(fx.main, 'scripts/task-start.mjs'), ...args], { cwd: fx.main, env: { ...fx.env, ...env }, encoding: 'utf8' });

test('--new creates the task file with the next free id and claims it in one commit', () => {
  const fx = fixture();
  const r = start(fx, ['--new', 'Follow-up: harden things', '--epic', 'E-00', '--area', 'infra', '--size', 'S']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const wt = path.join(fx.dir, 'main', 'finance-wt', 't-031-follow-up-harden-things');
  const file = path.join(wt, 'tasks/T-031-follow-up-harden-things.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^id: T-031$/m);
  assert.match(text, /^status: in_progress( .*)?$/m);
  assert.match(text, /^branch: task\/T-031-follow-up-harden-things( .*)?$/m);
  assert.match(text, /^# T-031\. Follow-up: harden things$/m);
  assert.equal(fx.sh(wt, 'log', '-1', '--format=%s'), 'chore(tasks): add and start T-031 [T-031]');
  assert.equal(fx.sh(wt, 'status', '--porcelain'), '');
  assert.equal(fx.sh(wt, 'branch', '--show-current'), 'task/T-031-follow-up-harden-things');
});

test('--new validates epic, area and size without creating anything', () => {
  const fx = fixture();
  for (const bad of [
    ['--epic', 'E-99', '--area', 'infra', '--size', 'S'],
    ['--epic', 'E-00', '--area', 'nope', '--size', 'S'],
    ['--epic', 'E-00', '--area', 'infra', '--size', 'L'],
  ]) {
    const r = start(fx, ['--new', 'Whatever', ...bad]);
    assert.notEqual(r.status, 0);
  }
  assert.equal(fs.existsSync(path.join(fx.dir, 'main', 'finance-wt')), false);
});

test('a failure after the worktree is created rolls back worktree and branch', () => {
  const fx = fixture();
  fs.writeFileSync(path.join(fx.bin, 'pnpm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const r = start(fx, ['--new', 'Doomed', '--epic', 'E-00', '--area', 'infra', '--size', 'S'], {
    TASK_START_SKIP_INSTALL: '',
    PATH: `${fx.bin}${path.delimiter}${process.env.PATH}`,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Rolled back/);
  assert.equal(fs.existsSync(path.join(fx.dir, 'main', 'finance-wt', 't-031-doomed')), false);
  assert.equal(fx.sh(fx.main, 'branch', '--list', 'task/T-031-doomed'), '');
  assert.equal(fx.sh(fx.main, 'worktree', 'list').split('\n').length, 1);
});

test('--keep leaves the worktree and branch after a failure', () => {
  const fx = fixture();
  fs.writeFileSync(path.join(fx.bin, 'pnpm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const r = start(fx, ['--new', 'Kept', '--epic', 'E-00', '--area', 'infra', '--size', 'S', '--keep'], {
    TASK_START_SKIP_INSTALL: '',
    PATH: `${fx.bin}${path.delimiter}${process.env.PATH}`,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--keep/);
  assert.ok(fs.existsSync(path.join(fx.dir, 'main', 'finance-wt', 't-031-kept')));
  assert.notEqual(fx.sh(fx.main, 'branch', '--list', 'task/T-031-kept'), '');
});
