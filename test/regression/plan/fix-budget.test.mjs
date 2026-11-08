// Expect: fix-budget-rule/budget-refuses, fix-budget-rule/names-module
// The plan check refuses a fourth ready fix to a module with three done fixes in 14 days, and a ready fix whose module
// does not exist or a done item naming a module without done_on. Every edit is on a temp copy of plan/.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;

/** The modules the checkout's ready items name. */
const liveModules = () => readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE)?.[1] ?? '{}'))
  .filter((it) => it.module && it.status === 'ready')
  .map((it) => it.module);
const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

/** A day N days before today, as YYYY-MM-DD in UTC (the check counts from today's UTC date). */
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** A temp folder holding a copy of the checkout's plan/ at <dir>/plan, with module paths made under <dir>. */
function tempPlan(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fbr-'));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  // The copy holds plan/ alone, so each module a real ready item names is made in it too.
  for (const path of liveModules()) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), ''); }
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  // A done fix item with a complete ready head and a Verifier brief, used as the template for new items.
  const template = readFileSync(join(REPO, 'plan/items/fix-finish-closes-waits.md'), 'utf8');
  const plan = {
    dir,
    touch(p) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), '// module\n'); },
    /** Add an item cloned from the template: fields override the head; a field set to undefined is removed. */
    add(id, fields) {
      const head = { ...headOf(template), id };
      for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete head[k]; else head[k] = v; }
      writeFileSync(join(dir, 'plan/items', `${id}.md`), withHead(template, head));
    },
    edit(id, fields) {
      const f = join(dir, 'plan/items', `${id}.md`);
      const text = readFileSync(f, 'utf8');
      const head = headOf(text);
      for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete head[k]; else head[k] = v; }
      writeFileSync(f, withHead(text, head));
    },
    run() {
      const r = spawnSync(process.execPath, [join(dir, 'plan/check.mjs')], { encoding: 'utf8' });
      return { code: r.status, out: r.stdout + r.stderr };
    },
  };
  return plan;
}

// Dates read in UTC, as the decision file's backfill does.
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, TZ: 'UTC' } });

{
const M = 'packages/vfy/m.js';
const FIXES = ['fix-vfy-a', 'fix-vfy-b', 'fix-vfy-c'];

function setup(t, ages = [1, 3, 5]) {
  const p = tempPlan(t);
  p.touch(M);
  FIXES.slice(0, ages.length).forEach((id, i) => p.add(id, { status: 'done', module: M, done_on: daysAgo(ages[i]) }));
  return p;
}
const fourth = (p, status = 'ready') => p.add('fix-vfy-fourth', { status, module: M, done_on: undefined });
const refusal = (r) => r.out.split('\n').find((l) => l.includes('fix-vfy-fourth'));

test('three done fixes in 14 days refuse a ready fourth, naming M, the three ids and plan/README.md', (t) => {
  const p = setup(t);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  const line = refusal(r);
  assert.ok(line.includes(M), line);
  for (const id of FIXES) assert.ok(line.includes(id), `${id} in ${line}`);
  assert.ok(line.includes('plan/README.md'), line);
  console.log(line);
});

test('with two such fixes it passes', (t) => {
  const p = setup(t, [1, 3]);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a fix done exactly 14 days ago still counts', (t) => {
  const p = setup(t, [1, 3, 14]);
  fourth(p);
  assert.equal(p.run().code, 1);
});

test('with one of the three done 15 days ago it passes', (t) => {
  const p = setup(t, [1, 3, 15]);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done non-fix item naming M after the three makes it pass', (t) => {
  const p = setup(t, [3, 4, 5]);
  p.add('vfy-design-after', { status: 'done', module: M, done_on: daysAgo(1) });
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done non-fix item naming M dated before the three does not', (t) => {
  const p = setup(t, [1, 2, 3]);
  p.add('vfy-design-before', { status: 'done', module: M, done_on: daysAgo(6) });
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  assert.ok(refusal(r).includes(M));
});

test('a ready non-fix item naming M (the design item) passes', (t) => {
  const p = setup(t);
  p.add('vfy-design-ready', { status: 'ready', module: M, done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a draft fourth fix is not counted or refused', (t) => {
  const p = setup(t);
  fourth(p, 'draft');
  assert.equal(p.run().code, 0);
});
}

{
test('the untouched copy of the head plan passes', (t) => {
  const p = tempPlan(t);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

for (const status of ['ready', 'done']) {
  test(`a ${status} fix item without module is refused by name and field`, (t) => {
    const p = tempPlan(t);
    p.add('fix-vfy-nomodule', { status, module: undefined, done_on: status === 'done' ? daysAgo(1) : undefined });
    const r = p.run();
    assert.equal(r.code, 1, r.out);
    const line = r.out.split('\n').find((l) => l.includes('fix-vfy-nomodule'));
    assert.ok(line, r.out);
    assert.match(line, /\(module\)|module/);
    console.log(status, '->', line);
  });
}

test('a ready fix item whose module path does not exist is refused', (t) => {
  const p = tempPlan(t);
  p.add('fix-vfy-ghost', { status: 'ready', module: 'packages/no/such.js', done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  const line = r.out.split('\n').find((l) => l.includes('fix-vfy-ghost'));
  assert.match(line, /packages\/no\/such\.js/);
  console.log(line);
});

test('the same item passes once the module path exists', (t) => {
  const p = tempPlan(t);
  p.touch('packages/no/such.js');
  p.add('fix-vfy-ghost', { status: 'ready', module: 'packages/no/such.js', done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done item (fix or not) naming a module without done_on is refused', (t) => {
  for (const id of ['fix-vfy-nodate', 'vfy-design-nodate']) {
    const p = tempPlan(t);
    p.add(id, { status: 'done', module: 'packages/m.js', done_on: undefined });
    const r = p.run();
    assert.equal(r.code, 1, r.out);
    const line = r.out.split('\n').find((l) => l.includes(id));
    assert.match(line, /done_on/);
    console.log(line);
  }
});

test('a draft fix item without module, and a ready non-fix item without module, pass', (t) => {
  const p = tempPlan(t);
  p.add('fix-vfy-draft', { status: 'draft', module: undefined, done_on: undefined });
  p.add('vfy-plain-ready', { status: 'ready', module: undefined, done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});
}
