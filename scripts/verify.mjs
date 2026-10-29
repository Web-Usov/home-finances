#!/usr/bin/env node
// Sequential, fail-fast quality gate.
//   node scripts/verify.mjs         full gate   (pnpm verify)
//   node scripts/verify.mjs quick   fast subset (pnpm verify:quick, pre-commit)
//
// Quick mode is quiet: step output is captured and printed only for a failing step (plus the summary).
// Set VERIFY_VERBOSE=1 to stream everything. Full mode always streams (test/build output is evidence).
//
// To add a step: append an entry to the right list below.
import { spawnSync } from 'node:child_process';

const quick = [
  { name: 'typecheck', cmd: 'pnpm typecheck' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'test:unit', cmd: 'pnpm test:unit' },
  { name: 'test:scripts', cmd: 'pnpm test:scripts' },
  { name: 'spec:check', cmd: 'pnpm spec:check' },
  { name: 'tasks:check', cmd: 'pnpm tasks:check' },
];

const full = [
  ...quick,
  { name: 'test:int', cmd: 'pnpm test:int' },
  { name: 'build', cmd: 'pnpm build' },
  { name: 'api:contract', cmd: 'pnpm api:contract' },
  // e2e:smoke is a separate CI job (pnpm e2e:smoke), not part of verify.
  // Further gates are appended here.
];

const mode = process.argv[2] ?? 'full';
if (!['full', 'quick'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use "full" or "quick".`);
  process.exit(2);
}
const steps = mode === 'quick' ? quick : full;
const quiet = mode === 'quick' && !process.env.VERIFY_VERBOSE;
const results = [];
const started = Date.now();

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

for (const [i, step] of steps.entries()) {
  if (!quiet) console.log(`\n━━━ [${i + 1}/${steps.length}] ${step.name}  (${step.cmd}) ━━━`);
  const t0 = Date.now();
  const { status, stdout, stderr } = spawnSync(step.cmd, {
    shell: true,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: quiet ? { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } : process.env,
  });
  const ok = status === 0;
  if (quiet && !ok) {
    console.log(`\n━━━ [${i + 1}/${steps.length}] ${step.name}  (${step.cmd}) ━━━`);
    process.stdout.write(stdout ?? '');
    process.stderr.write(stderr ?? '');
  }
  results.push({ ...step, ok, ms: Date.now() - t0 });
  if (!ok) {
    console.error(`\n✖ verify FAILED at step "${step.name}" (exit ${status}). Fix it and re-run: ${step.cmd}`);
    break;
  }
}

console.log('\n━━━ verify summary ━━━');
for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(12)} ${secs(r.ms)}`);
for (const s of steps.slice(results.length)) console.log(`- ${s.name.padEnd(12)} skipped`);
const failed = results.some((r) => !r.ok);
console.log(`\n${failed ? '✖ FAILED' : '✔ PASSED'} (${mode}) in ${secs(Date.now() - started)}`);
process.exit(failed ? 1 : 0);
