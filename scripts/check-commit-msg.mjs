#!/usr/bin/env node
// Validates a commit message file (lefthook commit-msg hook passes its path).
// Format: type(scope)?: subject [T-123]?   — merge / revert / fixup commits pass.
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S.*$`);
const TASK_SUFFIX = / \[T-\d+\]$/;
const AUTO = /^(Merge |Revert "|fixup! |squash! |amend! )/;

const file = process.argv[2];
if (!file) {
  console.error('usage: check-commit-msg.mjs <commit-message-file>');
  process.exit(2);
}

const header = readFileSync(file, 'utf8')
  .split('\n')
  .find((l) => l.trim() && !l.startsWith('#'));

if (header === undefined || AUTO.test(header)) process.exit(0);

const subject = header.replace(TASK_SUFFIX, '');
if (!PATTERN.test(subject) || header.length > 100) {
  console.error(`✖ Invalid commit message: "${header}"
  Expected: type(scope)?: subject [T-123]?   (max 100 chars)
  Types:    ${TYPES.join(', ')}
  Example:  feat(months): update income with recalculation [T-001]`);
  process.exit(1);
}
