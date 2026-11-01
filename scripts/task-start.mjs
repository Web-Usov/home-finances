#!/usr/bin/env node
/**
 * task-start - claim a task: worktree + branch + env files + install + claim commit.
 *
 *   pnpm task:start T-xxx [--keep]
 *   pnpm task:start --new "<title>" --epic E-xx --area <api|mobile|infra|docs|design> --size <S|M> [--keep]
 *
 * Run it from the main checkout (or any worktree; the main checkout is found through git).
 * Steps: validate the task on origin/master (todo, depends done, blocked_by empty) -> git fetch ->
 * `git worktree add ../finance-wt/t-xxx-slug -b task/T-xxx-slug origin/master` -> copy apps/api/.env and
 * apps/api/.env.test (from the main checkout, else from .env.test.example) -> `pnpm install --frozen-lockfile --prefer-offline` (no timeout) ->
 * status in_progress + branch -> board -> commit `chore(tasks): start T-xxx [T-xxx]`.
 *
 * `--new` first creates the task file from tasks/_template.md with the next free id (highest id in task files on origin/master, in
 * task files of any local/remote ref, or in a task branch name, plus one) and then claims it in the same commit. Use it for follow-up work discovered
 * while implementing or reviewing; fill in Goal/Context/DoD in the worktree afterwards.
 *
 * Id race: `--new` runs under the machine-wide lock `task-id` (scripts/lib/lock.mjs) from `git fetch` until the claim branch is
 * pushed to origin (right after the claim commit), so a concurrent `--new` fetches after that push and sees the id as taken.
 * The lock is therefore held through `pnpm install` and the commit hooks of the claim commit (minutes under load); other `--new` calls wait.
 *
 * If a step fails after the worktree was created, the worktree and branch are removed again so that a retry starts
 * clean; `--keep` leaves them in place for debugging. `TASK_START_SKIP_INSTALL=1` skips `pnpm install` (tests only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './tasks.mjs';
import { acquireSync } from './lib/lock.mjs';

const AREAS = ['api', 'mobile', 'infra', 'docs', 'design'];
const SIZES = ['S', 'M'];

/**
 * Every task id already taken anywhere: task files on origin/master, task files under tasks/ in every remote and local
 * ref (unmerged PR branches carry task files whose ids are not in any branch name) and ids in task branch names.
 * `gitFn(args)` runs git in the main checkout and returns trimmed stdout.
 */
