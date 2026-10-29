#!/usr/bin/env node
/**
 * with-lock - run a command while holding a machine-wide lock, so parallel agents serialize heavy jobs.
 *
 *   node scripts/with-lock.mjs <name> -- <command...>
 *
 * The lock is the file `<os.tmpdir()>/family-budget-<name>.lock` holding `{ pid, cwd, started }`, created atomically
 * (`wx`). If it exists and its pid is alive, wait (message every 30s, poll every 3s); if the pid is dead the lock is
 * stale and is taken over. Released on exit and on SIGINT/SIGTERM. Env: WITH_LOCK_TIMEOUT_MIN (default 90).
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

function readHolder() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  } catch {
    return null; // missing or half-written
  }
}

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
    const holder = readHolder();
    if (holder && !alive(holder.pid)) {
      console.error(`[lock:${name}] stale lock of dead pid ${holder.pid}, taking over`);
      try { fs.unlinkSync(lockFile); } catch { /* raced with another waiter */ }
      continue;
    }
    if (Date.now() - started > timeoutMs) {
      console.error(`[lock:${name}] timed out after ${timeoutMs / 60_000} min waiting for pid ${holder?.pid}; remove ${lockFile} if it is stale`);
      process.exit(1);
    }
    if (Date.now() - lastMsg >= 30_000) {
      lastMsg = Date.now();
      console.error(`[lock:${name}] held by pid ${holder?.pid ?? '?'} (${holder?.cwd ?? '?'}, since ${holder?.started ?? '?'}); waiting...`);
    }
    await sleep(3000);
  }
}

function release() {
  if (readHolder()?.pid === process.pid) {
    try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
  }
}

await acquire();
const freeGb = os.freemem() / 1024 ** 3;
if (name === 'e2e' && freeGb < 2) console.error(`[lock:${name}] warning: only ${freeGb.toFixed(1)} GB of free RAM; e2e needs ~2 GB (close other heavy processes)`);
console.error(`[lock:${name}] acquired (pid ${process.pid})`);

const child = spawn(command.join(' '), { shell: true, stdio: 'inherit' });
const forward = (sig) => () => {
  child.kill(sig);
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, forward(sig));
process.on('exit', release);
child.on('exit', (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
