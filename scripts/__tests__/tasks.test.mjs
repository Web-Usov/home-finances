import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installGuards, makeTmp, gitEnv, repoRoot } from './helpers.mjs';

installGuards();

/** A throwaway project tree (scripts + epics + spec + tasks) so the board is generated for a controlled task set. */
function project() {
  const dir = makeTmp('tasks-board-test-');
  for (const d of ['scripts', 'epics', 'docs/spec', 'tasks']) fs.cpSync(path.join(repoRoot, d), path.join(dir, d), { recursive: true });
  return dir;
}

const tasksCli = (dir, ...args) => spawnSync(process.execPath, [path.join(dir, 'scripts/tasks.mjs'), ...args], { cwd: dir, env: gitEnv(), encoding: 'utf8' });
const board = (dir) => {
  const r = tasksCli(dir, 'board');
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(path.join(dir, 'tasks/README.md'), 'utf8');
};
const boardPath = (dir) => path.join(dir, 'tasks/README.md');
const copy = (dir) => {
  const to = makeTmp('tasks-board-copy-');
  fs.cpSync(dir, to, { recursive: true });
  return to;
};

/** ids of the first `n` consecutive tasks of one epic (adjacent rows are the hard case for a 3-way merge). */
function adjacentTasks(dir, n) {
  const ids = fs.readdirSync(path.join(dir, 'tasks')).filter((f) => /^T-\d+-.*\.md$/.test(f)).map((f) => f.slice(0, 5)).sort();
  assert.ok(ids.length >= n);
  return ids.slice(0, n);
}

test('the committed board contains no aggregate counters and one line per task', () => {
  const dir = project();
  const text = board(dir);
  assert.doesNotMatch(text, /Всего|\(\d+\/\d+\)|todo: \d+|done: \d+/);
  const ids = fs.readdirSync(path.join(dir, 'tasks')).filter((f) => /^T-\d+-.*\.md$/.test(f)).map((f) => f.slice(0, 5));
  for (const id of ids) assert.equal(text.split('\n').filter((l) => l.startsWith(`- [${id}]`)).length, 1, `${id} has exactly one line`);
  const listed = [...text.matchAll(/^- \[(T-\d+)\]/gm)].map((m) => m[1]);
  assert.equal(listed.length, ids.length);
  assert.equal(board(dir), text, 'generation is deterministic');
});

test('board and next print the aggregate summary to stdout', () => {
  const dir = project();
  const b = tasksCli(dir, 'board');
  assert.match(b.stdout, /Total tasks: \d+ - todo: \d+/);
  assert.match(b.stdout, /E-00 \w+: \d+\/\d+ done/);
  assert.match(tasksCli(dir, 'next').stdout, /Total tasks: \d+/);
});

test('board --check passes on a fresh board and fails when stale', () => {
  const dir = project();
  board(dir);
  assert.equal(tasksCli(dir, 'board', '--check').status, 0);
  const [id] = adjacentTasks(dir, 1);
  assert.equal(tasksCli(dir, 'set', id, 'blocked').status, 0);
  assert.equal(tasksCli(dir, 'board', '--check').status, 1);
});

test('two independent status changes in parallel PRs merge (git merge-file) to exactly the regenerated board', () => {
  const base = project();
  const [a, b, c] = adjacentTasks(base, 3);
  // reset to a known state: everything todo except nothing; the changes below are relative to this base
  for (const id of [a, b, c]) tasksCli(base, 'set', id, 'todo', '--branch', 'null', '--pr', 'null');
  board(base);

  const prA = copy(base); // PR 1: claims task a (what task:start does)
  assert.equal(tasksCli(prA, 'set', a, 'in_progress', '--branch', `task/${a}-x`).status, 0);
  board(prA);
  const prB = copy(base); // PR 2: finishes the *adjacent* task b
  assert.equal(tasksCli(prB, 'set', b, 'done', '--pr', 'https://example.test/pull/9').status, 0);
  board(prB);
  const expected = copy(base); // what master would have to show once both are in
  tasksCli(expected, 'set', a, 'in_progress', '--branch', `task/${a}-x`);
  tasksCli(expected, 'set', b, 'done', '--pr', 'https://example.test/pull/9');
  const want = board(expected);

  const ours = fs.readFileSync(boardPath(prA), 'utf8');
  const theirs = fs.readFileSync(boardPath(prB), 'utf8');
  assert.notEqual(ours, theirs);
  const work = makeTmp('tasks-board-merge-');
  const f = (n, text) => (fs.writeFileSync(path.join(work, n), text), path.join(work, n));
  const r = spawnSync('git', ['merge-file', '-p', f('ours', ours), f('base', fs.readFileSync(boardPath(base), 'utf8')), f('theirs', theirs)], {
    env: gitEnv(),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `textual conflict in the board:\n${r.stdout}`);
  assert.equal(r.stdout, want);
});
