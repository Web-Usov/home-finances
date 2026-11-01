import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installGuards, makeTmp, waitFor } from './helpers.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'with-lock.mjs');
installGuards();

function sandbox() {
  const tmp = makeTmp('with-lock-test-');
  return {
    tmp,
    lock: path.join(tmp, 'family-budget-t.lock'),
    env: { ...process.env, TMPDIR: tmp, WITH_LOCK_POLL_MS: '30' },
  };
}

function run(sb, cmd, opts = {}) {
  const p = spawn(process.execPath, [script, 't', '--', ...cmd], { env: { ...sb.env, ...opts.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = { stderr: '', exit: new Promise((r) => p.on('close', (code, signal) => r({ code, signal }))) };
  p.stderr.on('data', (d) => (out.stderr += d));
  p.stdout.on('data', () => {});
  out.proc = p;
  return out;
}

function deadPid() {
  const r = spawnSync(process.execPath, ['-e', '']);
  return r.pid;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('propagates the exit code of the command and releases the lock', async () => {
  const sb = sandbox();
  const r = await run(sb, ['sh', '-c', 'exit 7']).exit;
  assert.equal(r.code, 7);
  assert.equal(fs.existsSync(sb.lock), false);
});

test('spawns argv without a shell: arguments keep their quoting', async () => {
  const sb = sandbox();
  const out = path.join(sb.tmp, 'args.json');
  const js = `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(1)))`;
  const r = await run(sb, [process.execPath, '-e', js, 'a b', '$HOME', "it's;x"]).exit;
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), ['a b', '$HOME', "it's;x"]);
});

test('reports a missing command with exit 127 and releases the lock', async () => {
  const sb = sandbox();
  const r = run(sb, ['definitely-not-a-command-xyz']);
  assert.equal((await r.exit).code, 127);
  assert.equal(fs.existsSync(sb.lock), false);
});

test('two concurrent waiters on a dead-pid lock: exactly one takes it over, critical sections do not overlap', async () => {
  for (let i = 0; i < 5; i++) {
    const sb = sandbox();
    fs.writeFileSync(sb.lock, JSON.stringify({ pid: deadPid(), cwd: '/x', started: 'then' }));
    const log = path.join(sb.tmp, 'log');
    const section = (n) => [process.execPath, '-e', `const fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},'start${n}\\n');setTimeout(()=>{fs.appendFileSync(${JSON.stringify(log)},'end${n}\\n')},300)`];
    const a = run(sb, section('A'));
    const b = run(sb, section('B'));
    const [ra, rb] = await Promise.all([a.exit, b.exit]);
    assert.equal(ra.code, 0);
    assert.equal(rb.code, 0);
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.equal(lines.length, 4);
    assert.equal(lines[0].replace('start', ''), lines[1].replace('end', ''), `sections overlap: ${lines.join(',')}`);
    assert.equal((a.stderr + b.stderr).match(/taking over/g)?.length, 1, 'exactly one waiter takes over');
    assert.equal(fs.existsSync(sb.lock), false);
  }
});

test('waits for a live holder and does not take its lock', async () => {
  const sb = sandbox();
  fs.writeFileSync(sb.lock, JSON.stringify({ pid: process.pid, cwd: '/x', started: 'now' }));
  const r = run(sb, ['true'], { env: { WITH_LOCK_TIMEOUT_MIN: '0.01' } });
  const res = await r.exit;
  assert.equal(res.code, 1);
  assert.match(r.stderr, /timed out/);
  assert.equal(JSON.parse(fs.readFileSync(sb.lock, 'utf8')).pid, process.pid);
});

test('an empty lock file older than 10s is stale; a fresh one is not', async () => {
  const sb = sandbox();
  fs.writeFileSync(sb.lock, '');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(sb.lock, old, old);
  const r = run(sb, ['true']);
  assert.equal((await r.exit).code, 0);
  assert.match(r.stderr, /empty file/);

  fs.writeFileSync(sb.lock, '{"pi'); // fresh and half-written: a holder may still be writing it
  const fresh = run(sb, ['true'], { env: { WITH_LOCK_TIMEOUT_MIN: '0.01' } });
  assert.equal((await fresh.exit).code, 1);
  assert.equal(fs.readFileSync(sb.lock, 'utf8'), '{"pi');

  fs.utimesSync(sb.lock, old, old); // the same garbage, but old
  assert.equal((await run(sb, ['true']).exit).code, 0);
});

test('SIGTERM is forwarded to the process group (grandchild dies), lock released after, exit 143', async () => {
  const sb = sandbox();
  const pidFile = path.join(sb.tmp, 'grandchild.pid');
  const r = run(sb, ['sh', '-c', `sleep 60 & echo $! > ${pidFile}; wait`]);
  assert.ok(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').trim()), 'grandchild started');
  const grandchild = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.ok(alive(grandchild));
  assert.ok(fs.existsSync(sb.lock));
  r.proc.kill('SIGTERM');
  const res = await r.exit;
  assert.equal(res.code, 143);
  assert.ok(await waitFor(() => !alive(grandchild)), 'grandchild is gone');
  assert.equal(fs.existsSync(sb.lock), false);
});

test('SIGINT while waiting for the lock exits 130 without touching the holder lock', async () => {
  const sb = sandbox();
  fs.writeFileSync(sb.lock, JSON.stringify({ pid: process.pid, cwd: '/x', started: 'now' }));
  const r = run(sb, ['true']);
  assert.ok(await waitFor(() => /waiting/.test(r.stderr)), 'process is polling for the lock');
  r.proc.kill('SIGINT');
  assert.equal((await r.exit).code, 130);
  assert.equal(JSON.parse(fs.readFileSync(sb.lock, 'utf8')).pid, process.pid);
});

test('nested with-lock of the same name does not deadlock and does not take the lock twice', async () => {
  const sb = sandbox();
  const r = run(sb, [process.execPath, script, 't', '--', 'sh', '-c', 'exit 3'], { env: { WITH_LOCK_TIMEOUT_MIN: '0.02' } });
  const res = await r.exit;
  assert.equal(res.code, 3, r.stderr);
  assert.match(r.stderr, /already held by an ancestor/);
  assert.equal(fs.existsSync(sb.lock), false);
});

test('the child of with-lock sees the held lock name in FAMILY_BUDGET_LOCKS_HELD', async () => {
  const sb = sandbox();
  const out = path.join(sb.tmp, 'held');
  const js = `require('fs').writeFileSync(${JSON.stringify(out)}, process.env.FAMILY_BUDGET_LOCKS_HELD || '')`;
  assert.equal((await run(sb, [process.execPath, '-e', js]).exit).code, 0);
  assert.equal(fs.readFileSync(out, 'utf8'), 't');
});

// ---- Playwright side: e2e/support/e2e-lock.mjs (called from playwright.config.ts) ----

const e2eLock = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e', 'support', 'e2e-lock.mjs');

/** A node process that takes the e2e lock like the Playwright config does, then holds it for `holdMs` and releases it. */
function runE2e(sb, holdMs, extraEnv = {}) {
  const js = `
    const { acquireE2eLock, releaseE2eLock } = await import(${JSON.stringify(e2eLock)});
    acquireE2eLock();
    console.log('GOT');
    await new Promise((r) => setTimeout(r, ${holdMs}));
    releaseE2eLock();
  `;
  const p = spawn(process.execPath, ['--input-type=module', '-e', js], { env: { ...sb.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = { stdout: '', stderr: '', exit: new Promise((r) => p.on('close', (code) => r(code))), proc: p };
  p.stdout.on('data', (d) => (out.stdout += d));
  p.stderr.on('data', (d) => (out.stderr += d));
  return out;
}

const e2eLockFile = (sb) => path.join(sb.tmp, 'family-budget-e2e.lock');

test('a second Playwright-style invocation waits while the first holds the e2e lock, then proceeds', async () => {
  const sb = sandbox();
  const a = runE2e(sb, 600);
  assert.ok(await waitFor(() => a.stdout.includes('GOT')), 'A got the lock');
  assert.equal(JSON.parse(fs.readFileSync(e2eLockFile(sb), 'utf8')).pid, a.proc.pid);
  const b = runE2e(sb, 0);
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(b.stdout.includes('GOT'), false, 'B must wait while A holds the lock');
  assert.equal(await a.exit, 0);
  assert.equal(await b.exit, 0);
  assert.ok(b.stdout.includes('GOT'));
  assert.equal(fs.existsSync(e2eLockFile(sb)), false);
});

test('Playwright-style lock under with-lock e2e does not deadlock (re-entrant)', async () => {
  const sb = sandbox();
  const js = `
    const { acquireE2eLock, releaseE2eLock } = await import(${JSON.stringify(e2eLock)});
    acquireE2eLock(); releaseE2eLock(); console.log('DONE');
  `;
  const p = spawn(process.execPath, [script, 'e2e', '--', process.execPath, '--input-type=module', '-e', js], {
    env: { ...sb.env, WITH_LOCK_TIMEOUT_MIN: '0.02' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  p.stdout.on('data', (d) => (stdout += d));
  const code = await new Promise((r) => p.on('close', r));
  assert.equal(code, 0);
  assert.match(stdout, /DONE/);
  assert.equal(fs.existsSync(e2eLockFile(sb)), false);
});

test('a crashed Playwright run (dead pid) leaves a stale e2e lock that the next run takes over; process exit releases the lock', async () => {
  const sb = sandbox();
  fs.writeFileSync(e2eLockFile(sb), JSON.stringify({ pid: deadPid(), cwd: '/x', started: 'then' }));
  const a = runE2e(sb, 0);
  assert.equal(await a.exit, 0);
  assert.match(a.stderr, /taking over/);
  // exits without calling releaseE2eLock: the exit handler still frees the lock
  const js = `const { acquireE2eLock } = await import(${JSON.stringify(e2eLock)}); acquireE2eLock();`;
  const p = spawn(process.execPath, ['--input-type=module', '-e', js], { env: sb.env, stdio: 'ignore' });
  assert.equal(await new Promise((r) => p.on('close', r)), 0);
  assert.equal(fs.existsSync(e2eLockFile(sb)), false);
});
