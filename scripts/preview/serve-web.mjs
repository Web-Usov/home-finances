#!/usr/bin/env node
/* eslint-disable no-console */
// Preview web server: serves the Expo web export of the active release with SPA fallback and
// reverse-proxies `/api` (REST, Swagger UI, swagger.json) to the preview API. `/version.json` describes the deployed build.
// Two layouts:
//   WEB_ROOT=/srv/web node serve-web.mjs                                  static export in $WEB_ROOT, /version.json = $WEB_ROOT/version.json
//   PREVIEW_HOME=/root/workspace/finance-preview node serve-web.mjs       preview: the release is resolved per request through the
//                                                                          `current` symlink, so a deploy needs no restart of this process
// WEB_ROOT wins when both are set; PREVIEW_HOME is the preview's own layout (alias kept for the systemd units).
// Env: WEB_ROOT, PREVIEW_HOME, WEB_PORT (8100), WEB_HOST (0.0.0.0; e.g. a LAN IP or 127.0.0.1 to restrict), API_PROXY_TARGET (http://127.0.0.1:3100)
import { createReadStream, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const fixedRoot = process.env.WEB_ROOT ? resolve(process.env.WEB_ROOT) : null;
const home = process.env.PREVIEW_HOME ?? '/root/workspace/finance-preview';
const port = Number(process.env.WEB_PORT ?? 8100);
const host = process.env.WEB_HOST ?? '0.0.0.0';
const target = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3100');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/** Root of the active release's web export, or null when nothing is deployed yet. */
function releaseDirs() {
  if (fixedRoot) return { webRoot: fixedRoot, versionFile: join(fixedRoot, 'version.json') };
  try {
    const slot = realpathSync(join(home, 'current'));
    return { webRoot: join(slot, '.preview', 'web'), versionFile: join(slot, '.preview', 'version.json') };
  } catch {
    return null;
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function proxy(req, res) {
  const upstream = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: req.headers.host ?? target.host },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    if (!res.headersSent) send(res, 502, `API unavailable: ${err.message}\n`);
    else res.destroy();
  });
  req.pipe(upstream);
}

function serveFile(req, res, file, immutable) {
  let size;
  try {
    size = statSync(file).size; // the file can vanish between the existence check and here (deploy in progress)
  } catch {
    return send(res, 404, 'Not found\n');
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Content-Length': size,
    // Hashed bundles under /_expo/static never change; everything else must be revalidated after a deploy.
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy()); // headers are already sent: closing the socket is the only honest signal
  stream.pipe(res);
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function handle(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    return send(res, 400, 'Bad request\n');
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) return proxy(req, res);

  const dirs = releaseDirs();
  if (!dirs) return send(res, 503, 'No release deployed yet\n');

  if (pathname === '/version.json') {
    try {
      return send(res, 200, req.method === 'HEAD' ? '' : readFileSync(dirs.versionFile), 'application/json; charset=utf-8');
    } catch {
      return send(res, 404, 'version.json missing\n');
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n');

  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(dirs.webRoot, safe);
  if (!file.startsWith(dirs.webRoot + sep) && file !== dirs.webRoot) return send(res, 403, 'Forbidden\n');
  const asset = isFile(file);
  if (!asset) file = join(dirs.webRoot, 'index.html'); // SPA fallback for Expo Router routes
  serveFile(req, res, file, asset && pathname.startsWith('/_expo/static/'));
}

const server = createServer((req, res) => {
  try {
    handle(req, res);
  } catch (err) {
    console.error('request failed:', err);
    if (!res.headersSent) send(res, 500, 'Internal error\n');
    else res.destroy();
  }
});
server.on('clientError', (_err, socket) => socket.destroy());
server.listen(port, host, () => {
  console.log(`preview web listening on http://${host}:${port} (${fixedRoot ? `root ${fixedRoot}` : `home ${home}`}, api ${target.origin})`);
});
