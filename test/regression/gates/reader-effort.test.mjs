// Expect: plan-reader-effort/categories, plan-reader-effort/exports, plan-reader-effort/reader-lines, plan-reader-effort/not-a-contract-change, plan-reader-effort/plan-rule, plan-reader-effort/tests-bite
// reader-effort.mjs splits a temp branch's lines by category, counts exports and reader lines; the freeze gate leaves
// reader_effort outside the contract; the plan check refuses a malformed one; the script's test goes red when the
// categoriser is broken. Every run is in a temp repo, on a temp plan copy or in a temp copy of scripts/.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const SCRIPT = join(REPO, 'scripts/reader-effort.mjs');
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'pre', GIT_AUTHOR_EMAIL: 'pre@x',
  GIT_COMMITTER_NAME: 'pre', GIT_COMMITTER_EMAIL: 'pre@x' };

/**
 * A temp git repo on main. commit(files, msg) writes files (null deletes) and commits; branch(name) starts a branch
 * from the current main; merge(name, n) merges it into main with --no-ff as "Merge pull request #n from x/<name>".
 * effort(arg) runs the checkout's reader-effort.mjs from the repo with --json and parses the object.
 */
function tempRepo(t, { copy = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-repo-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of copy) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit({}, 'base');
  return {
    dir, base, git, commit,
    branch(name, from = 'main') { git('checkout', '-q', '-B', name, from); },
    merge(name, n) {
      git('checkout', '-q', 'main');
      git('merge', '-q', '--no-ff', '-m', `Merge pull request #${n} from x/${name}`, name);
      return git('rev-parse', 'HEAD');
    },
    effort(arg) {
      const r = node([SCRIPT, arg, '--json'], { cwd: dir });
      if (r.status !== 0) throw new Error(`reader-effort ${arg} exited ${r.status}: ${r.out}`);
      return JSON.parse(r.stdout);
    },
    gate(which, { body = '', labels = [], branch = '' } = {}, baseSha = base) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: baseSha, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// A file of n numbered lines, each ending in a newline.
const lines = (n, tag = 'l') => Array.from({ length: n }, (_, i) => `${tag}${i + 1}`).join('\n') + '\n';

// The JSON head of an item file and the text after it.
function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
const joinItem = (head, rest) => '```json\n' + JSON.stringify(head, null, 2) + '\n```\n' + rest;

{
// Content of a file that started as lines(n, tag) after dropping its last `drop` lines and appending `add` new ones:
// git counts `add` added and `drop` removed.
const edit = (n, tag, drop, add) => lines(n, tag).split('\n').slice(0, n - drop).join('\n') + (n - drop ? '\n' : '') +
  (add ? lines(add, `${tag}-new`) : '');

const BASE = {
  'src/app.mjs': lines(10, 'app'),
  'src/old.mjs': lines(4, 'old'),
  'src/app.test.mjs': lines(5, 'apptest'),
  'verify/toy/a.test.mjs': lines(5, 'va'),
  'verify/toy/evidence/e.md': lines(5, 'ev'),
  'docs/note.md': lines(5, 'note'),
  'workflows/quick-fix/plan.md': lines(5, 'stage'),
  'packages/engine/messages.md': lines(3, 'msg'),
};
const BRANCH = {
  // code: +3 -1, +2 -2 (stage file), +1 (messages.md), +4 (new json), -4 (deleted) => +10 -7
  'src/app.mjs': edit(10, 'app', 1, 3),
  'workflows/quick-fix/plan.md': edit(5, 'stage', 2, 2),
  'packages/engine/messages.md': edit(3, 'msg', 0, 1),
  'src/config.json': lines(4, 'cfg'),
  'src/old.mjs': null,
  // tests: +2 -1 (*.test.mjs), +3 (under test/), +1 (under fixtures/) => +6 -1
  'src/app.test.mjs': edit(5, 'apptest', 1, 2),
  'test/helpers/x.mjs': lines(3, 'th'),
  'packages/engine/fixtures/sample.txt': lines(1, 'fx'),
  // verifier: +4 (verify/<item>/*.test.mjs), +2 (verify/<item>/lib.mjs, still a .mjs) => +6 -0
  'verify/toy/a.test.mjs': edit(5, 'va', 0, 4),
  'verify/toy/lib.mjs': lines(2, 'vl'),
  // evidence: +5 -2 (evidence .md), +3 (verdict.json), +1 (a .md under verify/ is evidence, not docs) => +9 -2
  'verify/toy/evidence/e.md': edit(5, 'ev', 2, 5),
  'verify/toy/verdict.json': lines(3, 'vd'),
  'verify/toy/notes.md': lines(1, 'vn'),
  // docs: +1 -3, +2 => +3 -3
  'docs/note.md': edit(5, 'note', 3, 1),
  'README.md': lines(2, 'rd'),
};
const WANT = {
  files: Object.keys(BRANCH).length,
  added: { code: 10, tests: 6, verifier: 6, evidence: 9, docs: 3 },
  removed: { code: 7, tests: 1, verifier: 0, evidence: 2, docs: 3 },
};

function build(t) {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base files');
  r.branch('feature');
  const head = r.commit(BRANCH, 'the change');
  const merge = r.merge('feature', 7);
  return { r, base, head, merge };
}

test('the git numstat of the temp branch is what the fixture means it to be', (t) => {
  const { r, base, head } = build(t);
  const rows = r.git('diff', '--no-renames', '--numstat', base, head).split('\n');
  const total = rows.reduce((a, row) => { const [x, y] = row.split('\t'); return [a[0] + +x, a[1] + +y]; }, [0, 0]);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(rows.length, WANT.files);
  assert.deepEqual(total, [sum(WANT.added), sum(WANT.removed)]);
});

test('a base..head range splits each file into the category the decision gives it', (t) => {
  const { r, base, head } = build(t);
  const got = r.effort(`${base}..${head}`);
  t.diagnostic(JSON.stringify(got));
  assert.equal(got.pr, undefined);
  assert.equal(got.files, WANT.files);
  assert.deepEqual(got.added, WANT.added);
  assert.deepEqual(got.removed, WANT.removed);
});

test('the PR number finds the merge titled "Merge pull request #7" and reports the same numbers', (t) => {
  const { r, base, merge } = build(t);
  // A later unrelated merge whose number starts with 7 must not be taken for #7.
  r.branch('other');
  r.commit({ 'src/later.mjs': lines(50, 'later') }, 'later');
  r.merge('other', 70);
  const got = r.effort('7');
  const range = r.effort(`${base}..${merge}`);
  t.diagnostic(JSON.stringify(got));
  assert.equal(got.pr, 7);
  assert.equal(got.files, WANT.files);
  assert.deepEqual(got.added, WANT.added);
  assert.deepEqual(got.removed, WANT.removed);
  assert.deepEqual({ ...got, pr: undefined }, { ...range, pr: undefined });
});
}

{
const BASE = {
  'src/lib.mjs': 'export function old() {\n  return 0;\n}\n\nexport const keep = 1;\n',
  'src/util.js': 'const a = 1;\nexport function stays() {}\n',
  'src/lib.test.mjs': "import test from 'node:test';\n",
  'verify/toy/helpers.mjs': 'export const v = 1;\n',
};
const BRANCH = {
  // removes `old`, adds `added` and `C1`
  'src/lib.mjs': 'export function added() {\n  return 1;\n}\n\nexport const keep = 1;\nexport const C1 = 2;\n',
  // adds `b` (as a renamed export) and a default export
  'src/util.js': 'const a = 1;\nexport function stays() {}\nexport { a as b };\nexport default stays;\n',
  // exports in a test file and in verifier files: not counted
  'src/lib.test.mjs': "import test from 'node:test';\nexport function testHelper() {}\nexport const T = 1;\n",
  'verify/toy/helpers.mjs': 'export const v = 1;\nexport function verifierHelper() {}\nexport default 3;\n',
  'verify/toy/x.test.mjs': 'export const w = 1;\n',
};

test('four exports added and one removed across code files; test and verifier exports are not counted', (t) => {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base');
  r.branch('exports');
  const head = r.commit(BRANCH, 'exports');
  r.merge('exports', 12);
  const ranged = r.effort(`${base}..${head}`);
  const byPr = r.effort('12');
  t.diagnostic(`range: +${ranged.exports_added} -${ranged.exports_removed}; #12: +${byPr.exports_added} -${byPr.exports_removed}`);
  for (const got of [ranged, byPr]) {
    assert.equal(got.exports_added, 4);
    assert.equal(got.exports_removed, 1);
  }
});

test('with only test and verifier files changed, no export is counted', (t) => {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base');
  r.branch('tests-only');
  const head = r.commit({ 'src/lib.test.mjs': BRANCH['src/lib.test.mjs'], 'verify/toy/helpers.mjs': BRANCH['verify/toy/helpers.mjs'],
    'verify/toy/x.test.mjs': BRANCH['verify/toy/x.test.mjs'] }, 'tests only');
  const got = r.effort(`${base}..${head}`);
  assert.equal(got.exports_added, 0);
  assert.equal(got.exports_removed, 0);
});
}

{
const UTIL = [
  'export function helper(x) {', //  4 lines
  '  const y = x + 1;',
  '  return y * 2;',
  '}',
  'export const one = (x) => x;', // 1 line: closes on its own line
  'export const arrow = (x) => {', // 3 lines
  '  return x;',
  '};',
  '',
].join('\n');
const MAIN = "import { helper, one, arrow } from './util.mjs';\n" + lines(4, '// main');

function repo(t) {
  const r = tempRepo(t);
  const base = r.commit({ 'src/util.mjs': UTIL, 'src/main.mjs': MAIN, 'src/main.test.mjs': "import test from 'node:test';\n" }, 'base');
  r.branch('change');
  return { r, base };
}
const effort = (t, r, base, files) => {
  const head = r.commit(files, 'change');
  const got = r.effort(`${base}..${head}`);
  t.diagnostic(`reader_lines ${got.reader_lines}; added ${JSON.stringify(got.added)} removed ${JSON.stringify(got.removed)}`);
  return got;
};

test('three calls to an unchanged file\'s 4-line definition, from code and a test, add its 4 lines once', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/main.mjs': MAIN + 'helper(1);\nhelper(2);\nconst z = helper(3);\n',
    'src/main.test.mjs': "import test from 'node:test';\nhelper(4);\n",
  });
  assert.equal(got.reader_lines, 3 + 1 + 4);
});

