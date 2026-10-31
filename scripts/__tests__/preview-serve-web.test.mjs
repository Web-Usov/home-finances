// serve-web.mjs: static export with SPA fallback, /version.json, and /api reverse proxy (preview environment).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { installGuards, makeTmp, repoRoot } from './helpers.mjs';

installGuards();

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

let home;
let webPort;
let child;
let stubApi;
const seen = [];

const get = async (p, init) => {
  const res = await fetch(`http://127.0.0.1:${webPort}${p}`, init);
  return { status: res.status, type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), body: await res.text() };
};

before(async () => {
  home = makeTmp('preview-web-');
  const slot = path.join(home, 'slots', 'a');
  fs.mkdirSync(path.join(slot, '.preview', 'web', '_expo', 'static', 'js'), { recursive: true });
  fs.writeFileSync(path.join(slot, '.preview', 'web', 'index.html'), '<html>app</html>');
  fs.writeFileSync(path.join(slot, '.preview', 'web', '_expo', 'static', 'js', 'a.js'), 'console.log(1)');
  fs.writeFileSync(path.join(slot, '.preview', 'version.json'), JSON.stringify({ sha: 'abc', subject: 'demo' }));
  fs.symlinkSync(slot, path.join(home, 'current'));

  const apiPort = await freePort();
  stubApi = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    res.end('{"status":"ok"}');
  });
  await new Promise((r) => stubApi.listen(apiPort, '127.0.0.1', r));

  webPort = await freePort();
  child = spawn(process.execPath, [path.join(repoRoot, 'scripts/preview/serve-web.mjs')], {
    env: { ...process.env, PREVIEW_HOME: home, WEB_PORT: String(webPort), WEB_HOST: '127.0.0.1', API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try {
      await get('/');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('serve-web did not start');
});

after(() => {
  child?.kill();
  stubApi?.close();
});

test('serves index.html at / and falls back to it for unknown Expo Router routes', async () => {
  assert.equal((await get('/')).body, '<html>app</html>');
  const deep = await get('/envelopes/some-id');
  assert.equal(deep.status, 200);
  assert.equal(deep.body, '<html>app</html>');
  assert.match(deep.type, /text\/html/);
  assert.equal(deep.cache, 'no-cache');
});

test('serves hashed assets as immutable', async () => {
  const js = await get('/_expo/static/js/a.js');
  assert.equal(js.body, 'console.log(1)');
  assert.match(js.cache, /immutable/);
});

test('/version.json comes from the active release', async () => {
  assert.deepEqual(JSON.parse((await get('/version.json')).body), { sha: 'abc', subject: 'demo' });
});

test('proxies /api and /api/v1/* (including POST bodies) to the API', async () => {
  assert.equal((await get('/api/v1/health')).body, '{"status":"ok"}');
  await get('/api/swagger.json');
  await get('/api/v1/months', { method: 'POST', body: '{}' });
  assert.deepEqual(seen, ['GET /api/v1/health', 'GET /api/swagger.json', 'POST /api/v1/months']);
});

test('path traversal never leaves the web root', async () => {
  const res = await get('/..%2f..%2fversion.json');
  assert.equal(res.body, '<html>app</html>');
});

test('a malformed percent-encoded URL gets 400 and the server keeps answering', async () => {
  const bad = await new Promise((resolve, reject) => {
    // fetch() would normalise the URL, so send the raw request line.
    const sock = net.connect(webPort, '127.0.0.1', () => sock.write('GET /%E0%A4%A HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let data = '';
    sock.on('data', (d) => (data += d));
    sock.on('end', () => resolve(data));
    sock.on('error', reject);
  });
  assert.match(bad, /^HTTP\/1\.1 400/);
  assert.equal((await get('/')).status, 200);
});

test('a client sending garbage does not take the server down', async () => {
  await new Promise((resolve) => {
    const sock = net.connect(webPort, '127.0.0.1', () => sock.write('NOT HTTP AT ALL\r\n\r\n'));
    sock.on('close', resolve);
    sock.on('error', resolve);
  });
  assert.equal((await get('/')).status, 200);
});

test('HEAD answers with headers and no body', async () => {
  const res = await fetch(`http://127.0.0.1:${webPort}/`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-length'), String('<html>app</html>'.length));
  assert.equal(await res.text(), '');
  const ver = await fetch(`http://127.0.0.1:${webPort}/version.json`, { method: 'HEAD' });
  assert.equal(await ver.text(), '');
});

test('a release that lost its files answers 404/503 instead of crashing', async () => {
  const gone = path.join(home, 'slots', 'a', '.preview', 'web', 'index.html');
  const saved = fs.readFileSync(gone);
  fs.rmSync(gone);
  try {
    assert.equal((await get('/some/route')).status, 404);
    assert.equal((await get('/')).status, 404);
  } finally {
    fs.writeFileSync(gone, saved);
  }
  assert.equal((await get('/')).status, 200);
});
