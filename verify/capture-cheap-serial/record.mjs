// Records full test-script runs for the verifier's tests: each command of package.json's "test" script, run in
// order as `&&` runs them, with this folder's reporter added, from a clone of the repo at a given commit.
// Usage: node verify/capture-cheap-serial/record.mjs <label> <sha> [--slow-capture] > <label>.json
// --slow-capture makes capture busy-wait 250 ms on the first PostToolUse run in each project folder (CCP_HARNESS_DIR).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.RECORD_ROOT ?? join(HERE, '..', '..');
const [label, sha, ...flags] = process.argv.slice(2);
const work = mkdtempSync(join(tmpdir(), `verify-ccs-${label}-`));
const dir = join(work, 'repo');
const genv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
// A clone, not a worktree: a worktree shares the repo's branches, and the suite's stand-in tests leave run/* branches
// and worktrees beside the checkout that make the next run's copy fail. The clone gets the repo's origin refs.
execFileSync('git', ['clone', '-q', '--no-hardlinks', '--no-checkout', ROOT, dir], { env: genv, stdio: 'inherit' });
execFileSync('git', ['-C', dir, 'fetch', '-q', ROOT, '+refs/remotes/origin/*:refs/remotes/origin/*'], { env: genv, stdio: 'inherit' });
execFileSync('git', ['-C', dir, 'checkout', '-q', '-B', 'verify', sha], { env: genv, stdio: 'inherit' });
symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));

export const SLOW_FROM = '  const event = input.hook_event_name;\n';
export const slowTo = (marks) => `${SLOW_FROM}  if (event === 'PostToolUse') { const fs = await import('node:fs'); const m = ${JSON.stringify(marks)} + '/' + encodeURIComponent(process.env.CCP_HARNESS_DIR ?? ''); if (!fs.existsSync(m)) { fs.writeFileSync(m, ''); const t0 = Date.now(); while (Date.now() - t0 < 250) {} } }\n`;
if (flags.includes('--slow-capture')) {
  const marks = join(work, 'marks');
  execFileSync('mkdir', ['-p', marks]);
  const p = join(dir, 'plugins/harness/scripts/capture.mjs');
  const text = readFileSync(p, 'utf8');
  if (text.split(SLOW_FROM).length !== 2) throw new Error('capture.mjs: the edit point is not there once');
  writeFileSync(p, text.replace(SLOW_FROM, slowTo(marks)));
}

const script = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts.test;
const commands = script.split(' && ');
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const runs = [];
for (const [i, command] of commands.entries()) {
  const out = join(work, `run-${i}.jsonl`);
  const tap = join(work, `run-${i}.tap`);
  const probed = command.replace(/^node --test /, `node --test --test-reporter=tap --test-reporter-destination=${tap} --test-reporter=${join(HERE, 'reporter.mjs')} --test-reporter-destination=${out} `);
  const start = Date.now();
  const code = await new Promise((done) => spawn('sh', ['-c', probed], { cwd: dir, env, stdio: 'ignore' }).on('exit', done));
  const end = Date.now();
  const rows = existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const tapText = existsSync(tap) ? readFileSync(tap, 'utf8') : '';
  runs.push({ command, start, end, code, rows: rows.map((r) => ({ ...r, file: r.file?.startsWith(dir) ? r.file.slice(dir.length + 1) : r.file })), tapTail: tapText.slice(-1500), failMsgs: [...tapText.matchAll(/error: '((?:median|p95) [^']*)'/g)].map((m) => m[1]) });
  if (code !== 0) break;
}
rmSync(work, { recursive: true, force: true });
process.stdout.write(JSON.stringify({ label, sha, script, runs }));
