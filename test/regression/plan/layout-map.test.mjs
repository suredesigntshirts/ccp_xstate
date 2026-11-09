// Expect: map-once-traps-written/map-complete, map-once-traps-written/tests-bite
// test/docs.test.mjs, run on a temp copy of the repo's docs, fails naming a new scripts/ folder the Layout table lacks,
// and goes red when the scripts/gates/ entry or the whole scripts/ row leaves the table.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { childEnv } from '../lib.mjs';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const read = (p, root = REPO) => readFileSync(join(root, p), 'utf8');

function node(args, opts = {}) {
  const env = childEnv({ drop: ['BASE_SHA', 'HEAD_SHA', 'PR_BODY', 'PR_LABELS'], add: opts.env });
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

/** Runs test/docs.test.mjs from the checkout at `dir`. */
const docsTest = (dir) => node(['--test', '--test-reporter=tap', join(dir, 'test/docs.test.mjs')], { cwd: dir });

/** The folders the map must name, read from the file system: top-level ones but .git, node_modules and dot folders
 * other than .github, and every folder under scripts/. */
function folders(root = REPO) {
  const dirs = (rel) => readdirSync(join(root, rel), { withFileTypes: true })
    .filter((e) => e.isDirectory() || (e.isSymbolicLink() && rel === '.')).map((e) => e.name);
  const top = dirs('.').filter((n) => n !== '.git' && n !== 'node_modules' && (n === '.github' || !n.startsWith('.')));
  return [...top, ...dirs('scripts').map((n) => `scripts/${n}`)];
}

/** A folder is named when a token is the folder, with or without its trailing slash or a /<placeholder> tail. */
const named = (folder, tokens) => tokens.some((t) => t.replace(/\/<[^/]*>.*$/, '').replace(/\/$/, '') === folder);

/** A temp checkout for test/docs.test.mjs: CLAUDE.md, plan, docs, test and scripts copied, every other entry linked. */
function docsCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const copied = new Set(['CLAUDE.md', 'plan', 'docs', 'test', 'scripts']);
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || copied.has(n)) continue;
    symlinkSync(join(REPO, n), join(dir, n));
  }
  for (const p of copied) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  return dir;
}

{
test('test/docs.test.mjs fails naming scripts/x when that folder is added', (t) => {
  const dir = docsCopy(t);
  const green = docsTest(dir);
  assert.equal(green.status, 0, green.out);
  mkdirSync(join(dir, 'scripts/x'));
  writeFileSync(join(dir, 'scripts/x/a.mjs'), '// a\n');
  const red = docsTest(dir);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, with scripts/x ${JSON.stringify(counts(red.out))}`);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  assert.match(red.out, /scripts\/x/);
  t.diagnostic(red.out.split('\n').filter((l) => /scripts\/x/.test(l)).slice(0, 3).join(' | '));
});
}

{
function bite(t, dir, broken) {
  const p = join(dir, 'CLAUDE.md');
  const text = readFileSync(p, 'utf8');
  const green = docsTest(dir);
  assert.equal(green.status, 0, green.out);
  const changed = broken(text);
  assert.notEqual(changed, text, 'the mutation changed CLAUDE.md');
  writeFileSync(p, changed);
  const red = docsTest(dir);
  writeFileSync(p, text);
  const again = docsTest(dir);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  assert.equal(again.status, 0, again.out);
  return red.out;
}

test("docs.test.mjs goes red when scripts/gates/ leaves the Layout table's scripts row", (t) => {
  const dir = docsCopy(t);
  const red = bite(t, dir, (s) => s.replace('`scripts/gates/` the PR gates; ', ''));
  assert.match(red, /scripts\/gates/);
});

test("docs.test.mjs goes red when the Layout table's scripts/ row leaves", (t) => {
  const dir = docsCopy(t);
  const red = bite(t, dir, (s) => s.split('\n').filter((l) => !l.startsWith('| `scripts/`')).join('\n'));
  assert.match(red, /scripts\/gates/);
});
}
