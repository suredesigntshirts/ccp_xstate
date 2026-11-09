// Expect: done-with-the-build/build-sets-done, done-with-the-build/effort-by-item, done-with-the-build/tests-bite
// A build whose first commit sets its item done passes the freeze gate and merges on a verdict from another session;
// reader-effort.mjs --item reads the PR that added the verdict; the tests that guard both go red when the rule is
// broken. Every run is in a temp repo or a temp copy of scripts/.
import assert from 'node:assert/strict';
import { onlyTests, ranTests, childEnv } from '../lib.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'dwtb',
  GIT_AUTHOR_EMAIL: 'dwtb@x', GIT_COMMITTER_NAME: 'dwtb', GIT_COMMITTER_EMAIL: 'dwtb@x' };

/**
 * A temp git repo on main holding a copy of the checkout's `copy` paths in its first commit. commit(files, msg) writes
 * files (null deletes) and commits; gate(which, env) runs pr-gate.mjs from the current tip with BASE_SHA set to `base`.
 */
function tempRepo(t, { copy = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dwtb-'));
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
    gate(which, { body = '', labels = [], from = base } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: from, HEAD_SHA: '', PR_BRANCH: '', PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// The JSON head of an item file and the text after it; and the file back from the two.
function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
const joinItem = (head, rest) => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n${rest}`;

{
const ID = 'dwtb-probe';
const FILE = `plan/items/${ID}.md`;

function readyItem() {
  const { head, rest } = splitItem(read('plan/items/done-with-the-build.md'));
  const { contract_changes, done_on, reader_effort, ...h } = head;
  const brief = rest.slice(rest.indexOf('## Verifier brief'));
  return {
    head: { ...h, id: ID, status: 'ready',
      expect: [{ id: 'probe-world', check: 'The probe file exists at the head', how: 'Read it', proof: 'world' }] },
    rest: `\n## What this is\n\nA probe item for the verifier of done-with-the-build.\n\n${brief}`,
  };
}

test('a build PR whose first commit sets its item done merges on a verdict from another session', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'packages', 'package.json'] });
  const { head, rest } = readyItem();
  const main = r.commit({ [FILE]: joinItem(head, rest) }, 'replan: ready the probe');
  const atMain = node(['plan/check.mjs'], { cwd: r.dir });
  assert.equal(atMain.status, 0, atMain.out);

  r.git('checkout', '-q', '-b', 'build/dwtb-probe');
  const body = `Item: ${ID}\n`;
  const first = r.commit({ [FILE]: joinItem({ ...head, status: 'done', done_on: '2026-11-08' }, rest) },
    `${ID}: done, set in the build PR's first commit\n\nClaude-Session: https://claude.ai/code/session_builder`);
  const built = r.commit({ 'src/probe.txt': 'probe\n' }, `build: ${ID}\n\nClaude-Session: https://claude.ai/code/session_builder`);
  assert.deepEqual(r.git('diff-tree', '--no-commit-id', '--name-only', '-r', first).split('\n'), [FILE]);

  const freeze = r.gate('freeze', { body, from: main });
  assert.equal(freeze.status, 0, freeze.out);
  const before = r.gate('verdict', { body, from: main });
  assert.equal(before.status, 1, before.out);
  const reasons = before.out.split('\n').filter((l) => /^\s{2}\S/.test(l));
  assert.deepEqual(reasons.map((l) => l.trim()), [`no verify/${ID}/verdict.json at the head sha`]);

  const verdict = { item: ID, verified_sha: built,
    verifier: { session: 'https://claude.ai/code/session_verifier', model: 'm' },
    results: [{ id: 'probe-world', status: 'MET', command: 'cat src/probe.txt', excerpt: 'probe' }] };
  r.commit({ [`verify/${ID}/verdict.json`]: JSON.stringify(verdict, null, 2) + '\n' },
    `verify: ${ID}\n\nClaude-Session: https://claude.ai/code/session_verifier`);
  const after = r.gate('verdict', { body, from: main });
  assert.equal(after.status, 0, after.out);
  const freezeAfter = r.gate('freeze', { body, from: main });
  assert.equal(freezeAfter.status, 0, freezeAfter.out);
  const check = node(['plan/check.mjs'], { cwd: r.dir });
  assert.equal(check.status, 0, check.out);
  t.diagnostic(`freeze: ${freeze.out.trim()} | before verdict: ${reasons.map((l) => l.trim()).join('; ')} | after: ${after.out.trim()} | check: ${check.out.trim().split('\n').pop()}`);
});
}

