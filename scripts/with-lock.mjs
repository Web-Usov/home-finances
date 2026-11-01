#!/usr/bin/env node
/**
 * with-lock - run a command while holding a machine-wide lock, so parallel agents serialize heavy jobs.
 *
 *   node scripts/with-lock.mjs <name> -- <command...>
 *
 * Lock mechanics (lock file, stale takeover, re-entrancy through env FAMILY_BUDGET_LOCKS_HELD) live in lib/lock.mjs; nested use of
 * the same name (the child asks for the lock it already runs under) is a no-op, so it cannot deadlock.
 *
 * The command is spawned without a shell (argv is preserved) in its own process group. SIGINT/SIGTERM/SIGHUP are
 * forwarded to that group; the lock is released after the child exits, and the exit code is 128+signal.
 * Env: WITH_LOCK_TIMEOUT_MIN (default 90), WITH_LOCK_POLL_MS (default 3000).
 */
import os from 'node:os';
import { spawn } from 'node:child_process';
import { acquire } from './lib/lock.mjs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const name = argv[0];
const command = sep === -1 ? [] : argv.slice(sep + 1);
if (!name || sep !== 1 || command.length === 0) {
  console.error('usage: node scripts/with-lock.mjs <name> -- <command...>');
  process.exit(2);
}

const KILL_GRACE_MS = 15_000;

let child = null;
let signalled = null;
let handle = null;

function release() {
  handle?.release();
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

try {
  handle = await acquire(name);
} catch (e) {
  if (e.code !== 'LOCK_TIMEOUT') throw e;
  console.error(e.message);
  process.exit(1);
}
const freeGb = os.freemem() / 1024 ** 3;
if (name === 'e2e' && freeGb < 2) console.error(`[lock:${name}] warning: only ${freeGb.toFixed(1)} GB of free RAM; e2e needs ~2 GB (close other heavy processes)`);
console.error(`[lock:${name}] ${handle.reentrant ? 'already held by an ancestor, not locking again' : `acquired (pid ${process.pid})`}`);

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
