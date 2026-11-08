// moved-pass: every test file under test/regression/ passes under node --test, all started at once, with at least one
// passing test each, and again with Playwright out of reach; its first comment names Expect lines as
// <item>/<expect-id> that the plan has; and no file there reads a path under verify/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, headOf, walk } from './lib.mjs';

const ROOT = join(REPO, 'test', 'regression');
const files = walk(ROOT).filter((p) => p.endsWith('.test.mjs')).sort();
const code = walk(ROOT).filter((p) => /\.(mjs|js|cjs)$/.test(p));
const HIDE = join(REPO, 'verify', 'verify-regression-set', 'no-playwright.mjs');

/** The ids of an item's Expect lines, or null when there is no such item. */
function expectIds(item) {
  const p = join(REPO, 'plan', 'items', `${item}.md`);
  if (!existsSync(p)) return null;
  return (headOf(readFileSync(p, 'utf8')).expect ?? []).map((e) => e.id);
}

/** The <item>/<id> names in a file's first comment's Expect line. */
function named(text) {
  const first = [];
  for (const l of text.split('\n')) { if (!l.startsWith('//')) break; first.push(l); }
  const line = first.find((l) => /^\/\/\s*Expect:/.test(l));
  return line ? [...line.replace(/^\/\/\s*Expect:/, '').matchAll(/([a-z0-9-]+)\/([a-z0-9-]+)/g)].map((m) => [m[1], m[2]]) : [];
}

/** The env a child runs with: no NODE_TEST_CONTEXT, and with hide, Playwright unreachable for it and its children. */
function envFor(hide, empty) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  if (hide) {
    env.NODE_PATH = empty;
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import=${HIDE}`.trim();
  }
  return env;
}

function runOne(file, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', () => {});
    child.on('close', (exit) => resolve({ exit, pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? 0), fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? -1), red: out.split('\n').filter((l) => /^\s*not ok/.test(l)).slice(0, 3) }));
  });
}

/** Every file started at once; [file, result] per file. */
const runAll = async (env) => Object.fromEntries(await Promise.all(files.map(async (f) => [f, await runOne(f, env)])));

function check(t, results, label) {
  for (const f of files) {
    const r = results[f];
    assert.equal(r.exit, 0, `${label}: ${f} exits 0 ${r.red.join(' | ')}`);
    assert.equal(r.fail, 0, `${label}: ${f} fails none`);
    assert.ok(r.pass >= 1, `${label}: ${f} passes ${r.pass}`);
  }
  t.diagnostic(`${label}: ${files.length} files at once, ${Object.values(results).reduce((n, r) => n + r.pass, 0)} tests pass, fewest in one file ${Math.min(...Object.values(results).map((r) => r.pass))}`);
}

test('moved-pass: every file under test/regression/ passes, all at once, at least one test each', { timeout: 1_800_000 }, async (t) => {
  assert.ok(files.length > 50, `${files.length} files`);
  check(t, await runAll(envFor(false)), 'as is');
});

test('moved-pass: the same with Playwright out of reach', { timeout: 1_800_000 }, async (t) => {
  const empty = mkdtempSync(join(tmpdir(), `vrs-nopw-${process.pid}-`));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  check(t, await runAll(envFor(true, empty)), 'no Playwright');
});

test('moved-pass: the hiding preload makes Playwright unreachable by name and by path (control)', (t) => {
  const empty = mkdtempSync(join(tmpdir(), `vrs-nopw-${process.pid}-`));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const probe = `
    import { createRequire } from 'node:module'; import { existsSync } from 'node:fs';
    const req = createRequire(${JSON.stringify(join(REPO, 'package.json'))});
    const paths = ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright'];
    const got = paths.filter((p) => { try { req(p); return true; } catch { return false; } });
    const seen = paths.slice(1).map((p) => p + '/index.mjs').filter(existsSync);
    let imported = true; try { await import('playwright'); } catch { imported = false; }
    console.log(JSON.stringify({ got, seen, imported }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: REPO, env: envFor(true, empty), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { got: [], seen: [], imported: false });
  const plain = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: REPO, env: envFor(false), encoding: 'utf8' });
  t.diagnostic(`without the preload: ${plain.stdout.trim()}`);
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

// A read of the checkout's verify/: a string naming verify/<folder> for a folder there, or join(REPO|ROOT|HERE, 'verify'.
// Gate tests write toy verify/x/ paths into temp repos; those name no real folder.
const FOLDERS = new Set(readdirSync(join(REPO, 'verify')));
function readsVerify(text) {
  const named = [...text.matchAll(/['"`](?:\.{1,2}\/)*verify\/([a-z0-9-]+)/g)].map((m) => m[1]).filter((f) => FOLDERS.has(f));
  return named.length > 0 || /(?:join|resolve)\(\s*(?:REPO|ROOT|HERE|PLUGIN)\b[^)]*['"`](?:\.\.\/)*verify['"`]/.test(text) || /new URL\(['"`](?:\.\.\/)+verify\//.test(text);
}

test('moved-pass: no code file under test/regression/ reads a path under verify/', () => {
  assert.deepEqual(code.filter((f) => readsVerify(readFileSync(join(REPO, f), 'utf8'))), []);
  for (const s of ["readFileSync('verify/fix-event-close-tag/x.json')", "new URL('../../../verify/x/y', import.meta.url)", "join(REPO, 'verify', 'engine-host')", "join(PLUGIN, '..', '..', 'verify', 'probe-plugin-agents-thread')"]) assert.ok(readsVerify(s), s);
  assert.ok(!readsVerify("r.commit({ 'verify/x/evidence/a.md': 'y' })") && !readsVerify("join(dir, 'verify', id)"));
});
