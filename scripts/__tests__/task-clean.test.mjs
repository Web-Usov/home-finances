import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideClean, resolveBranch } from '../task-clean.mjs';
import { installGuards } from './helpers.mjs';

installGuards();

const base = { branch: 'task/T-1-x', localHead: 'a'.repeat(40) };
const merged = { state: 'MERGED', url: 'https://gh/pr/1', headRefOid: 'a'.repeat(40) };

test('allows cleaning when the local HEAD equals the merged PR head', () => {
  assert.deepEqual(decideClean({ ...base, pr: merged, inMaster: false }), { ok: true });
});

test('allows cleaning when the branch is fully contained in origin/master', () => {
  const pr = { ...merged, headRefOid: 'b'.repeat(40) };
  assert.deepEqual(decideClean({ ...base, pr, inMaster: true }), { ok: true });
});

test('refuses when the PR is not merged', () => {
  const r = decideClean({ ...base, pr: { ...merged, state: 'OPEN' }, inMaster: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /OPEN, not MERGED/);
});

test('refuses when local has unpushed commits, listing them', () => {
  const pr = { ...merged, headRefOid: 'b'.repeat(40) };
  const r = decideClean({ ...base, pr, inMaster: false, unpushed: ['1234567 fix: late change', '89abcde wip'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /never pushed/);
  assert.match(r.reason, /1234567 fix: late change/);
  assert.match(r.reason, /89abcde wip/);
});

test('refuses (with a note) even when the unpushed commits cannot be listed', () => {
  const pr = { ...merged, headRefOid: 'b'.repeat(40) };
  const r = decideClean({ ...base, pr, inMaster: false });
  assert.equal(r.ok, false);
  assert.match(r.reason, /could not be listed/);
});

test('resolveBranch prefers the task file branch field (renumbered task keeps its old branch name)', () => {
  const localBranches = ['master', 'task/T-023-months-recalc', 'task/T-033-other'];
  assert.deepEqual(resolveBranch({ id: 'T-032', branchField: 'task/T-023-months-recalc', localBranches }), { branch: 'task/T-023-months-recalc' });
});

test('resolveBranch falls back to the task/T-xxx-* pattern and reports ambiguity or absence', () => {
  assert.deepEqual(resolveBranch({ id: 'T-033', branchField: null, localBranches: ['task/T-033-a'] }), { branch: 'task/T-033-a' });
  assert.deepEqual(resolveBranch({ id: 'T-033', branchField: 'task/T-033-gone', localBranches: ['task/T-033-a'] }), { branch: 'task/T-033-a' });
  assert.match(resolveBranch({ id: 'T-032', branchField: 'task/T-023-x', localBranches: ['master'] }).error, /found 0.*task file says task\/T-023-x/);
  assert.match(resolveBranch({ id: 'T-033', branchField: null, localBranches: ['task/T-033-a', 'task/T-033-b'] }).error, /found 2/);
});
