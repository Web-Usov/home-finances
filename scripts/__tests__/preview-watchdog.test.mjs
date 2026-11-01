// watchdog.sh: restarts the preview API only after consecutive failed health checks (T-039).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { installGuards, makeTmp, repoRoot } from './helpers.mjs';

installGuards();

const execFileAsync = promisify(execFile); // async: the in-process health server must keep answering

const script = path.join(repoRoot, 'scripts/preview/watchdog.sh');
let healthy = true;
let server;
let port;
let dir;

before(async () => {
  server = http.createServer((_req, res) => {
    res.statusCode = healthy ? 200 : 503;
    res.end('x');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  dir = makeTmp('watchdog-');
  fs.mkdirSync(path.join(dir, 'bin'));
  // Fake systemctl: `is-active` prints $FAKE_UNIT_STATE, every call is appended to calls.log.
  fs.writeFileSync(
    path.join(dir, 'bin/systemctl'),
    `#!/usr/bin/env bash\necho "$*" >> "${dir}/calls.log"\n[ "$1" = is-active ] && echo "\${FAKE_UNIT_STATE:-active}"\nexit 0\n`,
    { mode: 0o755 },
  );
});

after(() => server.close());

async function run(unitState = 'active', stateFile = path.join(dir, 'failures')) {
  const r = await execFileAsync('bash', [script], {
    encoding: 'utf8',
    env: {
      PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
      HEALTH_URL: `http://127.0.0.1:${port}/api/v1/health`,
      WATCHDOG_STATE: stateFile,
      FAKE_UNIT_STATE: unitState,
    },
  });
  return r.stdout;
}

const restarts = () =>
  (fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8') : '')
    .split('\n')
    .filter((l) => l.startsWith('restart ')).length;

test('T-039: one failed check does not restart, the second consecutive one does', async () => {
  healthy = false;
  await run();
  assert.equal(restarts(), 0);
  assert.match(await run(), /restarting/);
  assert.equal(restarts(), 1);
  assert.equal(fs.existsSync(path.join(dir, 'failures')), false, 'counter is reset after the restart');
});

test('T-039: a healthy check resets the failure counter', async () => {
  const before = restarts();
  healthy = false;
  await run();
  healthy = true;
  await run();
  healthy = false;
  await run();
  assert.equal(restarts(), before);
});

test('T-039: a unit stopped on purpose (inactive) is never restarted', async () => {
  const before = restarts();
  healthy = false;
  await run('inactive');
  await run('inactive');
  await run('inactive');
  assert.equal(restarts(), before);
});

test('T-056: the state directory is created when it is missing', async () => {
  healthy = false;
  const stateFile = path.join(dir, 'fresh', 'state', 'failures');
  await run('active', stateFile);
  assert.equal(fs.readFileSync(stateFile, 'utf8').trim(), '1');
});
