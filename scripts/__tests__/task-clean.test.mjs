import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideClean } from '../task-clean.mjs';
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
