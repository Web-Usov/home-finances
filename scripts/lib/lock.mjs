/**
 * Machine-wide named locks shared by with-lock.mjs, Playwright (e2e/playwright.config.ts) and task-start.mjs.
 *
 * The lock is the file `<os.tmpdir()>/family-budget-<name>.lock` holding `{ pid, cwd, started }`, created atomically
 * (`wx`). If it exists and its pid is alive, wait. A lock is stale when its pid is dead, or when it is empty/unparsable
 * and older than 10s (a crash between create and write). Takeover of a stale lock is race-free: the stale file is renamed
 * to a unique name (only one waiter wins the rename), the renamed content is verified to still be the stale one, and only
 * then the winner retries the atomic create.
 *
 * Re-entrancy: a process that holds a lock lists its name in env `FAMILY_BUDGET_LOCKS_HELD` (comma separated), which its
 * children inherit; acquiring a name that is listed there is a no-op. So `with-lock.mjs e2e -- playwright test` (the
 * Playwright config asks for the same lock) does not deadlock.
 *
 * Env: WITH_LOCK_TIMEOUT_MIN (default 90), WITH_LOCK_POLL_MS (default 3000).
 * Exports `acquire` (async) and `acquireSync` (blocking, for module top level); both throw an error with
 * `code === 'LOCK_TIMEOUT'` on timeout and resolve to a handle `{ name, reentrant, release() }`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HELD_ENV = 'FAMILY_BUDGET_LOCKS_HELD';
const EMPTY_STALE_MS = 10_000;
const MESSAGE_EVERY_MS = 30_000;

export const lockFileOf = (name) => path.join(os.tmpdir(), `family-budget-${name}.lock`);
const heldNames = () => (process.env[HELD_ENV] ?? '').split(',').filter(Boolean);
export const isHeldByAncestor = (name) => heldNames().includes(name);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

function parseHolder(raw) {
  try {
    const h = JSON.parse(raw);
    return Number.isInteger(h?.pid) ? h : null;
  } catch {
    return null; // empty or half-written
  }
}

/** Current lock state: null when there is no file, else { holder (null if unparsable), ageMs }. */
function readLock(file) {
  try {
    const stat = fs.statSync(file);
    return { holder: parseHolder(fs.readFileSync(file, 'utf8')), ageMs: Date.now() - stat.mtimeMs };
  } catch {
    return null;
  }
}

const isStale = (lock) => (lock.holder ? !alive(lock.holder.pid) : lock.ageMs > EMPTY_STALE_MS);

/** Removes a stale lock; true only for the single waiter whose rename won. */
function takeOverStale(name, file) {
  const tmp = `${file}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
  try {
    fs.renameSync(file, tmp);
  } catch {
    return false; // another waiter renamed it first (or the holder released it)
  }
  const moved = readLock(tmp);
  if (moved && isStale(moved)) {
    fs.rmSync(tmp, { force: true });
    console.error(`[lock:${name}] stale lock${moved.holder ? ` of dead pid ${moved.holder.pid}` : ' (empty file)'}, taking over`);
    return true;
  }
  // We renamed a fresh live lock that another waiter created after the stale one was removed: put it back.
  try { fs.linkSync(tmp, file); } catch { /* file was re-created meanwhile; nothing more to do */ }
  fs.rmSync(tmp, { force: true });
  return false;
}

/** One non-blocking attempt: { acquired: true } or { acquired: false, holder }. */
function tryAcquire(name, file) {
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, cwd: process.cwd(), started: new Date().toISOString() }));
      fs.closeSync(fd);
      return { acquired: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const lock = readLock(file);
    if (!lock) continue; // released between create and read
    if (isStale(lock) && takeOverStale(name, file)) continue;
    return { acquired: false, holder: lock.holder };
  }
}

function makeHandle(name, file) {
  const prev = process.env[HELD_ENV];
  process.env[HELD_ENV] = [...heldNames(), name].join(',');
  let released = false;
  const handle = {
    name,
    reentrant: false,
    release() {
      if (released) return;
      released = true;
      process.off('exit', handle.release);
      if (prev === undefined) delete process.env[HELD_ENV];
      else process.env[HELD_ENV] = prev;
      if (readLock(file)?.holder?.pid === process.pid) {
        try { fs.unlinkSync(file); } catch { /* already gone */ }
      }
    },
  };
  process.on('exit', handle.release); // crash/exit safety net; a killed process is handled by the stale-pid logic
  return handle;
}

const noopHandle = (name) => ({ name, reentrant: true, release() {} });

function timeoutError(name, file, holder, timeoutMs) {
  const e = new Error(`[lock:${name}] timed out after ${timeoutMs / 60_000} min waiting for pid ${holder?.pid}; remove ${file} if it is stale`);
  e.code = 'LOCK_TIMEOUT';
  return e;
}

function waitMessage(name, holder) {
  return `[lock:${name}] held by pid ${holder?.pid ?? '?'} (${holder?.cwd ?? '?'}, since ${holder?.started ?? '?'}); waiting...`;
}

export async function acquire(name) {
  if (isHeldByAncestor(name)) return noopHandle(name);
  const file = lockFileOf(name);
  const timeoutMs = Number(process.env.WITH_LOCK_TIMEOUT_MIN ?? 90) * 60_000;
  const pollMs = Number(process.env.WITH_LOCK_POLL_MS ?? 3000);
  const started = Date.now();
  let lastMsg = 0;
  for (;;) {
    const r = tryAcquire(name, file);
    if (r.acquired) return makeHandle(name, file);
    if (Date.now() - started > timeoutMs) throw timeoutError(name, file, r.holder, timeoutMs);
    if (Date.now() - lastMsg >= MESSAGE_EVERY_MS) {
      lastMsg = Date.now();
      console.error(waitMessage(name, r.holder));
    }
    await new Promise((res) => setTimeout(res, pollMs));
  }
}

/** Blocking variant of `acquire` (sleeps with Atomics.wait); for scripts and config modules that cannot await. */
export function acquireSync(name) {
  if (isHeldByAncestor(name)) return noopHandle(name);
  const file = lockFileOf(name);
  const timeoutMs = Number(process.env.WITH_LOCK_TIMEOUT_MIN ?? 90) * 60_000;
  const pollMs = Number(process.env.WITH_LOCK_POLL_MS ?? 3000);
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const started = Date.now();
  let lastMsg = 0;
  for (;;) {
    const r = tryAcquire(name, file);
    if (r.acquired) return makeHandle(name, file);
    if (Date.now() - started > timeoutMs) throw timeoutError(name, file, r.holder, timeoutMs);
    if (Date.now() - lastMsg >= MESSAGE_EVERY_MS) {
      lastMsg = Date.now();
      console.error(waitMessage(name, r.holder));
    }
    Atomics.wait(sleeper, 0, 0, pollMs);
  }
}
