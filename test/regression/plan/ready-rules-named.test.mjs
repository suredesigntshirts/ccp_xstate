// Expect: item-writer-gaps/hex-words-pass, item-writer-gaps/ready-fields-named, item-writer-gaps/tests-bite
// The plan check passes an Expect check of hex-letter words and still refuses a sha, refuses a ready item missing a
// readyRequired field by name and a dependency in a later stage, and the plan-check test goes red when the sha pattern
// matches hex letters alone. Every edit is on a temp copy of plan/.
import assert from 'node:assert/strict';
import { onlyTests, ranTests } from '../lib.mjs';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const ITEM = 'item-writer-gaps';
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const HEAD_RE = /^```json\n([\s\S]*?)\n```\n/;
function splitItem(text) {
  const m = text.match(HEAD_RE);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
const joinItem = (head, rest) => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n${rest}`;

/** A markdown section, from its heading to the next heading of the same or higher level. */
function section(text, heading) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').trim() === heading);
  if (i < 0) throw new Error(`no section "${heading}"`);
  const level = lines[i].match(/^#+/)[0].length;
  const end = lines.findIndex((l, j) => j > i && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(i + 1, end < 0 ? undefined : end).join('\n');
}

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
function node(args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env },
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * A temp copy of the checkout's plan/, with the module of each ready item made as an empty file. add(head, rest)
 * writes an item file; check() runs the copy's plan check.
 */
function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'iwg-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  for (const f of readdirSync(join(REPO, 'plan/items')).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const m = readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE);
    if (!m) continue;
    const h = JSON.parse(m[1]);
    if (h.status === 'ready' && h.module && !existsSync(join(dir, h.module))) {
      mkdirSync(dirname(join(dir, h.module)), { recursive: true });
      writeFileSync(join(dir, h.module), '');
    }
  }
  return {
    dir,
    add: (head, rest) => writeFileSync(join(dir, 'plan/items', `${head.id}.md`), joinItem(head, rest)),
    check: () => node([join(dir, 'plan/check.mjs')], { cwd: dir }),
  };
}

/** This item's own file, made into a ready item with a new id and no dependants, as a base for a test item. */
function readyItem(id, fields = {}) {
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const { module, done_on, ...bare } = head;
  return { head: { ...bare, id, status: 'ready', ...fields }, rest };
}

{
const ID = 'iwg-hex';
const withCheck = (check) => {
  const { head, rest } = readyItem(ID);
  head.expect = head.expect.map((e, i) => (i === 0 ? { ...e, check } : e));
  return { head, rest };
};
const last = (out) => out.trim().split('\n').at(-1);

test('words made only of the letters a to f pass the plan check', (t) => {
  const p = planCopy(t);
  for (const check of [
    'A defaced page and an effaced label are both shown in the report',
    'The accede and deedbad words stay, and a bead or a facade too: decaded, baddeed, cabbaged',
    'The DEFACED header and a Deadbeef marker are kept',
  ]) {
    p.add(...Object.values(withCheck(check)));
    const r = p.check();
    t.diagnostic(`${JSON.stringify(check)}: exit ${r.status}, ${last(r.out)}`);
    assert.equal(r.status, 0, r.out);
  }
});

test('a sha holding a digit is still refused, naming the sha', (t) => {
  const p = planCopy(t);
  for (const sha of ['a575897', 'deadbe1', '1234567', 'ae70217b923d39bba381423bcafba64ae3cda3ea', 'fce872b', 'ABCDEF0']) {
    p.add(...Object.values(withCheck(`The suite passes at ${sha} and at the head`)));
    const r = p.check();
    t.diagnostic(`${sha}: exit ${r.status}, ${r.out.trim().split('\n').find((l) => l.includes(ID)) ?? last(r.out)}`);
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.includes(`${ID}.md`) && r.out.includes(sha), r.out);
  }
});

test('a word of hex letters beside a sha does not hide the sha', (t) => {
  const p = planCopy(t);
  p.add(...Object.values(withCheck('A defaced page at 6ff276e is shown')));
  const r = p.check();
  t.diagnostic(last(r.out));
  assert.equal(r.status, 1, r.out);
  assert.ok(r.out.includes('6ff276e'), r.out);
});

test('six hex characters, or seven hex characters inside a longer word, are not a sha', (t) => {
  const p = planCopy(t);
  for (const check of ['A count of 123456 is shown', 'The id x1234567y and the path a1b2c3d4_x are shown']) {
    p.add(...Object.values(withCheck(check)));
    const r = p.check();
    t.diagnostic(`${JSON.stringify(check)}: exit ${r.status}`);
    assert.equal(r.status, 0, r.out);
  }
});
}

{
const schema = JSON.parse(read('plan/item.schema.json'));
const stages = (id) => read(`plan/items/${id}.md`).match(/"stage": "([^"]+)"/)[1];

test('each readyRequired field, left empty or out of a ready item, is refused by name', (t) => {
  const p = planCopy(t);
  t.diagnostic(`readyRequired: ${schema.readyRequired.join(', ')}`);
  assert.ok(schema.readyRequired.length >= 8, schema.readyRequired.join(', '));
  const base = readyItem('iwg-open');
  p.add(base.head, base.rest);
  const ok = p.check();
  assert.equal(ok.status, 0, ok.out);
  for (const field of schema.readyRequired) {
    for (const [how, head] of [['empty', { ...base.head, [field]: Array.isArray(base.head[field]) ? [] : (typeof base.head[field] === 'string' ? '' : {}) }],
      ['absent', Object.fromEntries(Object.entries(base.head).filter(([k]) => k !== field))]]) {
      p.add(head, base.rest);
      const r = p.check();
      const line = r.out.split('\n').find((l) => l.includes('iwg-open') && l.includes(field)) ?? '';
      if (how === 'absent') t.diagnostic(`${field} ${how}: exit ${r.status}, ${line}`);
      assert.equal(r.status, 1, `${field} ${how}: ${r.out}`);
      assert.match(line, new RegExp(`\\b${field}\\b`), `${field} ${how}: ${r.out}`);
    }
  }
});

test('the plan check refuses a dependency in a later stage and passes one in the same stage', (t) => {
  const later = 'decide-v1-retirement';
  const own = splitItem(read('plan/items/item-writer-gaps.md')).head.stage;
  assert.notEqual(stages(later), own);
  const p = planCopy(t);
  const { head, rest } = readyItem('iwg-dep');
  p.add({ ...head, depends_on: ['verifier-reader-gaps'] }, rest);
  const same = p.check();
  t.diagnostic(`depends on verifier-reader-gaps (${stages('verifier-reader-gaps')}): exit ${same.status}`);
  assert.equal(same.status, 0, same.out);
  p.add({ ...head, depends_on: [later] }, rest);
  const r = p.check();
  const line = r.out.split('\n').find((l) => l.includes('iwg-dep')) ?? '';
  t.diagnostic(`depends on ${later} (${stages(later)}): exit ${r.status}, ${line}`);
  assert.equal(r.status, 1, r.out);
  assert.match(line, new RegExp(`${later}.*later stage`));
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

test('plan-check.test.mjs goes red with SHA matching hex letters alone, green restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'iwg-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'test/plan-check.test.mjs']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const NAMES = ['a sha of seven or more hex digits is refused; a repo path or a word of hex letters alone is not'];
  const run = () => node(['--test', '--test-reporter=tap', onlyTests(NAMES), join(dir, 'test/plan-check.test.mjs')], { cwd: dir });
  const file = join(dir, 'plan/check.mjs');
  const text = readFileSync(file, 'utf8');
  const line = text.split('\n').find((l) => /^const SHA = /.test(l));
  assert.ok(line, 'plan/check.mjs defines SHA on one line');
  const broken = 'const SHA = /(?<!\\w)[0-9a-f]{7,}(?!\\w)/i;';
  assert.notEqual(line, broken);
  const green = run();
  assert.equal(green.status, 0, green.out);
  assert.deepEqual(ranTests(green.out), NAMES, 'the named tests ran');
  writeFileSync(file, text.replace(line, broken));
  const red = run();
  writeFileSync(file, text);
  const again = run();
  t.diagnostic(`SHA at head: ${line}`);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  assert.ok(failing(red.out).some((n) => /hex letters/.test(n)), failing(red.out).join(' | '));
});
}
