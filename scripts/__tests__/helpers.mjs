// Shared helpers for the script tests (not a test file itself: the glob only picks up *.test.mjs).
// Safety: tests build throwaway git repos in os.tmpdir(). GIT_CEILING_DIRECTORIES stops git's upward repo discovery at the tmp
// root, so a command run in a missing/odd temp dir can never resolve to the real repository, and `assertRealRepoIntact`
// proves after every test that the real repo was not modified (an earlier version set core.bare=true on the main checkout).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const tmpRoot = fs.realpathSync(os.tmpdir());

/** Environment for git subprocesses: no leaked GIT_* from hooks, ceiling at the tmp root, fixed identity. */
export function gitEnv(extra = {}) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  return {
    ...clean,
    GIT_CEILING_DIRECTORIES: tmpRoot,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    ...extra,
  };
}

export function realRepoBare() {
  return execFileSync('git', ['-C', repoRoot, 'config', '--get', 'core.bare'], { env: gitEnv(), encoding: 'utf8' }).trim();
}

export function assertRealRepoIntact() {
  assert.notEqual(realRepoBare(), 'true', 'a test turned the real repository bare (core.bare=true)');
}

const created = new Set();

/** mkdtemp under the tmp root; removed by the `after` hook installed with `installGuards()`. */
export function makeTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, prefix));
  created.add(dir);
  return dir;
}

export function removeTmp(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  created.delete(dir);
}

/** Call once at the top level of a test file: cleans every makeTmp dir (worktrees live inside them) and guards the real repo. */
export function installGuards() {
  assertRealRepoIntact();
  afterEach(() => assertRealRepoIntact());
  after(() => {
    for (const dir of [...created]) removeTmp(dir);
  });
}

/** Polls `cond` until it returns truthy; generous default deadline so heavy machine load cannot flake it. */
export async function waitFor(cond, { ms = 60_000, stepMs = 25 } = {}) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}
