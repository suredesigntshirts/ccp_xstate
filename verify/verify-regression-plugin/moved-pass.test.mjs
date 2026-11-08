// moved-pass: every test file under test/regression/ passes alone under node --test with at least one passing test;
// its first comment names Expect lines as <item>/<expect-id> that the plan has; and no file there reads a path under
// verify/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { REPO, walk } from './lib.mjs';

const ROOT = join(REPO, 'test', 'regression');
const files = walk(ROOT).filter((p) => p.endsWith('.test.mjs')).sort();
const code = walk(ROOT).filter((p) => /\.(mjs|js)$/.test(p));

/** The ids of an item's Expect lines, from the JSON head of plan/items/<item>.md, or null when there is no item. */
function expectIds(item) {
  const p = join(REPO, 'plan', 'items', `${item}.md`);
  if (!existsSync(p)) return null;
  const text = readFileSync(p, 'utf8');
  const head = text.slice(text.indexOf('```json') + 7, text.indexOf('```', text.indexOf('```json') + 7));
  return (JSON.parse(head).expect ?? []).map((e) => e.id);
}

/** The <item>/<id> names in a file's first comment's Expect line. */
function named(text) {
  const first = [];
  for (const l of text.split('\n')) { if (!l.startsWith('//')) break; first.push(l); }
  const line = first.find((l) => /^\/\/\s*Expect:/.test(l));
  return line ? [...line.replace(/^\/\/\s*Expect:/, '').matchAll(/([a-z0-9-]+)\/([a-z0-9-]+)/g)].map((m) => [m[1], m[2]]) : [];
}

function runAlone(file) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', () => {});
    child.on('close', (exit) => resolve({ exit, pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? 0), fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? -1) }));
  });
}

test('moved-pass: each test file under test/regression/ passes alone, with at least one passing test', { timeout: 900_000 }, async (t) => {
  assert.ok(files.length > 20, `${files.length} files`);
  const results = {};
  const queue = [...files];
  const workers = Array.from({ length: Math.max(2, Math.min(6, availableParallelism())) }, async () => {
    while (queue.length) { const f = queue.shift(); results[f] = await runAlone(f); }
  });
  await Promise.all(workers);
  for (const f of files) {
    const r = results[f];
    assert.equal(r.exit, 0, `${f} exits 0`);
    assert.equal(r.fail, 0, `${f} fails none`);
    assert.ok(r.pass >= 1, `${f} passes ${r.pass}`);
  }
  t.diagnostic(`${files.length} files, ${Object.values(results).reduce((n, r) => n + r.pass, 0)} tests pass`);
});

test('moved-pass: each file\'s first comment names Expect lines the plan has', () => {
  for (const f of files) {
    const names = named(readFileSync(join(REPO, f), 'utf8'));
    assert.ok(names.length >= 1, `${f}: first comment names an Expect line`);
    for (const [item, id] of names) {
      const ids = expectIds(item);
      assert.ok(ids, `${f}: item ${item} is in plan/items/`);
      assert.ok(ids.includes(id), `${f}: ${item} has Expect ${id}`);
    }
  }
});

test('moved-pass: the header reader refuses a made-up id and a missing header (control)', () => {
  assert.deepEqual(named('// no expect here\nimport x'), []);
  assert.deepEqual(named('import x\n// Expect: wf-quick-fix/cases'), []);
  const [[item, id]] = named('// Expect: wf-quick-fix/not-an-id\n');
  assert.ok(!expectIds(item).includes(id));
  assert.equal(expectIds('no-such-item'), null);
});

// A path under verify/ as a string (verify/..., ../../verify/...) or as path parts ('verify', '<folder>').
const READS_VERIFY = [/['"`](?:\.{1,2}\/)*verify\//, /(?:join|resolve)\([^)]*['"`]verify['"`]\s*,\s*['"`][a-z]/];

test('moved-pass: no code file under test/regression/ names a path under verify/', () => {
  for (const f of code) {
    const text = readFileSync(join(REPO, f), 'utf8');
    for (const re of READS_VERIFY) assert.doesNotMatch(text, re, f);
  }
  // control: the same patterns see each form
  for (const s of ["readFileSync('verify/engine-host/x.json')", "new URL('../../../verify/x/y', import.meta.url)", "join(REPO, 'verify', 'engine-host')"]) {
    assert.ok(READS_VERIFY.some((re) => re.test(s)), s);
  }
});
