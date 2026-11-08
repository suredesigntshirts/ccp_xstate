// Shared helpers for this item's verifier tests: the head's test script split into its commands, what was read
// from the base (c33644a, the build's parent) pinned here because ci's depth-1 checkout lacks it, temp clones, and
// the full runs record.mjs recorded, summed up in the last ```json block of evidence/<expect-id>.md.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const CAPTURE = 'plugins/harness/test/capture.test.mjs';
export const CHEAP = 'cheap: hook.run rows show at most 50 ms median and 200 ms p95 over a bare node start per tool call';
export const HEAD = '2d33a0fe648d2c2bfc58715e55cce76e8204c0f5';

// Read at c33644a28c3523bf65edcb6e9023dac1e194ca75 with git show and git rev-parse <sha>:<path>.
export const BASE = {
  sha: 'c33644a28c3523bf65edcb6e9023dac1e194ca75',
  script: 'node --test "test/**/*.test.mjs" "scripts/**/*.test.mjs" "packages/**/*.test.{js,mjs}" "plugins/**/*.test.{js,mjs}" "verify/**/*.test.{js,mjs}"',
  blobs: {
    'plugins/harness/test/capture.test.mjs': '73b9606c1dfaf7cb7c0cd10a5f3fe84f28722004',
    'plugins/harness/test/helpers.mjs': '4388c6e917cd374b20cc3443c9b5e3790b9a2a0d',
    'plugins/harness/scripts/capture.mjs': 'cc46a70a0f84986d4924341ca68e06e692c122e8',
  },
  // sha256 of the lines from `test('cheap: ` to the next line that is exactly `});`
  cheapBlock: '7b23e6ddb3d8caae9251898c248ce1fc3ef7da3c73ce2eeffbed1befcd728adb',
};

export const script = () => JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts.test;
export const commands = () => script().split(' && ');
export function recorded(id) {
  const blocks = [...readFileSync(join(HERE, 'evidence', `${id}.md`), 'utf8').matchAll(/```json\n([\s\S]*?)\n```/g)];
  return JSON.parse(blocks.at(-1)[1]);
}

export function cheapBlock(text) {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => l.startsWith("test('cheap: "));
  const to = lines.findIndex((l, i) => i > from && l === '});');
  return `${lines.slice(from, to + 1).join('\n')}\n`;
}
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const blob = (file) => execFileSync('git', ['hash-object', join(ROOT, file)], { encoding: 'utf8' }).trim();

const made = [];
export function temp(name) {
  const d = mkdtempSync(join(tmpdir(), `verify-ccs-${name}-`));
  made.push(d);
  return d;
}
export const cleanup = () => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); };

const GENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
/** A clone of this checkout's HEAD, with this checkout's node_modules. */
export function clone(name) {
  const dir = join(temp(name), 'repo');
  execFileSync('git', ['clone', '-q', '--no-hardlinks', ROOT, dir], { env: GENV, stdio: 'ignore' });
  if (existsSync(join(ROOT, 'node_modules'))) symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

// The edit record.mjs --slow-capture makes: capture busy-waits 250 ms on the first PostToolUse run in each project
// folder, CCP_HARNESS_DIR (marker files under `marks`), so the cheap test's five measured runs hold one slow one.
export const SLOW_FROM = '  const event = input.hook_event_name;\n';
export const slowTo = (marks) => `${SLOW_FROM}  if (event === 'PostToolUse') { const fs = await import('node:fs'); const m = ${JSON.stringify(marks)} + '/' + encodeURIComponent(process.env.CCP_HARNESS_DIR ?? ''); if (!fs.existsSync(m)) { fs.writeFileSync(m, ''); const t0 = Date.now(); while (Date.now() - t0 < 250) {} } }\n`;
export function slowCapture(dir) {
  const marks = temp('marks');
  const p = join(dir, 'plugins/harness/scripts/capture.mjs');
  const text = readFileSync(p, 'utf8');
  if (text.split(SLOW_FROM).length !== 2) throw new Error('capture.mjs: the edit point is not there once');
  writeFileSync(p, text.replace(SLOW_FROM, slowTo(marks)));
}

/** Runs one command of the test script by shell in `dir` with the TAP reporter added; the per-test results. */
export function runCommand(dir, command) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // else the child reports to this runner, not as TAP
  const probed = command.replace(/^node --test /, 'node --test --test-reporter=tap ');
  const r = spawnSync('sh', ['-c', probed], { cwd: dir, encoding: 'utf8', env, timeout: 600_000, maxBuffer: 64 << 20 });
  const out = `${r.stdout}\n${r.stderr}`;
  const tests = [...out.matchAll(/^(not ok|ok) \d+ - (.*?)( # SKIP.*)?$/gm)].map((m) => ({ name: m[2], status: m[1] === 'not ok' ? 'fail' : m[3] ? 'skip' : 'pass' }));
  return { status: r.status, tests, out };
}