{
const body = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n';

function threePrs(t) {
  const r = tempRepo(t, { copy: ['scripts/reader-effort.mjs'] });
  r.commit({ 'plan/items/probe.md': '{"status":"ready"}\n', 'src/one.js': body(2) }, 'main work');
  const pr = (n, branch, files) => {
    r.git('checkout', '-q', '-b', branch, 'main');
    r.commit(files, `work on ${branch}`);
    r.git('checkout', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', `Merge pull request #${n} from o/${branch}`, branch);
  };
  pr(11, 'first', { 'src/one.js': body(5), 'docs/a.md': 'a\n' });
  pr(12, 'build', { 'plan/items/probe.md': '{"status":"done"}\n', 'src/two.js': body(7),
    'verify/probe/verdict.json': '{"item":"probe"}\n', 'verify/probe/a.test.mjs': 'x\n' });
  pr(13, 'later', { 'plan/items/probe.md': '{"status":"done"}\n\n## Done\n', 'src/one.js': body(9),
    'verify/probe/verdict.json': '{"item":"probe","again":1}\n' });
  return r;
}

const effort = (r, ...args) => node([join(r.dir, 'scripts/reader-effort.mjs'), ...args, '--json'], { cwd: r.dir });

test('--item reads the build PR that added the verdict, not a later merge touching the item', (t) => {
  const r = threePrs(t);
  const byItem = effort(r, '--item', 'probe');
  const byPr = effort(r, '12');
  const later = effort(r, '13');
  assert.equal(byItem.status, 0, byItem.out);
  assert.equal(byPr.status, 0, byPr.out);
  const a = JSON.parse(byItem.stdout), b = JSON.parse(byPr.stdout), c = JSON.parse(later.stdout);
  assert.deepEqual(a, b);
  assert.equal(a.pr, 12);
  assert.notDeepEqual({ ...a, pr: 13 }, c, 'PR #13 reads differently, so the match is not by accident');
  t.diagnostic(`--item probe: ${JSON.stringify(a)}`);
  t.diagnostic(`#12: ${JSON.stringify(b)}`);
  t.diagnostic(`#13: ${JSON.stringify(c)}`);
});

test('--item for an item with no merged verdict exits non-zero naming it', (t) => {
  const r = threePrs(t);
  const out = effort(r, '--item', 'never-verified');
  assert.notEqual(out.status, 0);
  assert.match(out.out, /never-verified/);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n')[0]}`);
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

function bite(t, { file, testFile, from, to, names }) {
  const dir = mkdtempSync(join(tmpdir(), 'dwtb-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'scripts'), join(dir, 'scripts'), { recursive: true });
  const run = () => node(['--test', '--test-reporter=tap', ...(names ? [onlyTests(names)] : []), join(dir, testFile)], { cwd: dir });
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const pairs = [].concat(from).map((f, i) => [f, [].concat(to)[i]]);
  for (const [f] of pairs) assert.ok(text.includes(f), `${file} holds the line the mutation changes: ${f}`);
  const green = run();
  assert.equal(green.status, 0, green.out);
  if (names) assert.deepEqual(ranTests(green.out), [...names].sort(), 'the named tests ran');
  writeFileSync(path, pairs.reduce((s, [f, x]) => s.replace(f, x), text));
  const red = run();
  writeFileSync(path, text);
  const again = run();
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  return failing(red.out);
}

test('pr-gate.test.mjs goes red when contract() keeps status', (t) => {
  const red = bite(t, { file: 'scripts/gates/lib.mjs', testFile: 'scripts/gates/test/pr-gate.test.mjs',
    from: 'const { status, done_on, reader_effort, ...rest } = itemHead(text) ?? {};',
    to: 'const { done_on, reader_effort, ...rest } = itemHead(text) ?? {};',
    names: ['freeze gate: a status-only change passes',
      'verdict gate: a contract reworded on main and merged in after the verified sha is refused; a status-only merge passes',
      'a build PR whose first commit sets its item done passes freeze, and merges on a verdict from another session'] });
  assert.ok(red.includes('a build PR whose first commit sets its item done passes freeze, and merges on a verdict from another session'), red.join(' | '));
});

test('reader-effort.test.mjs goes red when --item takes the last merge touching the verdict', (t) => {
  const red = bite(t, { file: 'scripts/reader-effort.mjs', testFile: 'scripts/reader-effort.test.mjs',
    from: ["['log', '--merges', '--first-parent', '--reverse', '--format=%H %s', 'HEAD', '--', verdict]",
      'if (!has(cwd, sha, verdict) || has(cwd, `${sha}^1`, verdict)) continue;'],
    to: ["['log', '--merges', '--first-parent', '--format=%H %s', 'HEAD', '--', verdict]",
      'if (!has(cwd, sha, verdict)) continue;'] });
  assert.ok(red.some((n) => n.startsWith('--item reads the merge that added')), red.join(' | '));
});
}
