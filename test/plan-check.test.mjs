// The plan check's fix budget (plan/README.md, "Fix budget") and its contract rules ("How slop is kept out"), run on a
// temp copy of plan/ with items added.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    // The copy holds plan/ alone, so the modules the real ready and doing items name are made in it too.
    for (const path of liveModules) { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), ''); }
    for (const { prose = '', ...it } of items)
      writeFileSync(join(dir, 'plan/items', `${it.id}.md`), '```json\n' + JSON.stringify(it, null, 2) + '\n```\n\n' + prose + '## Verifier brief\n\nRead it.\n');
    const r = spawnSync(process.execPath, [join(dir, 'plan/check.mjs')], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const liveModules = readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(/^```json\n([\s\S]*?)\n```/)?.[1] ?? '{}'))
  .filter((it) => it.module && ['ready', 'doing'].includes(it.status))
  .map((it) => it.module);

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

// An item whose Expect lines say `check`, beside a world line, so a ready one passes every other rule.
const PHRASES = ['as on main', 'as main', 'on main', 'than main', "main's", 'unchanged', 'same as', 'byte', 'bytes', 'both shas'];
const expecting = (id, status, check) => item(id, {
  status, done_on: daysAgo(1),
  expect: [{ id: 'shown', check: 'The PR runs on GitHub', how: 'gh', proof: 'world' }, { id: 'pins', check, how: 'read', proof: 'verifier' }],
});

test('a ready or doing Expect check that pins main is refused, naming the item, the Expect id and the phrase', () => {
  for (const phrase of PHRASES) for (const status of ['ready', 'doing']) {
    const r = check([expecting('pinner', status, `Every stage renders ${phrase} before the change`)]);
    assert.equal(r.code, 1, `${status}: ${phrase}`);
    assert.ok(r.out.includes(`pinner.md: Expect pins pins main with "${phrase}"`), `${status}: ${phrase}\n${r.out}`);
  }
});

test('a sha of seven or more hex digits is refused; a check that names a repo path is not', () => {
  for (const sha of ['a575897', '6995413269700494239890eb87c8a33e42a426c3']) {
    const r = check([expecting('pinner', 'ready', `The suite passes at ${sha} and at the head`)]);
    assert.equal(r.code, 1, sha);
    assert.ok(r.out.includes(`pinner.md: Expect pins pins main with the sha ${sha}`), r.out);
  }
  assert.equal(check([expecting('reader', 'ready', 'plan/README.md states the rule; scripts/gates/lib.mjs refuses a 6-digit count of 123456')]).code, 0);
});

test('draft and done items keep their wording', () => {
  for (const status of ['draft', 'done']) for (const phrase of [...PHRASES, 'a575897'])
    assert.equal(check([expecting('older', status, `Renders ${phrase}`)]).code, 0, `${status}: ${phrase}`);
});

test('a contract changes at most once, and a change is written down', () => {
  const changed = (n, prose) => ({ ...item('moved', { status: 'doing', contract_changes: n }), ...(prose ? { prose } : {}) });
  const section = '## Contract change\n\nThe build tried one shape, compared it with another, and the contract moved.\n\n';
  assert.equal(check([changed(1, section)]).code, 0);
  const none = check([changed(1)]);
  assert.equal(none.code, 1);
  assert.match(none.out, /moved\.md: contract_changes is 1, so the item needs a ## Contract change section/);
  const twice = check([changed(2, section)]);
  assert.equal(twice.code, 1);
  assert.match(twice.out, /moved\.md\.contract_changes: must be at most 1/);
});
