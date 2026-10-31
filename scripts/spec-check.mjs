#!/usr/bin/env node
/**
 * spec-check — consistency check between the specification and the rest of the repo.
 *
 * Usage:
 *   node scripts/spec-check.mjs                    # run checks, print coverage report
 *   node scripts/spec-check.mjs --strict-coverage  # additionally fail if any AC-* is not referenced from a test file
 *   node scripts/spec-check.mjs --verbose          # list every uncovered rule even when there are many
 *
 * What it does:
 *   1. Parses rule definitions (`**[PREFIX-nn]**`) in docs/spec/*.md; fails on duplicate IDs.
 *   2. Scans references (`PREFIX-nn` tokens with known prefixes) in tasks/**, epics/**, docs/**,
 *      apps/**\/src/**, apps/**\/test/**, e2e/** and fails if a referenced ID is not defined.
 *      Ignored: node_modules, dist, generated apps/mobile/src/api, docs/archive.
 *      Deprecated rules (`~~[XX-nn]~~`) still count as defined.
 *   3. Fails if source code (apps/*\/src, apps/*\/test, packages/*\/src, e2e, scripts; not generated code, not
 *      docs/archive) cites the spec by line number ("SPECIFICATION.md ... line 12", "spec line 12"): cite rule IDs.
 *   4. Prints a coverage report: which rule IDs are referenced from test files
 *      (*.spec.ts, *.int-spec.ts, *.e2e.ts, *.test.tsx) and which are not (warning only).
 *
 * Exit code: 0 on success; 1 on duplicates, dangling references, or (with --strict-coverage) uncovered AC-*.
 * Plain Node ESM, no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strictCoverage = process.argv.includes('--strict-coverage');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.turbo', '.expo', 'coverage', 'archive']);
const SKIP_PATHS = ['apps/mobile/src/api/'];
const SCAN_ROOTS = ['tasks', 'epics', 'docs', 'apps', 'e2e'];
const TEXT_EXT = /\.(md|mdx|ts|tsx|js|jsx|mjs|cjs|json|ya?ml)$/;
const TEST_FILE = /\.(spec\.ts|int-spec\.ts|e2e\.ts|test\.tsx)$/;

const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (TEXT_EXT.test(entry.name)) {
      const r = rel(full);
      if (!SKIP_PATHS.some((s) => r.startsWith(s))) out.push(full);
    }
  }
  return out;
}

// 1. definitions
/** Parse rule definitions from docs/spec/*.md. Exported for scripts/tasks.mjs. */
export function loadSpecIds() {
  const specDir = path.join(root, 'docs/spec');
  const specFiles = fs.existsSync(specDir)
    ? fs.readdirSync(specDir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
    : [];
  const defs = new Map(); // id -> [file:line]
  const defRe = /\*\*\[([A-Z]+-\d{2,3})\]\*\*|~~\[([A-Z]+-\d{2,3})\]~~/g;
  for (const f of specFiles) {
    fs.readFileSync(path.join(specDir, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(defRe)) {
          const id = m[1] ?? m[2];
          if (!defs.has(id)) defs.set(id, []);
          defs.get(id).push(`docs/spec/${f}:${i + 1}`);
        }
      });
  }
  const prefixes = [...new Set([...defs.keys()].map((id) => id.split('-')[0]))];
  return { defs, specFiles, prefixes, ids: new Set(defs.keys()) };
}

const LINE_REF_PATTERNS = [/SPECIFICATION\.md.*\blines?\s*\d/i, /\bspec(?:ification)?\s+lines?\b/i];

/** Find citations of the spec by line number in `text`. Returns [{ line, text }]. Exported for tests. */
export function findLineReferences(text) {
  const found = [];
  text.split('\n').forEach((line, i) => {
    if (LINE_REF_PATTERNS.some((re) => re.test(line))) found.push({ line: i + 1, text: line.trim() });
  });
  return found;
}

