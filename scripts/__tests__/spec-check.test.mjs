import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLineReferences, isLineRefScanned, strictCoverageErrors } from '../spec-check.mjs';

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