test('a one-line and a three-line definition add one and three lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, { 'src/main.mjs': MAIN + 'one(1);\narrow(2);\n' });
  assert.equal(got.reader_lines, 2 + 1 + 3);
});

test('a call to a name the repo does not define adds nothing', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, { 'src/main.mjs': MAIN + 'nosuch(1);\nalsoMissing();\n' });
  assert.equal(got.reader_lines, 2);
});

test('a definition the branch adds, in a new file or in the changed file, is counted once as hunk lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/fresh.mjs': 'export function fresh() {\n  return 1;\n}\n', // 3 added lines
    'src/main.mjs': MAIN + "function local() {\n  return 2;\n}\nfresh();\nlocal();\n", // 5 added lines
  });
  assert.equal(got.reader_lines, 3 + 5);
});

test('evidence lines are reported but not in reader_lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/main.mjs': MAIN + 'helper(1);\n',
    'verify/toy/evidence/calls.md': lines(10, 'helper(9) '),
    'verify/toy/verdict.json': '{ "x": "helper(8)" }\n',
  });
  assert.equal(got.added.evidence, 11);
  assert.equal(got.reader_lines, 1 + 4);
});
}

{
const ID = 'clean-room-install-test';
const PATH = `plan/items/${ID}.md`;
const { head: HEAD, rest: REST } = splitItem(read(PATH));
const EFFORT = { pr: 7, files: 3, exports_added: 0, exports_removed: 0, reader_lines: 12,
  added: { code: 4, tests: 2, verifier: 3, evidence: 5, docs: 1 },
  removed: { code: 1, tests: 0, verifier: 0, evidence: 0, docs: 1 } };

function pr(t, change) {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'ready' }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base: the item is ready and verified');
  r.branch(`replan/${ID}-done`);
  r.commit({ [PATH]: joinItem(change({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }), REST) },
    'done replan');
  const out = r.gate('freeze', { labels: ['replan'], branch: `replan/${ID}-done` }, base);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n').join(' / ')}`);
  return out;
}

