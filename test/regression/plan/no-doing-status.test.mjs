// Expect: retire-doing/doing-refused, retire-doing/ready-rules, retire-doing/tests-bite
// The plan check refuses an item at doing and still holds the ready rules once doing is gone, the freeze gate still
// refuses a contract change without the replan label, and the plan-check test goes red with doing back in the schema.
// Every run is on a temp copy of plan/ or in a temp repo.
import assert from 'node:assert/strict';
import { onlyTests, ranTests, childEnv } from '../lib.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;
const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

const cleanEnv = () => {
  return childEnv({ drop: ['BASE_SHA', 'HEAD_SHA', 'PR_BRANCH', 'PR_BODY', 'PR_LABELS'] });
};
function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** The modules the checkout's ready items name; a plan copy lacks them, so they are made as empty files. */
const readyModules = () => readdirSync(join(REPO, 'plan/items')).filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE)?.[1] ?? '{}'))
  .filter((it) => it.module && it.status === 'ready').map((it) => it.module);
function makeModules(dir, extra = []) {
  for (const p of [...readyModules(), ...extra]) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), ''); }
}

/** A complete ready item file with a new id: a real item's file, its status and fields replaced. */
function itemText(id, fields = {}) {
  const text = read('plan/items/retire-doing.md');
  const head = { ...headOf(text), id, status: 'ready', ...fields };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) delete head[k];
  return withHead(text, head);
}

/** A temp copy of the checkout's plan/ at <dir>/plan; write(id, text) adds an item, check() runs plan/check.mjs. */
function tempPlan(t, { modules = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rd-plan-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  makeModules(dir, modules);
  return {
    dir,
    write(id, text) { writeFileSync(join(dir, 'plan/items', `${id}.md`), text); },
    check() { return node([join(dir, 'plan/check.mjs')]); },
  };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rd', GIT_AUTHOR_EMAIL: 'rd@x',
  GIT_COMMITTER_NAME: 'rd', GIT_COMMITTER_EMAIL: 'rd@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's plan/, scripts/ and package.json plus
 * baseFiles. branch(name) starts a PR branch from the base; commit(files, msg) writes and commits; gate(which, env)
 * runs pr-gate.mjs from the branch tip with BASE_SHA at the base.
 */
function gateRepo(t, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rd-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  makeModules(dir);
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', `${msg}\n\nClaude-Session: https://claude.ai/code/session_rd`);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    gate(which, { branch = '', body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

{
const ID = 'rd-probe';

test('the untouched copy of the head plan passes', (t) => {
  const r = tempPlan(t).check();
  assert.equal(r.status, 0, r.out);
});

test('an item at doing is refused, naming its status field', (t) => {
  const p = tempPlan(t);
  p.write(ID, itemText(ID, { status: 'doing' }));
  const r = p.check();
  t.diagnostic(r.out.trim());
  assert.notEqual(r.status, 0, r.out);
  const lines = r.out.split('\n').filter((l) => l.includes(`${ID}.md`));
  assert.ok(lines.some((l) => /\.status\b/.test(l)), r.out);
});

for (const status of ['ready', 'done']) {
  test(`the same item at ${status} passes`, (t) => {
    const p = tempPlan(t);
    p.write(ID, itemText(ID, { status }));
    const r = p.check();
    t.diagnostic(r.out.trim().split('\n').at(-1));
    assert.equal(r.status, 0, r.out);
  });
}
}

{
const MOD = 'lib/rd-module.js';
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const withCheck = (id, status, check) => {
  const head = headOf(itemText(id));
  return itemText(id, { status, expect: head.expect.map((e, i) => (i === 0 ? { ...e, check } : e)) });
};

test('a ready item whose Expect check pins main is refused; the same check on a draft passes', (t) => {
  const p = tempPlan(t);
  p.write('rd-pin', withCheck('rd-pin', 'ready', 'The record renders as on main'));
  const r = p.check();
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('rd-pin')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /rd-pin\.md/);
  assert.match(r.out, /as on main/);
  const q = tempPlan(t);
  q.write('rd-pin', withCheck('rd-pin', 'draft', 'The record renders as on main'));
  assert.equal(q.check().status, 0);
});

test('a ready item naming a module that does not exist is refused; with the module made it passes', (t) => {
  const p = tempPlan(t);
  p.write('rd-mod', itemText('rd-mod', { module: MOD }));
  const r = p.check();
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('rd-mod')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /rd-mod\.md.*module lib\/rd-module\.js does not exist/);
  const q = tempPlan(t, { modules: [MOD] });
  q.write('rd-mod', itemText('rd-mod', { module: MOD }));
  assert.equal(q.check().status, 0, q.check().out);
});

test('a ready fourth fix to a module with three done fixes in 14 days is refused; with two it passes', (t) => {
  const run = (n) => {
    const p = tempPlan(t, { modules: [MOD] });
    for (let i = 0; i < n; i++)
      p.write(`fix-rd-done${i}`, itemText(`fix-rd-done${i}`, { status: 'done', module: MOD, done_on: daysAgo(i + 1) }));
    p.write('fix-rd-next', itemText('fix-rd-next', { module: MOD }));
    return p.check();
  };
  const r = run(3);
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('fix-rd-next')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /fix-rd-next\.md: .*fourth fix to lib\/rd-module\.js/);
  const two = run(2);
  assert.equal(two.status, 0, two.out);
});

const changeExpect = (text) => {
  const head = headOf(text);
  return itemText(head.id, { ...head, expect: [...head.expect, { id: 'added', check: 'One more line holds', how: 'a test',
    proof: 'verifier' }] });
};

test('freeze refuses a PR without the replan label that changes the Expect lines of an item done at the base', (t) => {
  const done = itemText('rd-done', { status: 'done' });
  const r = gateRepo(t, { 'plan/items/rd-done.md': done });
  r.branch('build/other');
  r.commit({ 'plan/items/rd-done.md': changeExpect(done) }, 'change a done item');
  const out = r.gate('freeze', { branch: 'build/other', body: 'Changes things.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /rd-done/);
});

test('freeze passes a PR that changes a ready item it does not name and that has no verdict file', (t) => {
  const ready = itemText('rd-ready');
  const r = gateRepo(t, { 'plan/items/rd-ready.md': ready });
  r.branch('build/other');
  r.commit({ 'plan/items/rd-ready.md': changeExpect(ready) }, 'change a ready item');
  const out = r.gate('freeze', { branch: 'build/other', body: 'Changes things.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

test('plan-check.test.mjs goes red with doing back in the schema, green restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'rd-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'test/plan-check.test.mjs']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const NAMES = ['doing is no longer a status: an item holding it is refused'];
  const run = () => node(['--test', '--test-reporter=tap', onlyTests(NAMES), join(dir, 'test/plan-check.test.mjs')], { cwd: dir });
  const schema = join(dir, 'plan/item.schema.json');
  const text = readFileSync(schema, 'utf8');
  const from = '"ready",\n        "done",';
  assert.ok(text.includes(from), 'the schema enum lists ready then done');
  const green = run();
  assert.equal(green.status, 0, green.out);
  assert.deepEqual(ranTests(green.out), NAMES, 'the named tests ran');
  writeFileSync(schema, text.replace(from, '"ready",\n        "doing",\n        "done",'));
  const red = run();
  writeFileSync(schema, text);
  const again = run();
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  assert.ok(failing(red.out).some((n) => /doing/.test(n)), failing(red.out).join(' | '));
});
}
