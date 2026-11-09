// Expect: evidence-gate-edges/link-refused, evidence-gate-edges/listing-refused, evidence-gate-edges/tests-bite
// The evidence gate refuses a symlink or submodule under verify/ and a saved test listing, and passes a short evidence
// excerpt; the gate tests that guard it go red when the rule is broken. Every listing is made at run time in a temp repo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const read = (p) => readFileSync(join(REPO, p), 'utf8');
const KB = 1024;

const cleanEnv = () => { const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, ...env } = process.env; return env; };

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'ege', GIT_AUTHOR_EMAIL: 'ege@x',
  GIT_COMMITTER_NAME: 'ege', GIT_COMMITTER_EMAIL: 'ege@x' };

function tempDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's scripts/ and package.json plus baseFiles.
 * branch(name) starts a PR-shaped branch from the base; commit(files, links) writes files (null deletes) and symlinks
 * (path -> target) and commits; evidence() runs the evidence gate from the branch tip with BASE_SHA set to the base.
 */
function gateRepo(t, baseFiles = {}) {
  const dir = tempDir(t, 'ege-gate-');
  for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, links = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    for (const [p, target] of Object.entries(links)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      symlinkSync(target, join(dir, p));
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, {}, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    evidence() {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), 'evidence'], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: 'build/ege-case', PR_BODY: '', PR_LABELS: '[]' } });
    },
  };
}

/** Real node:test output of a file with n passing tests: piped with no reporter (TAP), or with the named reporter. */
function listing(t, n, reporter) {
  const dir = tempDir(t, 'ege-listing-');
  const body = ["import test from 'node:test';"];
  for (let i = 1; i <= n; i++) body.push(`test('case ${i}', () => {});`);
  writeFileSync(join(dir, 'ten.test.mjs'), body.join('\n') + '\n');
  const r = node(['--test', ...(reporter ? [`--test-reporter=${reporter}`] : []), 'ten.test.mjs'], { cwd: dir });
  if (r.status !== 0) throw new Error(r.out);
  return r.stdout;
}

{
const BIG = 'x'.repeat(100 * KB);

for (const [name, target] of [['a 100 KB file outside verify/', '../../../data/big.bin'], ['a small file', '../../../data/small.txt']]) {
  test(`a symlink under verify/ to ${name} is refused, naming the path and "symlink"`, (t) => {
    const r = gateRepo(t, { 'data/big.bin': BIG, 'data/small.txt': 'hi\n' });
    r.branch('pr');
    r.commit({}, { 'verify/x/evidence/a.md': target });
    assert.equal(r.git('ls-tree', 'HEAD', '--', 'verify/x/evidence/a.md').split(/\s/)[0], '120000', 'committed as a symlink');
    const out = r.evidence();
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /verify\/x\/evidence\/a\.md is a symlink/);
    t.diagnostic(out.out.trim().split('\n').find((l) => l.includes('a.md')));
  });
}

test('a submodule entry under verify/ is refused, naming the path and "submodule"', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.git('update-index', '--add', '--cacheinfo', `160000,${r.base},verify/x/sub`);
  r.git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'submodule');
  assert.equal(r.git('ls-tree', 'HEAD', '--', 'verify/x/sub').split(/\s/)[0], '160000');
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/sub is a submodule/);
  t.diagnostic(out.out.trim().split('\n').find((l) => l.includes('verify/x/sub')));
});

test('a regular small evidence file under verify/ passes', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/evidence/a.md': 'Command: node --test x\nExcerpt: 3 pass\n' });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});
}

{
const PATH = 'verify/x/evidence/listing.txt';

for (const [form, reporter] of [['TAP (piped)', undefined], ['spec reporter', 'spec']]) {
  test(`a ten-test node:test listing in ${form} saved as listing.txt is refused as a test listing`, (t) => {
    const text = listing(t, 10, reporter);
    assert.ok(text.length < 64 * KB, `${text.length} bytes, under the size limit`);
    const r = gateRepo(t);
    r.branch('pr');
    r.commit({ [PATH]: text });
    const out = r.evidence();
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /verify\/x\/evidence\/listing\.txt is a test listing/);
    t.diagnostic(`${text.length} bytes: ${out.out.trim().split('\n').find((l) => l.includes('listing.txt'))}`);
  });
}

// An excerpt as the brief asks for: the command, four result lines cut from a real TAP run, and its summary.
function excerpt(t) {
  const lines = listing(t, 10).split('\n');
  const results = lines.filter((l) => /^ok \d+ /.test(l)).slice(0, 4);
  const summary = lines.filter((l) => /^# (tests|pass|fail) \d+/.test(l));
  assert.equal(results.length, 4);
  assert.equal(summary.length, 3);
  return ['# Evidence', '', 'Command: `node --test ten.test.mjs`', '', '```', ...results, '...', ...summary, '```', ''].join('\n');
}

test('an evidence .md with a command, four result lines and the pass and fail summary passes', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/evidence/listing-refused.md': excerpt(t) });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});

test('a file over 64 KB and a *.pass file under verify/ are still refused', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/capture.json': 'y'.repeat(64 * KB + 1), 'verify/x/notes.pass': 'one line\n' });
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/capture\.json is 65537 bytes, over the 65536-byte limit/);
  assert.match(out.out, /verify\/x\/notes\.pass is a test listing/);
});

test('a branch deleting a listing committed at the base is never read and passes', (t) => {
  const r = gateRepo(t, { [PATH]: listing(t, 12) });
  r.branch('pr');
  r.commit({ [PATH]: null });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing a symlink mode',
    file: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: /if \(!REGULAR\.has\(mode\)\)/, to: 'if (false)' },
  { name: 'lib.test.mjs goes red when isListing always answers false',
    file: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: /return has\('pass'\) && has\('fail'\) && results >= LISTING_LINES;/, to: 'return false;' },
  { name: 'pr-gate.test.mjs goes red when the evidence gate stops passing the mode from git ls-tree',
    file: 'scripts/gates/pr-gate.mjs', test: 'scripts/gates/test/pr-gate.test.mjs',
    from: /const mode = git\('ls-tree', head, '--', path\)\.split\(\/\\s\/\)\[0\];/, to: 'const mode = undefined;' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = tempDir(t, 'ege-bite-');
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const run = () => node(['--test', '--test-reporter=tap', join(dir, b.test)], { cwd: dir });
    const green = run();
    assert.equal(green.status, 0, green.out);
    const p = join(dir, b.file);
    const text = readFileSync(p, 'utf8');
    assert.match(text, b.from, `the rule to break is in ${b.file}`);
    writeFileSync(p, text.replace(b.from, b.to));
    const red = run();
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    writeFileSync(p, text);
    const again = run();
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}
}
