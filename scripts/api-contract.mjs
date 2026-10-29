#!/usr/bin/env node
// Contract gate: regenerate apps/api/openapi.json and the Orval client, then fail
// if anything differs from what is committed (or new files appeared).
import { spawnSync } from 'node:child_process';

const paths = ['apps/api/openapi.json', 'apps/mobile/src/api'];
const run = (cmd) => spawnSync(cmd, { shell: true, stdio: 'inherit' }).status === 0;
const out = (cmd) => spawnSync(cmd, { shell: true, encoding: 'utf8' }).stdout.trim();

if (!run('pnpm api:generate')) process.exit(1);

const diff = run(`git diff --exit-code -- ${paths.join(' ')}`);
const untracked = out(`git ls-files --others --exclude-standard -- ${paths.join(' ')}`);
if (!diff || untracked) {
  if (untracked) console.error(`Untracked generated files:\n${untracked}`);
  console.error(
    '\n✖ API contract is out of date. Run `pnpm api:generate` and commit apps/api/openapi.json and apps/mobile/src/api.',
  );
  process.exit(1);
}
console.log('✔ API contract is up to date');
