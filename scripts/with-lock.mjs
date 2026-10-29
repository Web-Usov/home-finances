#!/usr/bin/env node
/**
 * with-lock - run a command while holding a machine-wide lock, so parallel agents serialize heavy jobs.
 *
 *   node scripts/with-lock.mjs <name> -- <command...>
 *
 * The lock is the file `<os.tmpdir()>/family-budget-<name>.lock` holding `{ pid, cwd, started }`, created atomically
 * (`wx`). If it exists and its pid is alive, wait (message every 30s, poll every 3s). A lock is stale when its pid is
 * dead, or when it is empty/unparsable and older than 10s (a crash between create and write). Takeover of a stale lock
 * is race-free: the stale file is renamed to a unique name (only one waiter wins the rename), the renamed content is
 * verified to still be the stale one, and only then the winner retries the atomic create.
 *
 * The command is spawned without a shell (argv is preserved) in its own process group. SIGINT/SIGTERM/SIGHUP are
 * forwarded to that group; the lock is released after the child exits, and the exit code is 128+signal.
 * Env: WITH_LOCK_TIMEOUT_MIN (default 90), WITH_LOCK_POLL_MS (default 3000).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const name = argv[0];
const command = sep === -1 ? [] : argv.slice(sep + 1);
if (!name || sep !== 1 || command.length === 0) {
  console.error('usage: node scripts/with-lock.mjs <name> -- <command...>');
  process.exit(2);
}

const lockFile = path.join(os.tmpdir(), `family-budget-${name}.lock`);
const timeoutMs = Number(process.env.WITH_LOCK_TIMEOUT_MIN ?? 90) * 60_000;
const pollMs = Number(process.env.WITH_LOCK_POLL_MS ?? 3000);
const EMPTY_STALE_MS = 10_000;
const KILL_GRACE_MS = 15_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
function readLock(file = lockFile) {
  try {
    const stat = fs.statSync(file);
    return { holder: parseHolder(fs.readFileSync(file, 'utf8')), ageMs: Date.now() - stat.mtimeMs };
  } catch {
    return null;
  }
}

const readHolder = () => readLock()?.holder ?? null;

const isStale = (lock) => (lock.holder ? !alive(lock.holder.pid) : lock.ageMs > EMPTY_STALE_MS);

/** Removes a stale lock; true only for the single waiter whose rename won. */
function takeOverStale() {
  const tmp = `${lockFile}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
  try {
    fs.renameSync(lockFile, tmp);
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
  try { fs.linkSync(tmp, lockFile); } catch { /* lockFile was re-created meanwhile; nothing more to do */ }
  fs.rmSync(tmp, { force: true });
  return false;
}

let child = null;
let signalled = null;

async function acquire() {
  const started = Date.now();
  let lastMsg = 0;
  for (;;) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, cwd: process.cwd(), started: new Date().toISOString() }));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const lock = readLock();
    if (!lock) continue; // released between create and read
    if (isStale(lock) && takeOverStale()) continue;
    const holder = lock.holder;
    if (Date.now() - started > timeoutMs) {
      console.error(`[lock:${name}] timed out after ${timeoutMs / 60_000} min waiting for pid ${holder?.pid}; remove ${lockFile} if it is stale`);
      process.exit(1);
    }
    if (Date.now() - lastMsg >= 30_000) {
      lastMsg = Date.now();
      console.error(`[lock:${name}] held by pid ${holder?.pid ?? '?'} (${holder?.cwd ?? '?'}, since ${holder?.started ?? '?'}); waiting...`);
    }
    await sleep(pollMs);
  }
}

function release() {
  if (readHolder()?.pid === process.pid) {
    try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
  }
}

const signo = (sig) => os.constants.signals[sig] ?? 0;
function killGroup(sig) {
  try { process.kill(-child.pid, sig); } catch { /* group already gone */ }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    signalled ??= sig;
    if (!child) {
      release();
      process.exit(128 + signo(sig));
    }
    killGroup(sig); // the exit handler of the child releases the lock and exits
    setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS).unref();
  });
}
process.on('exit', release);

await acquire();
const freeGb = os.freemem() / 1024 ** 3;
if (name === 'e2e' && freeGb < 2) console.error(`[lock:${name}] warning: only ${freeGb.toFixed(1)} GB of free RAM; e2e needs ~2 GB (close other heavy processes)`);
console.error(`[lock:${name}] acquired (pid ${process.pid})`);

if (signalled) {
  release();
  process.exit(128 + signo(signalled));
}
child = spawn(command[0], command.slice(1), { stdio: 'inherit', detached: true });
child.on('error', (e) => {
  release();
  console.error(`[lock:${name}] cannot run "${command[0]}": ${e.message}`);
  process.exit(127);
});
child.on('exit', (code, signal) => {
  release();
  process.exit(signalled ? 128 + signo(signalled) : (code ?? 128 + signo(signal)));
});
