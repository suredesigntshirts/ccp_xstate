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

const SHOWN = [{ id: 'shown', check: 'The PR runs on GitHub', how: 'gh', proof: 'world' },
  { id: 'holds', check: 'The rule holds on a temp plan', how: 'a test', proof: 'verifier' }];

function item(id, fields) {
  const base = { id, title: `Item ${id}`, stage: full.stage, kind: 'build', status: 'done', outcome: 'x', depends_on: [] };
  const head = fields.status === 'ready' ? { ...full, id, module: undefined, expect: SHOWN } : base;
  return { ...head, ...fields, id };
}

/** Runs the check over plan/ plus the given items; returns { code, out }. */
function check(items, { makeModule = true, verdicts = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'plan-check-'));
  try {
    cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
    if (makeModule) { mkdirSync(join(dir, 'lib')); writeFileSync(join(dir, MODULE), ''); }
    // The copy holds plan/ alone, so the modules the real ready items name are made in it too.
    for (const path of liveModules) { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), ''); }
    for (const id of verdicts) { mkdirSync(join(dir, 'verify', id), { recursive: true }); writeFileSync(join(dir, 'verify', id, 'verdict.json'), '{}'); }
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
  .filter((it) => it.module && it.status === 'ready')
  .map((it) => it.module);

const fixes = (ages) => ages.map((a, i) => item(`fix-t${i}`, { module: MODULE, done_on: daysAgo(a) }));

