#!/usr/bin/env node
/**
 * task-clean - remove the worktree and local branch of a merged task.
 *
 *   pnpm task:clean T-xxx [--remote]
 *
 * Run from the main checkout. Refuses unless `gh pr view` reports the PR of the branch as MERGED, and unless deleting
 * the local branch loses nothing: its HEAD must equal the PR's `headRefOid`, or the branch must be fully contained in
 * origin/master. Otherwise it lists the commits that exist only locally (see `decideClean`).
 * The branch is taken from the `branch:` field of the task file on origin/master (a renumbered task keeps its old branch
 * name), falling back to the `task/T-xxx-*` pattern only when `branch:` is null/absent.
 * `--remote` also deletes `origin/<branch>` (skip it when GitHub deletes merged branches itself).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './tasks.mjs';

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

/**
 * Which local branch belongs to the task: the `branch:` frontmatter field when it is set (it must exist locally, no
 * fallback: a renumbered task could otherwise pick another task's leftover branch), else the unique `task/<id>-*`
 * branch. Returns { branch } or { error }.
 */
export function resolveBranch({ id, branchField, localBranches }) {
  if (branchField && branchField !== 'null') {
    if (localBranches.includes(branchField)) return { branch: branchField };
    return { error: `task file of ${id} says branch ${branchField}, but it does not exist locally; nothing to clean (or create it/fix \`branch:\`)` };
  }
  const byId = localBranches.filter((b) => b.startsWith(`task/${id}-`));
  if (byId.length === 1) return { branch: byId[0] };
  return { error: `expected exactly one local branch for ${id}, found ${byId.length} matching task/${id}-*` };
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

  sh('git', ['fetch', 'origin'], mainDir);
  let branchField = null;
  try {
    const name = sh('git', ['ls-tree', '--name-only', 'origin/master', 'tasks/'], mainDir).split('\n').find((f) => f.startsWith(`tasks/${id}-`));
    if (name) branchField = parseFrontmatter(sh('git', ['show', `origin/master:${name}`], mainDir)).data?.branch ?? null;
  } catch {
    /* task file not on origin/master: fall back to the id pattern */
  }
  const localBranches = sh('git', ['branch', '--format=%(refname:short)'], mainDir).split('\n').filter(Boolean);
  const resolved = resolveBranch({ id, branchField, localBranches });
  if (resolved.error) die(resolved.error);
  const branch = resolved.branch;

  let pr;
  try {
    pr = JSON.parse(sh('gh', ['pr', 'view', branch, '--json', 'state,url,headRefOid'], mainDir));
  } catch (e) {
    die(`cannot read the PR of ${branch} with gh (${String(e.stderr ?? e.message).trim()})`);
  }
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
