#!/usr/bin/env node
/**
 * tasks - task system tooling (plain Node ESM, no dependencies).
 *
 * Usage:
 *   node scripts/tasks.mjs check [--gh]            validate epics/ and tasks/ (exit 1 on errors)
 *   node scripts/tasks.mjs board [--check]         generate tasks/README.md (counters are printed, not stored); --check fails if stale
 *   node scripts/tasks.mjs next                    list todo tasks whose depends are done and blocked_by is empty
 *   node scripts/tasks.mjs set <T-id> <status> [--branch <name>] [--pr <url>]
 *                                                  update frontmatter in place
 *
 * Task files:  tasks/T-NNN-slug.md   (template: tasks/_template.md)
 * Epic files:  epics/E-NN-slug.md    (see epics/README.md)
 * Frontmatter is a flat subset of YAML: `key: scalar`, `key: [a, b]`, `null`, `# comments`.
 *
 * `check` verifies: required fields and enums, unique ids, file name matches id, epic exists,
 * depends exist and are acyclic, blocked_by ids exist in docs/spec/99-open-questions.md,
 * spec/acceptance ids are defined in docs/spec (via scripts/spec-check.mjs `loadSpecIds`),
 * status done => pr set, no unchecked `- [ ]` in "Definition of Done", non-empty "Result" (HTML comments ignored),
 * status in_progress|review => branch set. `review` is a valid but optional status (the ship flow goes straight to done).
 * Id collisions with origin/master: a task id of this branch that origin/master already uses for a DIFFERENT file name (other
 * slug) is an error (cheap `git ls-tree`; skipped silently without git or an `origin/master` ref).
 * `check --gh` additionally warns when a task is done but its PR is not merged (needs `gh`; skipped silently otherwise).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSpecIds } from './spec-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tasksDir = path.join(root, 'tasks');
const epicsDir = path.join(root, 'epics');
const boardPath = path.join(tasksDir, 'README.md');

const TASK_STATUS = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const EPIC_STATUS = ['planned', 'in_progress', 'done', 'accepted'];
const AREAS = ['api', 'mobile', 'infra', 'docs'];
const SIZES = ['S', 'M'];

// ---------- frontmatter ----------

function parseScalar(raw) {
  const v = raw.trim();
  if (v === 'null' || v === '~' || v === '') return null;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }
  return v.replace(/^["']|["']$/g, '');
}

function stripComment(line) {
  // a comment starts with " #" outside of quotes; values here never contain " #"
  const i = line.search(/\s#/);
  return i === -1 ? line : line.slice(0, i);
}

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const km = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (!km) continue;
    data[km[1]] = parseScalar(stripComment(km[2]));
  }
  return { data, text };
}

function readFrontmatter(file) {
  return parseFrontmatter(fs.readFileSync(file, 'utf8'));
}

/** Body of a `## <heading>` section with HTML comments removed (until the next `## ` or EOF). */
function sectionBody(text, heading) {
  const m = text.match(new RegExp(`^## ${heading}[^\\S\\r\\n]*\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, '') : null;
}

function loadDir(dir, idRe, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && filter.test(f))
    .sort()
    .map((f) => {
      const file = path.join(dir, f);
      const { data, text } = readFrontmatter(file);
      return { file, name: f, rel: path.relative(root, file).split(path.sep).join('/'), data, text };
    });
}

const loadTasks = () => loadDir(tasksDir, null, /^T-.*\.md$/);
const loadEpics = () => loadDir(epicsDir, null, /^E-.*\.md$/);

const taskNum = (id) => parseInt(id.slice(2), 10);

// ---------- check ----------

/** Task file names (tasks/T-*.md basenames) on origin/master; [] when git or the ref is unavailable. */
function originMasterTaskFiles() {
  try {
    const out = execFileSync('git', ['ls-tree', '--name-only', 'origin/master', 'tasks/'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((f) => path.basename(f)).filter((f) => /^T-\d+-.*\.md$/.test(f));
  } catch {
    return [];
  }
}

function check({ gh }) {
  const errors = [];
  const warnings = [];
  const err = (rel, msg) => errors.push(`${rel}: ${msg}`);

  const { ids: specIds } = loadSpecIds();
  const qPath = path.join(root, 'docs/spec/99-open-questions.md');
  const qIds = new Set(fs.existsSync(qPath) ? [...fs.readFileSync(qPath, 'utf8').matchAll(/\*\*\[(Q-\d+)\]\*\*/g)].map((m) => m[1]) : []);

  // epics
  const epics = loadEpics();
  const epicIds = new Map();
  for (const e of epics) {
    const d = e.data;
    if (!d) { err(e.rel, 'missing frontmatter'); continue; }
    if (!/^E-\d{2}$/.test(d.id ?? '')) err(e.rel, `invalid id "${d.id}" (expected E-NN)`);
    else if (!e.name.startsWith(`${d.id}-`)) err(e.rel, `file name does not start with id ${d.id}`);
    if (epicIds.has(d.id)) err(e.rel, `duplicate epic id ${d.id}`);
    epicIds.set(d.id, d);
    if (!d.title) err(e.rel, 'missing title');
    if (!EPIC_STATUS.includes(d.status)) err(e.rel, `invalid status "${d.status}"`);
    if (d.status === 'accepted' && !/^\d{4}-\d{2}-\d{2}$/.test(d.accepted ?? '')) err(e.rel, 'status accepted requires accepted: YYYY-MM-DD');
    if (d.accepted && !/^\d{4}-\d{2}-\d{2}$/.test(d.accepted)) err(e.rel, `invalid accepted date "${d.accepted}"`);
    if (!Array.isArray(d.spec)) err(e.rel, 'spec must be a list');
    else for (const s of d.spec) if (!specIds.has(s)) err(e.rel, `unknown spec rule ${s}`);
  }

  // tasks
  const tasks = loadTasks();
  const byId = new Map();
  for (const t of tasks) {
    const d = t.data;
    if (!d) { err(t.rel, 'missing frontmatter'); continue; }
    const fm = t.name.match(/^(T-\d{3,})-[a-z0-9-]+\.md$/);
    if (!fm) err(t.rel, 'file name must match T-NNN-slug.md');
    if (!/^T-\d{3,}$/.test(d.id ?? '')) err(t.rel, `invalid id "${d.id}" (expected T-NNN)`);
    else if (fm && fm[1] !== d.id) err(t.rel, `file name id ${fm[1]} does not match frontmatter id ${d.id}`);
    if (byId.has(d.id)) err(t.rel, `duplicate task id ${d.id}`);
    byId.set(d.id, t);
    if (!d.title) err(t.rel, 'missing title');
    if (!TASK_STATUS.includes(d.status)) err(t.rel, `invalid status "${d.status}"`);
    if (!AREAS.includes(d.area)) err(t.rel, `invalid area "${d.area}"`);
    if (!SIZES.includes(d.size)) err(t.rel, `invalid size "${d.size}"`);
    if (!epicIds.has(d.epic)) err(t.rel, `unknown epic "${d.epic}"`);
    for (const k of ['depends', 'blocked_by', 'spec', 'acceptance']) {
      if (!Array.isArray(d[k])) err(t.rel, `${k} must be a list (use [])`);
    }
    for (const q of d.blocked_by ?? []) if (!qIds.has(q)) err(t.rel, `blocked_by ${q} not found in docs/spec/99-open-questions.md`);
    for (const s of d.spec ?? []) if (!specIds.has(s)) err(t.rel, `unknown spec rule ${s}`);
    for (const a of d.acceptance ?? []) {
      if (!/^AC-\d+$/.test(a)) err(t.rel, `acceptance "${a}" is not an AC id`);
      else if (!specIds.has(a)) err(t.rel, `unknown acceptance ${a}`);
    }
    if (d.status === 'done' && !d.pr) err(t.rel, 'status done requires pr');
    if (d.status === 'done') {
      const dod = sectionBody(t.text, 'Definition of Done');
      const open = (dod ?? '').split(/\r?\n/).filter((l) => /^\s*- \[ \]/.test(l));
      if (open.length) err(t.rel, `status done but ${open.length} unchecked Definition of Done item(s): ${open.map((l) => l.trim().slice(0, 50)).join(' | ')}`);
      if (!(sectionBody(t.text, 'Result') ?? '').trim()) err(t.rel, 'status done requires a non-empty "## Result" section');
    }
    if ((d.status === 'in_progress' || d.status === 'review') && !d.branch) err(t.rel, `status ${d.status} requires branch`);
    if (!('branch' in d)) err(t.rel, 'missing branch (use null)');
    if (!('pr' in d)) err(t.rel, 'missing pr (use null)');
  }
  for (const t of tasks) {
    for (const dep of t.data?.depends ?? []) {
      if (!byId.has(dep)) err(t.rel, `depends on unknown task ${dep}`);
      else if (dep === t.data.id) err(t.rel, 'depends on itself');
    }
  }

  // id collision with a different task file on origin/master (two branches allocated the same id)
  const masterFiles = originMasterTaskFiles();
  for (const t of tasks) {
    const clash = masterFiles.find((f) => f !== t.name && f.startsWith(`${t.data?.id}-`));
    if (clash) err(t.rel, `task id ${t.data.id} is already used on origin/master by ${clash}; if the file was only renamed on master, run "git merge origin/master" first, otherwise renumber this task (new id, file name, branch)`);
  }

  // cycles (DFS)
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      errors.push(`dependency cycle: ${[...stack.slice(stack.indexOf(id)), id].join(' -> ')}`);
      return;
    }
    state.set(id, 1);
    stack.push(id);
    for (const dep of byId.get(id)?.data?.depends ?? []) if (byId.has(dep)) visit(dep);
    stack.pop();
    state.set(id, 2);
  };
  for (const id of byId.keys()) visit(id);

  if (gh) {
    for (const t of tasks) {
      const d = t.data;
      if (!d?.pr || !/^https?:\/\//.test(d.pr)) continue;
      let state;
      try {
        state = JSON.parse(execFileSync('gh', ['pr', 'view', d.pr, '--json', 'state'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()).state;
      } catch {
        continue; // gh unavailable or PR not reachable: skip silently
      }
      if (d.status === 'done' && state !== 'MERGED') warnings.push(`${t.rel}: status done but PR is ${state}`);
    }
  }

  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    console.error(`tasks check FAILED (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`tasks check OK (${epics.length} epics, ${tasks.length} tasks)`);
}

// ---------- board ----------

/**
 * The committed board is a pure per-task listing: no counters or anything else that depends on more than one task, so
 * two PRs that change different tasks merge textually clean and still equal the regenerated board. Tasks are separated by
 * blank lines (adjacent changed lines would conflict in a 3-way merge). Aggregates go to stdout (`summary`).
 */
function renderBoard() {
  const epics = loadEpics().filter((e) => e.data).sort((a, b) => a.data.id.localeCompare(b.data.id));
  const tasks = loadTasks().filter((t) => t.data).sort((a, b) => taskNum(a.data.id) - taskNum(b.data.id));
  const lines = [
    '# Доска задач (генерируется, не редактировать)',
    '',
    '> Файл создаётся командой `node scripts/tasks.mjs board`. Источник правды — frontmatter файлов `tasks/T-*.md` и `epics/E-*.md`. Сводные счётчики не хранятся в файле: их печатает `pnpm tasks:board`.',
    '',
  ];
  for (const e of epics) {
    const acc = e.data.accepted ? `, принят ${e.data.accepted}` : '';
    lines.push(`## ${e.data.id}. ${e.data.title} — ${e.data.status}${acc}`, '');
    lines.push(`Эпик: [${e.name}](../epics/${e.name})`, '');
    for (const t of tasks.filter((x) => x.data.epic === e.data.id)) {
      const d = t.data;
      const pr = d.pr ? `[PR](${d.pr})` : '—';
      const dep = d.depends.length ? d.depends.join(', ') : '—';
      lines.push(`- [${d.id}](${t.name}) ${d.title} — **${d.status}** · ${d.area} · ${d.size} · depends: ${dep} · ${pr}`, '');
    }
  }
  return lines.join('\n');
}

/** Aggregate counters for stdout (never committed). */
function summary() {
  const tasks = loadTasks().filter((t) => t.data);
  const count = (st) => tasks.filter((t) => t.data.status === st).length;
  const out = [`Total tasks: ${tasks.length} - ${TASK_STATUS.map((s) => `${s}: ${count(s)}`).join(', ')}`];
  for (const e of loadEpics().filter((x) => x.data).sort((a, b) => a.data.id.localeCompare(b.data.id))) {
    const et = tasks.filter((t) => t.data.epic === e.data.id);
    out.push(`  ${e.data.id} ${e.data.status}: ${et.filter((t) => t.data.status === 'done').length}/${et.length} done`);
  }
  return out.join('\n');
}

function board({ checkOnly }) {
  const content = renderBoard();
  if (checkOnly) {
    const current = fs.existsSync(boardPath) ? fs.readFileSync(boardPath, 'utf8') : '';
    if (current !== content) {
      console.error('tasks/README.md is stale. Run: node scripts/tasks.mjs board');
      process.exit(1);
    }
    console.log('tasks board is up to date');
    return;
  }
  fs.writeFileSync(boardPath, content);
  console.log('tasks/README.md written');
  console.log(summary());
}

// ---------- next ----------

function next() {
  const tasks = loadTasks().filter((t) => t.data);
  const done = new Set(tasks.filter((t) => t.data.status === 'done').map((t) => t.data.id));
  const epics = new Map(loadEpics().filter((e) => e.data).map((e) => [e.data.id, e.data.title]));
  const ready = tasks
    .filter((t) => t.data.status === 'todo' && (t.data.depends ?? []).every((d) => done.has(d)) && !(t.data.blocked_by ?? []).length)
    .sort((a, b) => taskNum(a.data.id) - taskNum(b.data.id));
  if (!ready.length) console.log('no ready tasks');
  for (const t of ready) console.log(`${t.data.id}\t${t.data.title}\t${t.data.epic} ${epics.get(t.data.epic) ?? ''}`.trimEnd());
  console.log(`\n${summary()}`);
}

// ---------- set ----------

function setField(text, key, value) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('no frontmatter');
  const re = new RegExp(`^${key}:[^\\S\\r\\n]*([^\\r\\n#]*?)([^\\S\\r\\n]+#[^\\r\\n]*)?$`, 'm');
  let fm = m[1];
  const comment = fm.match(re)?.[2] ?? '';
  const line = `${key}: ${value}${comment}`;
  fm = re.test(fm) ? fm.replace(re, line) : `${fm}\n${line}`;
  return text.replace(m[1], () => fm);
}

function set(args) {
  const [id, status, ...rest] = args;
  if (!/^T-\d{3,}$/.test(id ?? '') || !status) fail('usage: set <T-id> <status> [--branch x] [--pr url]');
  if (!TASK_STATUS.includes(status)) fail(`invalid status "${status}" (${TASK_STATUS.join('|')})`);
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i];
    if (!['--branch', '--pr'].includes(k) || rest[i + 1] === undefined) fail(`unknown or incomplete option ${k}`);
    opts[k.slice(2)] = rest[i + 1];
  }
  const t = loadTasks().find((x) => x.data?.id === id);
  if (!t) fail(`task ${id} not found`);
  let text = fs.readFileSync(t.file, 'utf8');
  text = setField(text, 'status', status);
  if (opts.branch !== undefined) text = setField(text, 'branch', opts.branch);
  if (opts.pr !== undefined) text = setField(text, 'pr', opts.pr);
  fs.writeFileSync(t.file, text);
  console.log(`${id}: status=${status}${opts.branch ? ` branch=${opts.branch}` : ''}${opts.pr ? ` pr=${opts.pr}` : ''}`);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// ---------- main ----------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'check': check({ gh: args.includes('--gh') }); break;
    case 'board': board({ checkOnly: args.includes('--check') }); break;
    case 'next': next(); break;
    case 'set': set(args); break;
    default: fail('usage: node scripts/tasks.mjs <check [--gh]|board [--check]|next|set <T-id> <status> [--branch x] [--pr url]>');
  }
}
