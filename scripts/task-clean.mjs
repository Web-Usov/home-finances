#!/usr/bin/env node
/**
 * task-clean - remove the worktree and local branch of a merged task.
 *
 *   pnpm task:clean T-xxx [--remote]
 *
 * Run from the main checkout. Refuses unless `gh pr view` reports the PR of the branch as MERGED, and unless deleting
 * the local branch loses nothing: its HEAD must equal the PR's `headRefOid`, or the branch must be fully contained in
 * origin/master. Otherwise it lists the commits that exist only locally (see `decideClean`).
 * `--remote` also deletes `origin/<branch>` (skip it when GitHub deletes merged branches itself).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Pure decision: may the local branch be deleted?
 * pr: { state, url, headRefOid } from gh; localHead: SHA of the local branch; inMaster: branch is an ancestor of
 * origin/master; unpushed: `git log --oneline` lines of commits not in the PR head.
 */
export function decideClean({ pr, branch, localHead, inMaster, unpushed = [] }) {
  if (pr.state !== 'MERGED') return { ok: false, reason: `PR ${pr.url} is ${pr.state}, not MERGED; refusing to clean` };
  if (localHead === pr.headRefOid) return { ok: true };
  if (inMaster) return { ok: true };
  const list = unpushed.length ? `\n  ${unpushed.join('\n  ')}` : ' (could not be listed)';
  return {
    ok: false,
    reason:
      `local ${branch} (${localHead.slice(0, 9)}) differs from the merged PR head (${String(pr.headRefOid).slice(0, 9)}) ` +
      `and is not contained in origin/master; deleting it would lose commits that were never pushed:${list}\n` +
      `Push them (or open a follow-up PR) first, or delete the branch by hand if they are not needed.`,
  };
}

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function die(msg) {
  console.error(`task:clean: ${msg}`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
  const [id, ...flags] = process.argv.slice(2);
  if (!/^T-\d{3,}$/.test(id ?? '')) die('usage: pnpm task:clean T-xxx [--remote]');

  const common = sh('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd());
  const mainDir = path.dirname(common);

  const branches = sh('git', ['branch', '--list', `task/${id}-*`, '--format=%(refname:short)'], mainDir).split('\n').filter(Boolean);
  if (branches.length !== 1) die(`expected exactly one local branch task/${id}-*, found ${branches.length}`);
  const branch = branches[0];

  let pr;
  try {
    pr = JSON.parse(sh('gh', ['pr', 'view', branch, '--json', 'state,url,headRefOid'], mainDir));
  } catch (e) {
    die(`cannot read the PR of ${branch} with gh (${String(e.stderr ?? e.message).trim()})`);
  }
  sh('git', ['fetch', 'origin'], mainDir);
  const localHead = sh('git', ['rev-parse', branch], mainDir);
  const git = (args) => {
    try {
      return { ok: true, out: sh('git', args, mainDir) };
    } catch {
      return { ok: false, out: '' };
    }
  };
  const inMaster = git(['merge-base', '--is-ancestor', branch, 'origin/master']).ok;
  const prHeadKnown = pr.headRefOid && git(['cat-file', '-e', `${pr.headRefOid}^{commit}`]).ok;
  const base = prHeadKnown ? pr.headRefOid : 'origin/master';
  const unpushed = git(['log', '--oneline', `${base}..${branch}`]).out.split('\n').filter(Boolean);
  const verdict = decideClean({ pr, branch, localHead, inMaster, unpushed });
  if (!verdict.ok) die(`${verdict.reason} [${id}]`);

  const wtPath = sh('git', ['worktree', 'list', '--porcelain'], mainDir)
    .split('\n\n')
    .map((b) => ({ p: b.match(/^worktree (.*)$/m)?.[1], br: b.match(/^branch refs\/heads\/(.*)$/m)?.[1] }))
    .find((w) => w.br === branch)?.p;
  if (wtPath && fs.existsSync(wtPath)) {
    sh('git', ['worktree', 'remove', wtPath], mainDir); // no --force: refuses a dirty worktree
    console.log(`removed worktree ${wtPath}`);
  }
  sh('git', ['branch', '-D', branch], mainDir);
  console.log(`deleted local branch ${branch}`);
  if (flags.includes('--remote')) {
    try {
      sh('git', ['push', 'origin', '--delete', branch], mainDir);
      console.log(`deleted origin/${branch}`);
    } catch {
      console.log(`origin/${branch} already gone`);
    }
  }
  sh('git', ['fetch', 'origin', '--prune'], mainDir);
  console.log(`✔ ${id} cleaned. Update master: git pull --ff-only (mainDir checkout)`);
}