test('status done, done_on and reader_effort alone pass the freeze gate', (t) => {
  const out = pr(t, (h) => h);
  assert.equal(out.status, 0, out.out);
});

test('the same PR changing one Expect check as well is refused, naming the item', (t) => {
  const out = pr(t, (h) => ({ ...h, expect: h.expect.map((e, i) => (i === 0 ? { ...e, check: `${e.check}, and more` } : e)) }));
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, new RegExp(ID));
});

test('a changed reader_effort on an item already done passes too (it is outside the contract)', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base');
  r.branch('replan/fix-effort');
  r.commit({ [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: { ...EFFORT, reader_lines: 13 } }, REST) });
  const out = r.gate('freeze', { labels: ['replan'], branch: 'replan/fix-effort' }, base);
  assert.equal(out.status, 0, out.out);
});

test('control: with contract() freezing reader_effort again, the done PR is refused, so the pass comes from contract()', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'ready' }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base');
  r.branch(`replan/${ID}-done`);
  r.commit({ [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }, REST) });
  const lib = `${r.dir}/scripts/gates/lib.mjs`;
  const text = readFileSync(lib, 'utf8');
  const broken = text.replace(/const \{ status, done_on, reader_effort, \.\.\.rest \}/, 'const { status, done_on, ...rest }');
  assert.notEqual(broken, text, 'contract() destructures reader_effort out of the head');
  writeFileSync(lib, broken); // the working tree only: the gate reads the PR's diff from git
  const out = r.gate('freeze', { labels: ['replan'], branch: `replan/${ID}-done` }, base);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n').join(' / ')}`);
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, new RegExp(ID));
});
}