export function collectTaskIds(gitFn) {
  const ids = new Set();
  const fromFiles = (out) => {
    for (const f of out.split('\n')) {
      const id = /(?:^|\/)(T-\d+)-[^/]*\.md$/.exec(f)?.[1];
      if (id) ids.add(id);
    }
  };
  const refs = new Set(['origin/master']);
  for (const prefix of ['refs/remotes/origin', 'refs/heads']) {
    for (const r of gitFn(['for-each-ref', '--format=%(refname)', prefix]).split('\n').filter(Boolean)) refs.add(r);
  }
  for (const ref of refs) {
    try {
      fromFiles(gitFn(['ls-tree', '--name-only', ref, 'tasks/']));
    } catch {
      /* ref without a tasks/ dir or an unreadable ref: nothing to collect */
    }
  }
  for (const b of gitFn(['branch', '-a', '--format=%(refname:short)']).split('\n')) {
    const id = /(?:^|\/)task\/(T-\d+)-/.exec(b)?.[1];
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Next free numeric id given every known id (task files and task branches). */
export function nextTaskId(ids) {
  const max = ids.map((i) => Number(/^T-(\d+)$/.exec(i)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0);
  return `T-${String(max + 1).padStart(3, '0')}`;
}

export function slugify(title, maxLen = 40) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (words.length <= maxLen) return words;
  const cut = words.slice(0, maxLen);
  return cut.slice(0, Math.max(cut.lastIndexOf('-'), 1)).replace(/-+$/, '');
}

/** Turns tasks/_template.md into a new task file (status todo; the claim sets in_progress afterwards). */
export function renderNewTask(template, { id, title, epic, area, size }) {
  if (/[#\n"]/.test(title)) throw new Error('title must not contain #, quotes or newlines');
  return template
    .replace(/^id: .*$/m, `id: ${id}`)
    .replace(/^title: .*$/m, `title: "${title}"`)
    .replace(/^epic: [^\s#]*/m, `epic: ${epic}`)
    .replace(/^area: [^\s#]*/m, `area: ${area}`)
    .replace(/^size: [^\s#]*/m, `size: ${size}`)
    .replace(/^# T-000\. .*$/m, `# ${id}. ${title}`);
}

export function parseArgs(argv) {
  const out = { keep: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep') out.keep = true;
    else if (['--new', '--epic', '--area', '--size'].includes(a)) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${a} needs a value`);
      out[a.slice(2)] = argv[++i];
    } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else out.positional.push(a);
  }
  return out;
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function die(msg) {
  console.error(`task:start: ${msg}`);
  process.exit(1);
}
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`\`${cmd} ${args.join(' ')}\` failed (exit ${r.status})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    die(e.message);
  }
  const creating = opts.new !== undefined;
  const usage = 'usage: pnpm task:start T-xxx [--keep]  |  pnpm task:start --new "<title>" --epic E-xx --area <a> --size <S|M> [--keep]';
  if (creating) {
    if (opts.positional.length || !opts.new.trim()) die(usage);
    if (!/^E-\d{2,}$/.test(opts.epic ?? '')) die(`--epic E-xx is required\n${usage}`);
    if (!AREAS.includes(opts.area)) die(`--area must be one of ${AREAS.join('|')}`);
    if (!SIZES.includes(opts.size)) die(`--size must be one of ${SIZES.join('|')}`);
    if (!slugify(opts.new)) die('the title must contain latin letters or digits (it becomes the branch slug)');
  } else if (opts.positional.length !== 1 || !/^T-\d{3,}$/.test(opts.positional[0])) die(usage);

  // main checkout = parent of the common .git dir (works from any worktree)
  const mainDir = path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd()));

  let idLock = null;
  if (creating) {
    try {
      idLock = acquireSync('task-id');
    } catch (e) {
      die(e.message);
    }
  }

  console.log('git fetch origin ...');
  git(['fetch', 'origin'], mainDir);

  const files = git(['ls-tree', '--name-only', 'origin/master', 'tasks/'], mainDir).split('\n');
  const tasks = files
    .filter((f) => /^tasks\/T-\d+-.*\.md$/.test(f))
    .map((f) => ({ f, data: parseFrontmatter(git(['show', `origin/master:${f}`], mainDir)).data }))
    .filter((t) => t.data);

  let id;
  let slug;
  let newTaskText = null;
  if (creating) {
    const epics = git(['ls-tree', '--name-only', 'origin/master', 'epics/'], mainDir).split('\n');
    if (!epics.some((e) => e.startsWith(`epics/${opts.epic}-`))) die(`epic ${opts.epic} not found on origin/master`);
    id = nextTaskId([...tasks.map((t) => t.data.id), ...collectTaskIds((args) => git(args, mainDir))]);
    slug = slugify(opts.new);
    newTaskText = renderNewTask(git(['show', 'origin/master:tasks/_template.md'], mainDir), { id, title: opts.new.trim(), ...opts });
  } else {
    id = opts.positional[0];
    const task = tasks.find((t) => t.data.id === id);
    if (!task) die(`${id} not found on origin/master (is the task file merged? Create it with --new)`);
    const d = task.data;
    if (d.status !== 'todo') die(`${id} has status "${d.status}", expected todo`);
    if ((d.blocked_by ?? []).length) die(`${id} is blocked by ${d.blocked_by.join(', ')}`);
    const notDone = (d.depends ?? []).filter((dep) => tasks.find((t) => t.data.id === dep)?.data.status !== 'done');
    if (notDone.length) die(`${id} depends on unfinished task(s): ${notDone.join(', ')}`);
    slug = path.basename(task.f, '.md').replace(/^T-\d+-/, '');
  }

  const branch = `task/${id}-${slug}`;
  const wtPath = path.resolve(mainDir, '..', 'finance-wt', `${id.toLowerCase()}-${slug}`);
  if (fs.existsSync(wtPath)) die(`${wtPath} already exists (continue there, or run pnpm task:clean ${id})`);
  if (git(['branch', '--list', branch], mainDir) || git(['branch', '-r', '--list', `origin/${branch}`], mainDir)) {
    die(`branch ${branch} already exists locally or on origin`);
  }

  console.log(`creating worktree ${wtPath} on ${branch}`);
  git(['worktree', 'add', wtPath, '-b', branch, 'origin/master'], mainDir);

  try {
    const apiDir = path.join(wtPath, 'apps/api');
    const mainApi = path.join(mainDir, 'apps/api');
    if (fs.existsSync(path.join(mainApi, '.env'))) fs.copyFileSync(path.join(mainApi, '.env'), path.join(apiDir, '.env'));
    else console.warn('warning: no apps/api/.env in the main checkout; copy apps/api/.env.example and adjust it');
    const envTestSrc = ['.env.test', '.env.test.example'].map((f) => path.join(mainApi, f)).find((f) => fs.existsSync(f));
    if (envTestSrc) fs.copyFileSync(envTestSrc, path.join(apiDir, '.env.test'));
    console.log(`env files: .env from main, .env.test from ${envTestSrc ? path.basename(envTestSrc) : 'nowhere (missing!)'}`);

    if (!process.env.TASK_START_SKIP_INSTALL) run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], wtPath); // no timeout: a loaded machine may need minutes
    if (newTaskText) {
      const file = path.join(wtPath, 'tasks', `${id}-${slug}.md`);
      fs.writeFileSync(file, newTaskText);
      console.log(`created ${path.relative(wtPath, file)} from tasks/_template.md`);
    }
    run('node', ['scripts/tasks.mjs', 'set', id, 'in_progress', '--branch', branch], wtPath);
    run('node', ['scripts/tasks.mjs', 'board'], wtPath);
    run('git', ['add', 'tasks'], wtPath);
    const subject = creating ? `chore(tasks): add and start ${id} [${id}]` : `chore(tasks): start ${id} [${id}]`;
    run('git', ['commit', '-m', subject], wtPath);
    // Publish the claim while still holding the task-id lock, so concurrent `--new` scans see this id.
    if (creating) {
      run('git', ['push', '-u', 'origin', branch], wtPath);
      idLock.release();
    }
  } catch (e) {
    console.error(`\ntask:start: failed after the worktree was created: ${e.message}`);
    if (opts.keep) {
      console.error(`--keep: worktree ${wtPath} and branch ${branch} are KEPT (nothing was rolled back).`);
      console.error(`To resume: cd ${wtPath}, fix the cause (e.g. pnpm install --frozen-lockfile), then finish the claim by hand:`);
      console.error(`  node scripts/tasks.mjs set ${id} in_progress --branch ${branch} && node scripts/tasks.mjs board && git add tasks && git commit -m "chore(tasks): start ${id} [${id}]"`);
      console.error(`To discard: git worktree remove --force ${wtPath} && git branch -D ${branch}`);
    } else {
      try {
        git(['worktree', 'remove', '--force', wtPath], mainDir);
        git(['branch', '-D', branch], mainDir);
        console.error(`Rolled back: worktree ${wtPath} and branch ${branch} were removed, nothing is left behind. To resume, fix the cause and run the same command again (add --keep to keep the worktree for inspection instead).`);
      } catch (re) {
        console.error(`Rollback failed (${String(re.stderr ?? re.message).trim()}). Remove by hand: git worktree remove --force ${wtPath} && git branch -D ${branch}`);
      }
    }
    process.exit(1);
  }

  idLock?.release();
  console.log(`\n✔ ${id} claimed.\nWorktree: ${wtPath}\nBranch:   ${branch}\nContinue there: cd ${wtPath}`);
  if (creating) console.log(`Fill in Goal / Context / Definition of Done in tasks/${id}-${slug}.md before implementing.`);
}
