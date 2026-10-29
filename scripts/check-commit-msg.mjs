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

const MAX = 100;
const subject = header.replace(TASK_SUFFIX, '');
const reasons = [];
if (header.length > MAX) reasons.push(`header is ${header.length} chars, max ${MAX}`);
if (!PATTERN.test(subject)) {
  const typeMatch = subject.match(/^([a-z]+)/);
  if (!/^[a-z]+(\([^)]*\))?!?:/.test(subject)) reasons.push('header does not match "type(scope): subject" (missing "type:" prefix or ": " separator)');
  else if (!typeMatch || !TYPES.includes(typeMatch[1])) reasons.push(`unknown type "${typeMatch?.[1]}" (allowed: ${TYPES.join(', ')})`);
  else if (!/^[a-z]+(\([a-z0-9._/-]+\))?!?:/.test(subject)) reasons.push('scope must be lowercase letters, digits, . _ / - inside parentheses');
  else reasons.push('subject is empty or ":" is not followed by a space and text');
}
if (reasons.length) {
  console.error(`✖ Invalid commit message: "${header}"
  Reason:   ${reasons.join('; ')}
  Expected: type(scope)?: subject [T-123]?   (header max ${MAX} chars)
  Types:    ${TYPES.join(', ')}
  Example:  feat(months): update income with recalculation [T-001]`);
  process.exit(1);
}
