import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findLineReferences, isLineRefScanned, loadEpicRuleIds, strictCoverageErrors, strictEpicsErrors } from '../spec-check.mjs';

test('findLineReferences flags SPECIFICATION.md with a line number', () => {
  for (const text of [
    ' * Implemented per SPECIFICATION.md § Envelope Management (lines 263-296).',
    ' * SPECIFICATION.md line 68: Σ allocation ≤ income',
    '// per SPECIFICATION.md, line 12',
  ]) {
    assert.equal(findLineReferences(text).length, 1, text);
  }
});

test('findLineReferences flags "spec line(s)" in any case', () => {
  for (const text of ['// (spec line 204)', '// (spec lines 134-138)', '// Spec Line 5', '// specification lines 1-2']) {
    assert.equal(findLineReferences(text).length, 1, text);
  }
});

test('findLineReferences reports 1-based line numbers', () => {
  const hits = findLineReferences('a\n// spec line 3\nb\n// SPECIFICATION.md line 9');
  assert.deepEqual(hits.map((h) => h.line), [2, 4]);
});

test('findLineReferences accepts rule IDs and unrelated "line" text', () => {
  for (const text of [
    '// MON-03: closed months are locked',
    '// see docs/spec/20-month-lifecycle.md',
    'const line = 5; // first line of the file',
    '// the spec is in docs/spec',
    '// Implemented per ENV-01..ENV-13.',
  ]) {
    assert.deepEqual(findLineReferences(text), [], text);
  }
});

test('isLineRefScanned covers hand-written sources only', () => {
  assert.equal(isLineRefScanned('apps/api/src/modules/months/months.service.ts'), true);
  assert.equal(isLineRefScanned('apps/api/test/x.int-spec.ts'), true);
  assert.equal(isLineRefScanned('packages/types/src/schemas.ts'), true);
  assert.equal(isLineRefScanned('e2e/tests/a.e2e.ts'), true);
  assert.equal(isLineRefScanned('scripts/tasks.mjs'), true);
  assert.equal(isLineRefScanned('apps/mobile/src/api/generated.ts'), false);
  assert.equal(isLineRefScanned('scripts/spec-check.mjs'), false);
  assert.equal(isLineRefScanned('scripts/__tests__/spec-check.test.mjs'), false);
  assert.equal(isLineRefScanned('docs/archive/SPECIFICATION.md'), false);
});

test('strictCoverageErrors: uncovered AC fails unless deferred', () => {
  const ac = ['AC-01', 'AC-21'];
  assert.deepEqual(strictCoverageErrors([], {}, ac), []);
  assert.match(strictCoverageErrors(['AC-21'], {}, ac)[0], /AC-21/);
  assert.deepEqual(strictCoverageErrors(['AC-21'], { 'AC-21': { task: 'T-011', reason: 'UI' } }, ac), []);
});

test('strictCoverageErrors: stale, unknown and incomplete allowlist entries fail', () => {
  const ac = ['AC-01', 'AC-21'];
  assert.match(strictCoverageErrors([], { 'AC-21': { task: 'T-011', reason: 'UI' } }, ac)[0], /remove it/);
  assert.match(strictCoverageErrors([], { 'AC-99': { task: 'T-011', reason: 'UI' } }, ac)[0], /not an AC/);
  assert.match(strictCoverageErrors(['AC-21'], { 'AC-21': { task: '' } }, ac)[0], /needs non-empty/);
});

test('loadEpicRuleIds collects the spec: lists of all epic files and ignores other files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epics-'));
  try {
    fs.writeFileSync(path.join(dir, 'E-01-a.md'), '---\nid: E-01\nspec: [MON-01, OP-02]\n---\nbody spec: [XX-99]\n');
    fs.writeFileSync(path.join(dir, 'E-02-b.md'), '---\nid: E-02\nspec: [OP-02, UI-01]\n---\n');
    fs.writeFileSync(path.join(dir, 'README.md'), 'spec: [MON-05]\n');
    assert.deepEqual([...loadEpicRuleIds(dir)].sort(), ['MON-01', 'OP-02', 'UI-01']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(loadEpicRuleIds(path.join(os.tmpdir(), 'no-such-epics-dir')).size, 0);
});

test('strictEpicsErrors passes when every epic rule is covered or allow-listed with a reason', () => {
  assert.deepEqual(strictEpicsErrors([], {}, ['UI-01']), []);
  assert.deepEqual(strictEpicsErrors(['UI-01'], { 'UI-01': { reason: 'manual check only' } }, ['UI-01']), []);
});

test('strictEpicsErrors fails on an uncovered epic rule that is not allow-listed', () => {
  const errors = strictEpicsErrors(['UI-01', 'DOD-03'], {}, ['UI-01', 'DOD-03', 'OP-01']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /2 epic rule\(s\).*UI-01, DOD-03/);
});

test('strictEpicsErrors rejects stale, unknown or reason-less allowlist entries', () => {
  const errors = strictEpicsErrors(
    ['DOD-03'],
    { 'UI-01': { reason: 'covered now' }, 'ZZ-01': { reason: 'x' }, 'DOD-03': {} },
    ['UI-01', 'DOD-03'],
  );
  assert.equal(errors.length, 3);
  assert.match(errors.join('\n'), /UI-01 is covered by a test now/);
  assert.match(errors.join('\n'), /ZZ-01 is not in any epic/);
  assert.match(errors.join('\n'), /DOD-03 needs a non-empty "reason"/);
});
