// The plan check's fix budget (plan/README.md, "Fix budget"), run on a temp copy of plan/ with items added.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const MODULE = 'lib/m.js';
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// A full ready head, so a ready item passes every other rule.
const full = JSON.parse(readFileSync(join(REPO, 'plan/items/fix-budget-rule.md'), 'utf8').match(/^```json\n([\s\S]*?)\n```/)[1]);

function item(id, fields) {
  const base = { id, title: `Item ${id}`, stage: full.stage, kind: 'build', status: 'done', outcome: 'x', depends_on: [] };
  const head = fields.status === 'ready' ? { ...full, id, module: undefined } : base;
  return { ...head, ...fields, id };
}

/** Runs the check over plan/ plus the given items; returns { code, out }. */
function check(items, { makeModule = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'plan-check-'));
  try {
    cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
    if (makeModule) { mkdirSync(join(dir, 'lib')); writeFileSync(join(dir, MODULE), ''); }
    for (const it of items)
      writeFileSync(join(dir, 'plan/items', `${it.id}.md`), '```json\n' + JSON.stringify(it, null, 2) + '\n```\n\n## Verifier brief\n\nRead it.\n');
    const r = spawnSync(process.execPath, [join(dir, 'plan/check.mjs')], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const fixes = (ages) => ages.map((a, i) => item(`fix-t${i}`, { module: MODULE, done_on: daysAgo(a) }));

test('the real plan passes', () => {
  const r = spawnSync(process.execPath, [join(REPO, 'plan/check.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('a fix item at ready, doing or done names its module; a draft one need not', () => {
  for (const status of ['ready', 'doing', 'done']) {
    const r = check([item('fix-nomod', { status, done_on: daysAgo(1) })]);
    assert.equal(r.code, 1, status);
    assert.match(r.out, /fix-nomod\.md: a \w+ fix item names the module it changes/);
  }
  assert.equal(check([item('fix-nomod', { status: 'draft' })]).code, 0);
  assert.equal(check([item('other-nomod', { status: 'doing' })]).code, 0);
});

test('a ready or doing module must exist; a done item naming one carries done_on', () => {
  const r = check([item('fix-gone', { status: 'doing', module: MODULE })], { makeModule: false });
  assert.equal(r.code, 1);
  assert.match(r.out, /fix-gone\.md: module lib\/m\.js does not exist/);
  const d = check([item('fix-undated', { module: MODULE })]);
  assert.equal(d.code, 1);
  assert.match(d.out, /fix-undated\.md: a done item that names a module needs done_on/);
});

test('three done fixes in 14 days refuse a fourth at ready and at doing', () => {
  for (const status of ['ready', 'doing']) {
    const r = check([...fixes([1, 3, 14]), item('fix-fourth', { status, module: MODULE })]);
    assert.equal(r.code, 1, status);
    assert.match(r.out, /fix-fourth\.md: is a fourth fix to lib\/m\.js: fix-t0, fix-t1, fix-t2 were done in the last 14 days/);
    assert.match(r.out, /plan\/README\.md, Fix budget/);
  }
});

test('two fixes, or one aged out of the window, leave room', () => {
  assert.equal(check([...fixes([1, 2]), item('fix-third', { status: 'doing', module: MODULE })]).code, 0);
  assert.equal(check([...fixes([1, 2, 15]), item('fix-third', { status: 'doing', module: MODULE })]).code, 0);
});

test('a design item done after the fixes restarts the count; one done before them does not', () => {
  const after = item('redesign-m', { module: MODULE, done_on: daysAgo(0) });
  assert.equal(check([...fixes([1, 2, 3]), after, item('fix-next', { status: 'doing', module: MODULE })]).code, 0);
  const before = item('redesign-m', { module: MODULE, done_on: daysAgo(5) });
  assert.equal(check([...fixes([1, 2, 3]), before, item('fix-next', { status: 'doing', module: MODULE })]).code, 1);
});

test('the design item itself is never refused', () => {
  assert.equal(check([...fixes([1, 2, 3]), item('redesign-m', { status: 'doing', module: MODULE })]).code, 0);
});