{
const BUILD = 'clean-room-install-test'; // a done build item on the real plan, with no done_on
const PROBE = 'probe-platform-baseline'; // a done probe item
// A well-formed reader_effort, as the command prints it for a real merged PR.
const WELL_FORMED = { pr: 189, files: 28, exports_added: 2, exports_removed: 0, reader_lines: 1494,
  added: { code: 120, tests: 160, verifier: 455, evidence: 163, docs: 59 },
  removed: { code: 18, tests: 11, verifier: 0, evidence: 0, docs: 21 } };

const liveModules = () => readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => splitItem(readFileSync(join(REPO, 'plan/items', f), 'utf8')).head ?? {})
  .filter((it) => it.module && it.status === 'ready')
  .map((it) => it.module);

function check(t, id, edit, { verdict }) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  // The copy holds plan/ alone, so each module a real ready item names is made in it too.
  for (const path of liveModules()) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), ''); }
  const p = join(dir, 'plan/items', `${id}.md`);
  const { head, rest } = splitItem(readFileSync(p, 'utf8'));
  writeFileSync(p, joinItem(edit({ ...head }), rest));
  if (verdict) {
    mkdirSync(join(dir, 'verify', id), { recursive: true });
    writeFileSync(join(dir, 'verify', id, 'verdict.json'), JSON.stringify({ item: id }) + '\n');
  }
  const r = node([join(dir, 'plan/check.mjs')], { cwd: dir });
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').filter((l) => l.includes(id) || /plan ok/.test(l)).join(' / ')}`);
  return r;
}
const refused = (r, id) => {
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, new RegExp(`${id}`));
};
const passed = (r) => assert.equal(r.status, 0, r.out);
const done = (on, extra = {}) => (h) => ({ ...h, status: 'done', done_on: on, ...extra });

test('the untouched copy passes', (t) => passed(check(t, BUILD, (h) => h, { verdict: false })));

test('a reader_effort with an unknown field or a non-integer value is refused, naming the item', (t) => {
  const bad = [
    { ...WELL_FORMED, minutes: 3 },
    { ...WELL_FORMED, reader_lines: 1.5 },
    { ...WELL_FORMED, files: '28' },
    { ...WELL_FORMED, added: { ...WELL_FORMED.added, code: 2.5 } },
    { ...WELL_FORMED, removed: { ...WELL_FORMED.removed, styles: 1 } },
  ];
  for (const reader_effort of bad) refused(check(t, BUILD, done('2026-11-09', { reader_effort }), { verdict: true }), BUILD);
});

test('the same item passes with a well-formed reader_effort', (t) =>
  passed(check(t, BUILD, done('2026-11-09', { reader_effort: WELL_FORMED }), { verdict: true })));

test('the same item passes with no verdict file beside the copy (a test\'s made-up item)', (t) =>
  passed(check(t, BUILD, done('2026-11-09'), { verdict: false })));

test('a done build item with an earlier done_on passes without reader_effort', (t) =>
  passed(check(t, BUILD, done('2026-11-08'), { verdict: true })));

test('a done probe item passes with neither reader_effort nor a verdict file, and with a verdict and a late date', (t) => {
  passed(check(t, PROBE, done('2026-11-09'), { verdict: false }));
  passed(check(t, PROBE, done('2026-11-09'), { verdict: true }));
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const run = (dir) => node(['--test', '--test-reporter=tap', join(dir, 'scripts/reader-effort.test.mjs')], { cwd: dir });

test('reader-effort.test.mjs goes red when category() returns code for every path, green when restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pre-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || n === 'scripts') continue;
    symlinkSync(join(REPO, n), join(dir, n));
  }
  cpSync(join(REPO, 'scripts'), join(dir, 'scripts'), { recursive: true });
  const file = join(dir, 'scripts/reader-effort.mjs');
  const text = readFileSync(file, 'utf8');
  const broken = text.replace(/export function category\(path\) \{\n/, "$&  return 'code';\n");
  assert.notEqual(broken, text, 'the categoriser is export function category(path)');

  const green = run(dir);
  assert.equal(green.status, 0, green.out);
  assert.ok(counts(green.out).pass > 0, green.out);
  writeFileSync(file, broken);
  const red = run(dir);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  writeFileSync(file, text);
  const again = run(dir);
  assert.equal(again.status, 0, again.out);
  const failing = [...red.out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing.join(' | ')}`);
});
}
