#!/usr/bin/env node
/* eslint-disable no-console */
// Preview web server: serves the Expo web export of the active release with SPA fallback and
// reverse-proxies `/api` (REST, Swagger UI, swagger.json) to the preview API. `/version.json` describes the deployed build.
// The release is resolved per request through the `current` symlink, so a deploy needs no restart of this process.
//
//   PREVIEW_HOME=/root/workspace/finance-preview node serve-web.mjs
// Env: PREVIEW_HOME, WEB_PORT (8100), WEB_HOST (0.0.0.0), API_PROXY_TARGET (http://127.0.0.1:3100)
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

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

function serveFile(res, file, immutable) {
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Content-Length': statSync(file).size,
    // Hashed bundles under /_expo/static never change; everything else must be revalidated after a deploy.
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);

  if (pathname === '/api' || pathname.startsWith('/api/')) return proxy(req, res);

  const dirs = releaseDirs();
  if (!dirs) return send(res, 503, 'No release deployed yet\n');

  if (pathname === '/version.json') {
    if (!existsSync(dirs.versionFile)) return send(res, 404, 'version.json missing\n');
    return send(res, 200, readFileSync(dirs.versionFile), 'application/json; charset=utf-8');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n');

  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(dirs.webRoot, safe);
  if (!file.startsWith(dirs.webRoot + sep) && file !== dirs.webRoot) return send(res, 403, 'Forbidden\n');
  const isAsset = existsSync(file) && statSync(file).isFile();
  if (!isAsset) file = join(dirs.webRoot, 'index.html'); // SPA fallback for Expo Router routes
  if (!existsSync(file)) return send(res, 503, 'Release has no web export\n');
  serveFile(res, file, isAsset && pathname.startsWith('/_expo/static/'));
}).listen(port, host, () => {
  console.log(`preview web listening on http://${host}:${port} (home ${home}, api ${target.origin})`);
});