test('the real plan passes', () => {
  const r = spawnSync(process.execPath, [join(REPO, 'plan/check.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('a fix item at ready or done names its module; a draft one need not', () => {
  for (const status of ['ready', 'done']) {
    const r = check([item('fix-nomod', { status, done_on: daysAgo(1) })]);
    assert.equal(r.code, 1, status);
    assert.match(r.out, /fix-nomod\.md: a \w+ fix item names the module it changes/);
  }
  assert.equal(check([item('fix-nomod', { status: 'draft' })]).code, 0);
  assert.equal(check([item('other-nomod', { status: 'ready' })]).code, 0);
});

test('a ready module must exist; a done item naming one carries done_on', () => {
  const r = check([item('fix-gone', { status: 'ready', module: MODULE })], { makeModule: false });
  assert.equal(r.code, 1);
  assert.match(r.out, /fix-gone\.md: module lib\/m\.js does not exist/);
  const d = check([item('fix-undated', { module: MODULE })]);
  assert.equal(d.code, 1);
  assert.match(d.out, /fix-undated\.md: a done item that names a module needs done_on/);
});

test('three done fixes in 14 days refuse a fourth at ready', () => {
  {
    const r = check([...fixes([1, 3, 14]), item('fix-fourth', { status: 'ready', module: MODULE })]);
    assert.equal(r.code, 1);
    assert.match(r.out, /fix-fourth\.md: is a fourth fix to lib\/m\.js: fix-t0, fix-t1, fix-t2 were done in the last 14 days/);
    assert.match(r.out, /plan\/README\.md, Fix budget/);
  }
});

test('two fixes, or one aged out of the window, leave room', () => {
  assert.equal(check([...fixes([1, 2]), item('fix-third', { status: 'ready', module: MODULE })]).code, 0);
  assert.equal(check([...fixes([1, 2, 15]), item('fix-third', { status: 'ready', module: MODULE })]).code, 0);
});

test('a design item done after the fixes restarts the count; one done before them does not', () => {
  const after = item('redesign-m', { module: MODULE, done_on: daysAgo(0) });
  assert.equal(check([...fixes([1, 2, 3]), after, item('fix-next', { status: 'ready', module: MODULE })]).code, 0);
  const before = item('redesign-m', { module: MODULE, done_on: daysAgo(5) });
  assert.equal(check([...fixes([1, 2, 3]), before, item('fix-next', { status: 'ready', module: MODULE })]).code, 1);
});

test('the design item itself is never refused', () => {
  assert.equal(check([...fixes([1, 2, 3]), item('redesign-m', { status: 'ready', module: MODULE })]).code, 0);
});

// An item whose Expect lines say `check`, beside a world line, so a ready one passes every other rule.
const PHRASES = ['as on main', 'as main', 'on main', 'than main', "main's", 'unchanged', 'same as', 'byte', 'bytes', 'both shas'];
const expecting = (id, status, check) => item(id, {
  status, done_on: daysAgo(1),
  expect: [{ id: 'shown', check: 'The PR runs on GitHub', how: 'gh', proof: 'world' }, { id: 'pins', check, how: 'read', proof: 'verifier' }],
});

test('a ready Expect check that pins main is refused, naming the item, the Expect id and the phrase', () => {
  for (const phrase of PHRASES) for (const status of ['ready']) {
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

test('doing is no longer a status: an item holding it is refused', () => {
  const r = check([item('old-doing', { status: 'doing' })]);
  assert.equal(r.code, 1);
  assert.match(r.out, /old-doing\.md\.status: /);
});

test('a contract changes at most once, and a change is written down', () => {
  const changed = (n, prose) => ({ ...item('moved', { status: 'done', contract_changes: n }), ...(prose ? { prose } : {}) });
  const section = '## Contract change\n\nThe build tried one shape, compared it with another, and the contract moved.\n\n';
  assert.equal(check([changed(1, section)]).code, 0);
  const none = check([changed(1)]);
  assert.equal(none.code, 1);
  assert.match(none.out, /moved\.md: contract_changes is 1, so the item needs a ## Contract change section/);
  const twice = check([changed(2, section)]);
  assert.equal(twice.code, 1);
  assert.match(twice.out, /moved\.md\.contract_changes: must be at most 1/);
});

const EFFORT = {
  pr: 1, files: 2, exports_added: 0, exports_removed: 0, reader_lines: 10,
  added: { code: 1, tests: 1, verifier: 0, evidence: 0, docs: 0 }, removed: { code: 0, tests: 0, verifier: 0, evidence: 0, docs: 0 },
};

test('a verified done build item needs no reader_effort, and one it records passes', () => {
  const late = item('effort-late', { done_on: '2026-11-09' });
  assert.equal(check([late], { verdicts: ['effort-late'] }).code, 0);
  assert.equal(check([{ ...late, reader_effort: EFFORT }], { verdicts: ['effort-late'] }).code, 0);
});

test('a malformed reader_effort is refused', () => {
  const bad = check([item('effort-bad', { reader_effort: { ...EFFORT, extra: 1 } })]);
  assert.match(bad.out, /effort-bad\.md\.reader_effort: unknown field extra/);
  const frac = check([item('effort-frac', { reader_effort: { ...EFFORT, added: { ...EFFORT.added, code: 1.5 } } })]);
  assert.match(frac.out, /effort-frac\.md\.reader_effort\.added\.code: must be an integer/);
});

// A ready head whose Expect lines pass every rule, so only the field under test can refuse it.
const LINES = [{ id: 'shown', check: 'The PR runs on GitHub', how: 'gh', proof: 'world' }, { id: 'read', check: 'The rule is written', how: 'read', proof: 'verifier' }];
const ready = (id, fields = {}) => item(id, { status: 'ready', expect: LINES, ...fields });

test('a ready head needs no verifier and no step_back; it still needs expect', () => {
  const lean = (id, fields = {}) => {
    const { verifier, step_back, ...rest } = ready(id);
    return { ...rest, ...fields };
  };
  const ok = check([lean("lean")]);
  assert.equal(ok.code, 0, ok.out);
  const r = check([lean('lean-noexpect', { expect: [] })]);
  assert.equal(r.code, 1);
  assert.match(r.out, /lean-noexpect\.md: ready, but expect is empty/);
});

test('step_back, when named, holds at least one round', () => {
  assert.equal(check([ready('three', { step_back: { max_rounds: 3 } })]).code, 0);
  const r = check([ready('zero', { step_back: { max_rounds: 0 } })]);
  assert.equal(r.code, 1);
  assert.match(r.out, /zero\.md\.step_back\.max_rounds/);
});
