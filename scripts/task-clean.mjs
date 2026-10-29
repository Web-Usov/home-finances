#!/usr/bin/env node
/**
 * task-clean - remove the worktree and local branch of a merged task.
 *
 *   pnpm task:clean T-xxx [--remote]
 *
 * Run from the main checkout. Refuses unless `gh pr view` reports the PR of the branch as MERGED.
 * `--remote` also deletes `origin/<branch>` (skip it when GitHub deletes merged branches itself).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [id, ...flags] = process.argv.slice(2);
if (!/^T-\d{3,}$/.test(id ?? '')) die('usage: pnpm task:clean T-xxx [--remote]');

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function die(msg) {
  console.error(`task:clean: ${msg}`);
  process.exit(1);
}

const common = sh('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd());
const main = path.dirname(common);

const branches = sh('git', ['branch', '--list', `task/${id}-*`, '--format=%(refname:short)'], main).split('\n').filter(Boolean);
if (branches.length !== 1) die(`expected exactly one local branch task/${id}-*, found ${branches.length}`);
const branch = branches[0];

let pr;
try {
  pr = JSON.parse(sh('gh', ['pr', 'view', branch, '--json', 'state,url'], main));
} catch (e) {
  die(`cannot read the PR of ${branch} with gh (${String(e.stderr ?? e.message).trim()})`);
}
if (pr.state !== 'MERGED') die(`PR ${pr.url} is ${pr.state}, not MERGED; refusing to clean ${id}`);

const wtPath = sh('git', ['worktree', 'list', '--porcelain'], main)
  .split('\n\n')
  .map((b) => ({ p: b.match(/^worktree (.*)$/m)?.[1], br: b.match(/^branch refs\/heads\/(.*)$/m)?.[1] }))
  .find((w) => w.br === branch)?.p;
if (wtPath && fs.existsSync(wtPath)) {
  sh('git', ['worktree', 'remove', wtPath], main); // no --force: refuses a dirty worktree
  console.log(`removed worktree ${wtPath}`);
}
sh('git', ['branch', '-D', branch], main);
console.log(`deleted local branch ${branch}`);
if (flags.includes('--remote')) {
  try {
    sh('git', ['push', 'origin', '--delete', branch], main);
    console.log(`deleted origin/${branch}`);
  } catch {
    console.log(`origin/${branch} already gone`);
  }
}
sh('git', ['fetch', 'origin', '--prune'], main);
console.log(`✔ ${id} cleaned. Update master: git pull --ff-only (main checkout)`);
