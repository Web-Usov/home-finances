import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'with-lock.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sandbox() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'with-lock-test-'));
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

async function waitFor(cond, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(20);
  }
  return false;
}

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
  await sleep(300);
  r.proc.kill('SIGINT');
  assert.equal((await r.exit).code, 130);
  assert.equal(JSON.parse(fs.readFileSync(sb.lock, 'utf8')).pid, process.pid);
});
