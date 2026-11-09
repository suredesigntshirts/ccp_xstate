// Expect: item-head-trim/done-heads-pass, item-head-trim/lean-ready-passes, item-head-trim/tests-bite
// The plan check passes a ready head with no verifier and no step_back, refuses one with expect, outputs or why emptied
// or with no rounds in step_back, passes the done heads that still carry the old fields, and the plan-check test goes
// red with verifier back among the ready fields. Every edit is on a temp copy of plan/.
import assert from 'node:assert/strict';
import { onlyTests, ranTests, childEnv } from '../lib.mjs';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  return childEnv({ drop: ['BASE_SHA', 'HEAD_SHA', 'PR_BRANCH', 'PR_BODY', 'PR_LABELS'] });
};

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
const joinItem = (head, rest) => '```json\n' + JSON.stringify(head, null, 2) + '\n```\n' + rest;

/** Every item head in a plan/ folder, by file name. */
function heads(planDir = join(REPO, 'plan')) {
  const dir = join(planDir, 'items');
  return readdirSync(dir).filter((n) => n.endsWith('.md'))
    .map((n) => ({ file: n, ...splitItem(readFileSync(join(dir, n), 'utf8')) }));
}

/**
 * Copies plan/ into dir, and makes each module a ready item names, since the copy holds plan/ alone and the
 * plan check refuses a ready item whose module is missing.
 */
function copyPlan(dir) {
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  for (const { head } of heads()) {
    if (!head.module || head.status !== 'ready') continue;
    mkdirSync(dirname(join(dir, head.module)), { recursive: true });
    writeFileSync(join(dir, head.module), '');
  }
}

/**
 * A temp copy of the head's whole plan/. withItem(id, edit) writes plan/items/<id>.md from a real item file
 * (head made ready under the new id, with no verifier and no step_back, then passed to edit) and runs the copy's
 * check.mjs, returning { status, out }.
 */
function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'iht-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyPlan(dir);
  const src = splitItem(read('plan/items/item-head-trim.md'));
  const check = () => node([join(dir, 'plan/check.mjs')], { cwd: dir });
  return {
    dir, check,
    withItem(id, edit = (h) => h) {
      const { verifier, step_back, ...rest } = src.head;
      const head = edit({ ...rest, id, status: 'ready' });
      writeFileSync(join(dir, 'plan/items', `${id}.md`), joinItem(head, src.rest));
      return { head, ...check() };
    },
  };
}

{
test('the real plan passes, and done items there still carry verifier, max_tokens and replan_to', (t) => {
  const done = heads().filter((h) => h.head.status === 'done');
  const count = (f) => done.filter((h) => f(h.head)).length;
  const n = { verifier: count((h) => 'verifier' in h), max_tokens: count((h) => 'max_tokens' in (h.step_back ?? {})),
    replan_to: count((h) => 'replan_to' in (h.step_back ?? {})) };
  t.diagnostic(`done items: ${done.length}; carrying verifier ${n.verifier}, max_tokens ${n.max_tokens}, replan_to ${n.replan_to}`);
  for (const k of Object.keys(n)) assert.ok(n[k] > 0, `some done item carries ${k}`);
  const r = node([join(REPO, 'plan/check.mjs')], { cwd: REPO });
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').slice(-2).join(' | ')}`);
  assert.equal(r.status, 0, r.out);
});

test('a ready step_back of max_rounds 3 passes; max_rounds 0 is refused', (t) => {
  const plan = planCopy(t);
  const three = plan.withItem('iht-three', (h) => ({ ...h, step_back: { max_rounds: 3 } }));
  t.diagnostic(`max_rounds 3: exit ${three.status}`);
  assert.equal(three.status, 0, three.out);
  const zero = plan.withItem('iht-zero', (h) => ({ ...h, step_back: { max_rounds: 0 } }));
  const said = zero.out.trim().split('\n').filter((l) => l.includes('iht-zero'));
  t.diagnostic(`max_rounds 0: exit ${zero.status}: ${said.join(' | ')}`);
  assert.equal(zero.status, 1, zero.out);
  assert.match(zero.out, /iht-zero\.md\.step_back\.max_rounds/);
});
}

{
test('a ready build head with no verifier and no step_back passes the plan check', (t) => {
  const plan = planCopy(t);
  const r = plan.withItem('iht-lean');
  t.diagnostic(`fields: ${Object.keys(r.head).join(', ')}`);
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').slice(-2).join(' | ')}`);
  assert.equal(r.head.kind, 'build');
  assert.equal(r.head.status, 'ready');
  assert.ok(!('verifier' in r.head) && !('step_back' in r.head));
  assert.equal(r.status, 0, r.out);
});

for (const [field, empty] of [['expect', []], ['outputs', []], ['why', '']]) {
  test(`the same lean head with ${field} emptied is refused, naming ${field}`, (t) => {
    const plan = planCopy(t);
    const r = plan.withItem(`iht-no-${field}`, (h) => ({ ...h, [field]: empty }));
    t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').filter((l) => l.includes(`iht-no-${field}`)).join(' | ')}`);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, new RegExp(`iht-no-${field}\\.md: ready, but ${field} is empty`));
  });
}
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

test('plan-check.test.mjs goes red with verifier back in readyRequired, green when restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'iht-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyPlan(dir);
  mkdirSync(join(dir, 'test'));
  cpSync(join(REPO, 'test/plan-check.test.mjs'), join(dir, 'test/plan-check.test.mjs'));
  const NAMES = ['a ready head needs no verifier and no step_back; it still needs expect'];
  const run = () => node(['--test', '--test-reporter=tap', onlyTests(NAMES), join(dir, 'test/plan-check.test.mjs')], { cwd: dir });

  const file = join(dir, 'plan/item.schema.json');
  const text = readFileSync(file, 'utf8');
  const schema = JSON.parse(text);
  assert.ok(!schema.readyRequired.includes('verifier'), 'the head leaves verifier out of readyRequired');
  const broken = JSON.stringify({ ...schema, readyRequired: [...schema.readyRequired, 'verifier'] }, null, 2) + '\n';

  const green = run();
  assert.equal(green.status, 0, green.out);
  assert.deepEqual(ranTests(green.out), NAMES, 'the named tests ran');
  writeFileSync(file, broken);
  const red = run();
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  writeFileSync(file, text);
  const again = run();
  assert.equal(again.status, 0, again.out);
  const failing = [...red.out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing.join(' | ')}`);
});
}
