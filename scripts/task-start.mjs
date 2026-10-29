#!/usr/bin/env node
/**
 * task-start - claim a task: worktree + branch + env files + install + claim commit.
 *
 *   pnpm task:start T-xxx
 *
 * Run it from the main checkout (or any worktree; the main checkout is found through git).
 * Steps: validate the task on origin/master (todo, depends done, blocked_by empty) -> git fetch ->
 * `git worktree add ../finance-wt/t-xxx-slug -b task/T-xxx-slug origin/master` -> copy apps/api/.env and
 * apps/api/.env.test (from the main checkout, else from .env.test.example) -> `pnpm install --frozen-lockfile` ->
 * status in_progress + branch -> board -> commit `chore(tasks): start T-xxx [T-xxx]`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseFrontmatter } from './tasks.mjs';

const id = process.argv[2];
if (!/^T-\d{3,}$/.test(id ?? '')) die('usage: pnpm task:start T-xxx');

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function die(msg) {
  console.error(`task:start: ${msg}`);
  process.exit(1);
}
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) die(`\`${cmd} ${args.join(' ')}\` failed (exit ${r.status})`);
}

// main checkout = parent of the common .git dir (works from any worktree)
const main = path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd()));

console.log('git fetch origin ...');
git(['fetch', 'origin'], main);

// validate against origin/master (the base of the new branch)
const files = git(['ls-tree', '--name-only', 'origin/master', 'tasks/'], main).split('\n');
const tasks = files
  .filter((f) => /^tasks\/T-\d+-.*\.md$/.test(f))
  .map((f) => ({ f, data: parseFrontmatter(git(['show', `origin/master:${f}`], main)).data }))
  .filter((t) => t.data);
const task = tasks.find((t) => t.data.id === id);
if (!task) die(`${id} not found on origin/master (is the task file merged?)`);
const d = task.data;
if (d.status !== 'todo') die(`${id} has status "${d.status}", expected todo`);
if ((d.blocked_by ?? []).length) die(`${id} is blocked by ${d.blocked_by.join(', ')}`);
const notDone = (d.depends ?? []).filter((dep) => tasks.find((t) => t.data.id === dep)?.data.status !== 'done');
if (notDone.length) die(`${id} depends on unfinished task(s): ${notDone.join(', ')}`);

const slug = path.basename(task.f, '.md').replace(/^T-\d+-/, '');
const branch = `task/${id}-${slug}`;
const wtPath = path.resolve(main, '..', 'finance-wt', `${id.toLowerCase()}-${slug}`);
if (fs.existsSync(wtPath)) die(`${wtPath} already exists (continue there, or run pnpm task:clean ${id})`);
if (git(['branch', '--list', branch], main) || git(['branch', '-r', '--list', `origin/${branch}`], main)) {
  die(`branch ${branch} already exists locally or on origin`);
}

console.log(`creating worktree ${wtPath} on ${branch}`);
git(['worktree', 'add', wtPath, '-b', branch, 'origin/master'], main);

const apiDir = path.join(wtPath, 'apps/api');
const mainApi = path.join(main, 'apps/api');
if (fs.existsSync(path.join(mainApi, '.env'))) fs.copyFileSync(path.join(mainApi, '.env'), path.join(apiDir, '.env'));
else console.warn('warning: no apps/api/.env in the main checkout; copy apps/api/.env.example and adjust it');
const envTestSrc = ['.env.test', '.env.test.example'].map((f) => path.join(mainApi, f)).find((f) => fs.existsSync(f));
if (envTestSrc) fs.copyFileSync(envTestSrc, path.join(apiDir, '.env.test'));
console.log(`env files: .env from main, .env.test from ${envTestSrc ? path.basename(envTestSrc) : 'nowhere (missing!)'}`);

run('pnpm', ['install', '--frozen-lockfile'], wtPath);
run('node', ['scripts/tasks.mjs', 'set', id, 'in_progress', '--branch', branch], wtPath);
run('node', ['scripts/tasks.mjs', 'board'], wtPath);
run('git', ['add', 'tasks'], wtPath);
run('git', ['commit', '-m', `chore(tasks): start ${id} [${id}]`], wtPath);

console.log(`\n✔ ${id} claimed.\nWorktree: ${wtPath}\nBranch:   ${branch}\nContinue there: cd ${wtPath}`);
