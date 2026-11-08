// Expect tests-bite: test/docs.test.mjs goes red when a path CLAUDE.md names is renamed and when a line takes
// CLAUDE.md, plan/README.md and docs/gates.md to 230; scripts/gates/test/lib.test.mjs goes red when namedItem reads
// the branch's last segment again; each is green again when restored. Every mutation happens in a temp copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const run = (dir, file) => node(['--test', '--test-reporter=tap', join(dir, file)], { cwd: dir });

// A temp repo for test/docs.test.mjs: the texts and the test are copies, every other top-level entry a symlink.
function docsCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rso-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const copied = new Set(['CLAUDE.md', 'plan', 'docs', 'test']);
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || n === 'node_modules') continue;
    if (copied.has(n)) continue;
    symlinkSync(join(REPO, n), join(dir, n));
  }
  for (const p of copied) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  return dir;
}

function bite(t, dir, file, breakIt, restore) {
  const green = run(dir, file);
  assert.equal(green.status, 0, green.out);
  breakIt();
  const red = run(dir, file);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  restore();
  const again = run(dir, file);
  assert.equal(again.status, 0, again.out);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  return red.out;
}

test('docs.test.mjs goes red when a path CLAUDE.md names is renamed', (t) => {
  const dir = docsCopy(t);
  assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /`docs\/gates\.md`/);
  const red = bite(t, dir, 'test/docs.test.mjs',
    () => renameSync(join(dir, 'docs/gates.md'), join(dir, 'docs/gates-renamed.md')),
    () => renameSync(join(dir, 'docs/gates-renamed.md'), join(dir, 'docs/gates.md')));
  assert.match(red, /docs\/gates\.md/);
});

test('docs.test.mjs goes red when CLAUDE.md names a path that is not there', (t) => {
  const dir = docsCopy(t);
  const p = join(dir, 'CLAUDE.md');
  const text = readFileSync(p, 'utf8');
  assert.match(text, /`docs\/layout\.md`/);
  bite(t, dir, 'test/docs.test.mjs',
    () => writeFileSync(p, text.replaceAll("`docs/layout.md`", "`docs/layouts.md`")), () => writeFileSync(p, text));
});

test('docs.test.mjs goes red when the three entry texts reach 230 lines', (t) => {
  const dir = docsCopy(t);
  const count = (f) => { const s = readFileSync(join(dir, f), 'utf8'); return s.split('\n').length - (s.endsWith('\n') ? 1 : 0); };
  const total = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'].reduce((n, f) => n + count(f), 0);
  assert.ok(total < 230, `already ${total}`);
  const p = join(dir, 'docs/gates.md');
  const text = readFileSync(p, 'utf8');
  bite(t, dir, 'test/docs.test.mjs',
    () => writeFileSync(p, text + 'padding\n'.repeat(230 - total)), () => writeFileSync(p, text));
  t.diagnostic(`padded from ${total} to 230 lines`);
});

test('lib.test.mjs goes red when namedItem reads the branch last segment again', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'rso-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const p = join(dir, 'scripts/gates/lib.mjs');
  const text = readFileSync(p, 'utf8');
  const from = /export function namedItem\(\{ body = '', ids \}\) \{\n  const item = (body\.match\([^\n]*?\)\?\.\[1\]) \?\? null;/;
  assert.match(text, from, 'namedItem reads the body alone');
  const fallback = "export function namedItem({ body = '', ids, branch = '' }) {\n" +
    "  const item = $1 ?? (ids.has(branch.split('/').pop()) ? branch.split('/').pop() : null);";
  bite(t, dir, 'scripts/gates/test/lib.test.mjs',
    () => writeFileSync(p, text.replace(from, fallback)), () => writeFileSync(p, text));
});
