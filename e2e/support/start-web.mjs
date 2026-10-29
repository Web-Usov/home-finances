/* eslint-disable no-console */
// Builds the Expo web bundle (static export) against the e2e API and serves it
// with SPA fallback. A static export is deterministic and much faster to boot in CI
// than the Metro dev server.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { getE2eEnv, repoRoot } from './env.mjs';

const env = getE2eEnv();
const outDir = resolve(repoRoot, 'e2e/.web');

execFileSync('pnpm', ['exec', 'expo', 'export', '--clear', '--platform', 'web', '--output-dir', outDir], {
  cwd: resolve(repoRoot, 'apps/mobile'),
  env: { ...process.env, EXPO_PUBLIC_API_URL: env.apiUrl, CI: '1' },
  stdio: 'inherit',
});

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  let file = join(outDir, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(outDir, 'index.html');
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(Number(env.webPort), '127.0.0.1', () => {
  console.log(`e2e web served at ${env.webUrl}`);
});
