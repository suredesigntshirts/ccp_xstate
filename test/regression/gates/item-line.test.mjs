// Expect: rules-said-once/item-line-names, rules-said-once/fresh-reader-path, rules-said-once/tests-bite
// The verdict gate names a PR's item by the body's Item line alone, the replan and build PRs a fresh reader described
// pass the freeze and verdict gates as described, and test/docs.test.mjs and the gate tests go red when a named path,
// the line budget or the Item-line rule is broken. Every run is in a temp repo or a temp copy.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rso', GIT_AUTHOR_EMAIL: 'rso@x',
  GIT_COMMITTER_NAME: 'rso', GIT_COMMITTER_EMAIL: 'rso@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's `copy` paths. branch(name) starts a
 * PR-shaped branch from the base; commit(files, msg) writes files (null deletes) and commits; gate(which, env) runs
 * pr-gate.mjs from the branch tip with BASE_SHA set to the base and PR_BRANCH, PR_BODY, PR_LABELS from env.
 */
function gateRepo(t, { copy = ['plan', 'scripts', 'package.json'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rso-gate-'));
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
    file: (p) => readFileSync(join(dir, p), 'utf8'),
    branch(name) { git('checkout', '-q', '-B', name, base); },
    gate(which, { branch = '', body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// The JSON head of an item file and the text after it.
function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}

{
const DRAFT = 'test-fixture-edges';   // an existing draft item at the head
const OTHER = 'fix-budget-rule';      // another existing item, used only as a misleading branch name
const proseEdit = (r) => ({ [`plan/items/${DRAFT}.md`]: `${r.file(`plan/items/${DRAFT}.md`)}\nA line of prose.\n` });

test('a plan-only PR on replan/<existing id> with no Item line passes the verdict gate', (t) => {
  const r = gateRepo(t);
  r.branch(`replan/${DRAFT}`);
  r.commit(proseEdit(r), 'replan: prose\n\nClaude-Session: s-replan');
  const out = r.gate('verdict', { branch: `replan/${DRAFT}`, body: 'Makes it clearer.', labels: ['replan'] });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /verdict gate passed$/m);
  assert.doesNotMatch(out.out, /\(item /);
});

test('a PR on build/<existing id> that changes a file outside plan/ with no Item line is refused for the missing line', (t) => {
  const r = gateRepo(t);
  r.branch(`build/${DRAFT}`);
  r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  const out = r.gate('verdict', { branch: `build/${DRAFT}`, body: 'Builds it.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /names no item \(add an "Item: <id>" line to its body\)/);
  assert.doesNotMatch(out.out, new RegExp(`item ${DRAFT}`));
});

test('Item: <id> in the body judges the PR against that item, whatever the branch is called', (t) => {
  const r = gateRepo(t);
  // A toy item whose one Expect line is world-proven, so a hand-written verdict can be complete.
  const { head, rest } = splitItem(r.file(`plan/items/${DRAFT}.md`));
  const toy = { ...head, id: 'rso-toy', status: 'done',
    expect: [{ id: 'shown', check: 'A line is shown', how: 'Read it', proof: 'world' }] };
  r.commit({ 'plan/items/rso-toy.md': `\`\`\`json\n${JSON.stringify(toy, null, 2)}\n\`\`\`\n${rest}` }, 'base: toy item');
  const base2 = r.git('rev-parse', 'HEAD');
  r.git('checkout', '-q', '-B', `build/${OTHER}`, base2);
  const built = r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  r.commit({ 'verify/rso-toy/verdict.json': JSON.stringify({ item: 'rso-toy', verified_sha: built,
    verifier: { session: 's-verify', model: 'm' },
    results: [{ id: 'shown', status: 'MET', command: 'read it', excerpt: 'a line' }] }) },
  'verify: rso-toy\n\nClaude-Session: s-verify');
  const gate = (body, branch) => r.gate('verdict', { branch, body });
  const toyOnOther = gate('Builds it.\n\nItem: rso-toy\n', `build/${OTHER}`);
  t.diagnostic(`Item: rso-toy on build/${OTHER}: ${toyOnOther.out.trim()}`);
  assert.equal(toyOnOther.status, 0, toyOnOther.out);
  assert.match(toyOnOther.out, /verdict gate passed \(item rso-toy\)/);

  const toyOnClaude = gate('Item: rso-toy', 'claude/some-thread');
  assert.equal(toyOnClaude.status, 0, toyOnClaude.out);

  const draftOnOther = gate(`Item: ${DRAFT}`, 'build/rso-toy');
  t.diagnostic(`Item: ${DRAFT} on build/rso-toy: ${draftOnOther.out.trim()}`);
  assert.equal(draftOnOther.status, 1, draftOnOther.out);
  assert.match(draftOnOther.out, new RegExp(`verdict gate failed \\(item ${DRAFT}\\)`));
  assert.match(draftOnOther.out, new RegExp(`no verify/${DRAFT}/verdict\\.json at the head sha`));
  assert.doesNotMatch(draftOnOther.out, /branch names/);
});

test('an Item line naming an id plan/items/ lacks is refused', (t) => {
  const r = gateRepo(t);
  r.branch('build/rso-x');
  r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  for (const branch of ['build/rso-x', `build/${DRAFT}`, `replan/${DRAFT}`]) {
    const out = r.gate('verdict', { branch, body: 'Item: no-such-item' });
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /the body names item no-such-item, which plan\/items\/ doesn't have/);
  }
  // Plan-only, labelled replan: still refused, because the body names an item that is not there.
  r.branch(`replan/${DRAFT}`);
  r.commit(proseEdit(r), 'replan: prose\n\nClaude-Session: s-replan');
  const out = r.gate('verdict', { branch: `replan/${DRAFT}`, body: 'Item: no-such-item', labels: ['replan'] });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
});
}

{
const ID = 'test-fixture-edges';
const ITEM = `plan/items/${ID}.md`;

function carry(t, branch, files, body, labels) {
  const r = gateRepo(t);
  r.branch(branch);
  const write = typeof files === 'function' ? files(r) : files;
  r.commit(write, `${branch.split('/')[0]}: ${ID}\n\nClaude-Session: https://claude.ai/code/session_rso-builder`);
  const freeze = r.gate('freeze', { branch, body, labels });
  const verdict = r.gate('verdict', { branch, body, labels });
  t.diagnostic(`${branch} freeze: ${freeze.out.trim()}`);
  t.diagnostic(`${branch} verdict: ${verdict.out.trim()}`);
  return { freeze, verdict };
}

test('(1) the readying replan, as answered, passes freeze and verdict', (t) => {
  const { freeze, verdict } = carry(t, `replan/${ID}-ready`,
    (r) => ({ [ITEM]: r.file(ITEM).replace('## ', 'A sentence of prose the readying replan adds.\n\n## ') }),
    'Makes test-fixture-edges ready.', ['replan']);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 0, verdict.out);
});

test('(2) the build PR, as answered, is refused only for its missing verdict', (t) => {
  const { freeze, verdict } = carry(t, `build/${ID}`, { 'test/rso-line.txt': 'one line\n' },
    `Builds it.\n\nItem: ${ID}\n`, []);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 1, verdict.out);
  assert.match(verdict.out, new RegExp(`verdict gate failed \\(item ${ID}\\):\\n  no verify/${ID}/verdict\\.json at the head sha\\s*$`));
  assert.doesNotMatch(verdict.out, /names no item|doesn't have/);
});

test('(4) the done replan, as answered, passes freeze and verdict', (t) => {
  const { freeze, verdict } = carry(t, `replan/${ID}-done`,
    (r) => ({ [ITEM]: `${r.file(ITEM)}\n## Done\n\nBuilt in a build PR and verified by a separate session.\n` }),
    'Marks test-fixture-edges done.', ['replan']);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 0, verdict.out);
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const run = (dir, file) => node(['--test', '--test-reporter=tap', join(dir, file)], { cwd: dir });

// A temp repo for test/docs.test.mjs: the texts and the test are copies, every other top-level entry a symlink.
function docsCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rso-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const copied = new Set(['CLAUDE.md', 'plan', 'docs', 'test']);
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || n === 'node_modules') continue;
    if (copied.has(n)) continue;
    symlinkSync(join(REPO, n), join(dir, n));
  }
  for (const p of copied) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  return dir;
}

function bite(t, dir, file, breakIt, restore) {
  const green = run(dir, file);
  assert.equal(green.status, 0, green.out);
  breakIt();
  const red = run(dir, file);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  restore();
  const again = run(dir, file);
  assert.equal(again.status, 0, again.out);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  return red.out;
}

test('docs.test.mjs goes red when a path CLAUDE.md names is renamed', (t) => {
  const dir = docsCopy(t);
  assert.match(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), /`docs\/gates\.md`/);
  const red = bite(t, dir, 'test/docs.test.mjs',
    () => renameSync(join(dir, 'docs/gates.md'), join(dir, 'docs/gates-renamed.md')),
    () => renameSync(join(dir, 'docs/gates-renamed.md'), join(dir, 'docs/gates.md')));
  assert.match(red, /docs\/gates\.md/);
});

test('docs.test.mjs goes red when CLAUDE.md names a path that is not there', (t) => {
  const dir = docsCopy(t);
  const p = join(dir, 'CLAUDE.md');
  const text = readFileSync(p, 'utf8');
  assert.match(text, /`docs\/layout\.md`/);
  bite(t, dir, 'test/docs.test.mjs',
    () => writeFileSync(p, text.replaceAll("`docs/layout.md`", "`docs/layouts.md`")), () => writeFileSync(p, text));
});

test('docs.test.mjs goes red when the three entry texts reach 230 lines', (t) => {
  const dir = docsCopy(t);
  const count = (f) => { const s = readFileSync(join(dir, f), 'utf8'); return s.split('\n').length - (s.endsWith('\n') ? 1 : 0); };
  const total = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'].reduce((n, f) => n + count(f), 0);
  assert.ok(total < 230, `already ${total}`);
  const p = join(dir, 'docs/gates.md');
  const text = readFileSync(p, 'utf8');
  bite(t, dir, 'test/docs.test.mjs',
    () => writeFileSync(p, text + 'padding\n'.repeat(230 - total)), () => writeFileSync(p, text));
  t.diagnostic(`padded from ${total} to 230 lines`);
});

test('lib.test.mjs goes red when namedItem reads the branch last segment again', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'rso-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const p = join(dir, 'scripts/gates/lib.mjs');
  const text = readFileSync(p, 'utf8');
  const from = /export function namedItem\(\{ body = '', ids \}\) \{\n  const item = (body\.match\([^\n]*?\)\?\.\[1\]) \?\? null;/;
  assert.match(text, from, 'namedItem reads the body alone');
  const fallback = "export function namedItem({ body = '', ids, branch = '' }) {\n" +
    "  const item = $1 ?? (ids.has(branch.split('/').pop()) ? branch.split('/').pop() : null);";
  bite(t, dir, 'scripts/gates/test/lib.test.mjs',
    () => writeFileSync(p, text.replace(from, fallback)), () => writeFileSync(p, text));
});
}