/** True for files whose spec-by-line references are checked (hand-written source code only). */
export function isLineRefScanned(r) {
  if (SKIP_PATHS.some((s) => r.startsWith(s)) || r.startsWith('scripts/__tests__/') || r === 'scripts/spec-check.mjs') return false;
  return /^(apps\/[^/]+\/(src|test)|packages\/[^/]+\/src|e2e|scripts)\//.test(r);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
const { defs, specFiles, prefixes } = loadSpecIds();
const errors = [];
for (const [id, where] of defs) {
  if (where.length > 1) errors.push(`duplicate definition of ${id}: ${where.join(', ')}`);
}

// 2. references
const refRe = new RegExp(`\\b(?:${prefixes.join('|')})-\\d{2,3}\\b`, 'g');
const refs = new Map(); // id -> Set(files)
const testRefs = new Map(); // id -> Set(test files)
const files = SCAN_ROOTS.flatMap((d) => walk(path.join(root, d)));
for (const file of files) {
  const r = rel(file);
  if (r.startsWith('docs/spec/')) continue; // definitions themselves
  // restrict apps/** to src and test directories
  if (r.startsWith('apps/') && !/^apps\/[^/]+\/(src|test)\//.test(r)) continue;
  const text = fs.readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(refRe)) {
      const id = m[0];
      if (!refs.has(id)) refs.set(id, new Set());
      refs.get(id).add(`${r}:${i + 1}`);
      if (TEST_FILE.test(r)) {
        if (!testRefs.has(id)) testRefs.set(id, new Set());
        testRefs.get(id).add(r);
      }
      if (!defs.has(id)) errors.push(`${r}:${i + 1}: reference to undefined rule ${id}`);
    }
  });
}

// 3. source code must cite rule IDs, never spec line numbers
const lineRefFiles = ['apps', 'packages', 'e2e', 'scripts'].flatMap((d) => walk(path.join(root, d)));
for (const file of lineRefFiles) {
  const r = rel(file);
  if (!isLineRefScanned(r)) continue;
  for (const { line, text } of findLineReferences(fs.readFileSync(file, 'utf8'))) {
    errors.push(`${r}:${line}: cites the spec by line number (cite a rule ID instead): ${text}`);
  }
}

// 4. coverage report
const ids = [...defs.keys()].sort();
const byPrefix = new Map();
for (const id of ids) {
  const p = id.split('-')[0];
  if (!byPrefix.has(p)) byPrefix.set(p, { total: 0, covered: 0, referenced: 0 });
  const s = byPrefix.get(p);
  s.total++;
  if (testRefs.has(id)) s.covered++;
  if (refs.has(id)) s.referenced++;
}

console.log(`spec-check: ${ids.length} rule IDs defined in ${specFiles.length} files, ${files.length} files scanned\n`);
console.log('prefix   rules  referenced  covered-by-tests');
for (const [p, s] of byPrefix) {
  console.log(`${p.padEnd(8)} ${String(s.total).padStart(5)}  ${String(s.referenced).padStart(10)}  ${String(s.covered).padStart(16)}`);
}
const uncovered = ids.filter((id) => !testRefs.has(id));
const uncoveredAc = uncovered.filter((id) => id.startsWith('AC-'));
console.log(`\ncovered by tests: ${ids.length - uncovered.length}/${ids.length}`);
if (uncoveredAc.length) console.log(`AC without test reference (${uncoveredAc.length}): ${uncoveredAc.join(', ')}`);
if (uncovered.length) {
  console.log(`warning: rules not referenced from any test file (${uncovered.length}):`);
  if (uncovered.length > 40 && !process.argv.includes('--verbose')) console.log('  (too many to list; use --verbose for the full list)');
  else console.log('  ' + uncovered.join(' '));
}

if (strictCoverage && uncoveredAc.length) {
  errors.push(`--strict-coverage: ${uncoveredAc.length} AC-* not referenced from tests: ${uncoveredAc.join(', ')}`);
}

if (errors.length) {
  console.error(`\nspec-check FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nspec-check OK');
}
