// Expect: verify-evidence-policy/evidence-refused, verify-evidence-policy/tests-bite
// The evidence gate, run as a PR would run it, refuses a large or .pass file a PR adds or grows under verify/ and passes
// the rest; the gate tests that guard it go red when the rule is broken. Every run is in a temp repo or a temp copy.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { childEnv } from '../lib.mjs';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const KB64 = 64 * 1024;

const cleanEnv = () => childEnv({ drop: ['BASE_SHA', 'HEAD_SHA'] });

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vep', GIT_AUTHOR_EMAIL: 'vep@x',
  GIT_COMMITTER_NAME: 'vep', GIT_COMMITTER_EMAIL: 'vep@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's plan/, scripts/ and package.json plus
 * baseFiles (a path mapped to its content; null deletes). branch(name) starts a PR-shaped branch from the base;
 * commit(files) commits on it; evidence() runs the evidence gate from the branch tip with BASE_SHA set to the base.
 */
function gateRepo(t, baseFiles = {}, { copy = ['plan', 'scripts', 'package.json'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vep-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of copy) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (files) => { for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
  } };
  const commit = (files, msg = 'commit') => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    evidence() {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), 'evidence'], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: 'build/vep-case', PR_BODY: '', PR_LABELS: '[]' } });
    },
  };
}

{
const BASE = { 'verify/x/notes.md': 'small notes\n', 'verify/old/big.json': 'b'.repeat(200 * 1024),
  'verify/old/suite.pass': 'ok 1 - a\n' };

const CASES = [
  { name: 'adds a 70 KB file under verify/x/', files: { 'verify/x/capture.json': 'c'.repeat(70 * 1024) },
    status: 1, says: [/verify\/x\/capture\.json/, new RegExp(String(70 * 1024))] },
  { name: 'adds a one-line verify/x/listing.pass', files: { 'verify/x/listing.pass': 'ok 1 - a\n' },
    status: 1, says: [/verify\/x\/listing\.pass/] },
  { name: 'grows verify/x/notes.md past 64 KB', files: { 'verify/x/notes.md': 'n'.repeat(KB64 + 1) },
    status: 1, says: [/verify\/x\/notes\.md/, new RegExp(String(KB64 + 1))] },
  { name: 'adds a file of exactly 64 KB under verify/x/evidence/', files: { 'verify/x/evidence/a.md': 'e'.repeat(KB64) },
    status: 0 },
  { name: 'adds a 200 KB file under docs/', files: { 'docs/huge.md': 'd'.repeat(200 * 1024) }, status: 0 },
  { name: 'deletes a large and a .pass file committed at the base',
    files: { 'verify/old/big.json': null, 'verify/old/suite.pass': null }, status: 0 },
];

for (const c of CASES) {
  test(`evidence gate on a PR that ${c.name} exits ${c.status}`, (t) => {
    const r = gateRepo(t, BASE);
    r.branch('build/vep-case');
    r.commit(c.files, c.name);
    const out = r.evidence();
    assert.equal(out.status, c.status, out.out);
    for (const re of c.says ?? []) assert.match(out.out, re);
    t.diagnostic(`exit ${out.status}: ${out.out.trim().replace(/\s+/g, ' ').slice(0, 300)}`);
  });
}

test('a PR that renames a small file under verify/ into a .pass name is refused', (t) => {
  const r = gateRepo(t, BASE);
  r.branch('build/vep-case');
  r.git('mv', 'verify/x/notes.md', 'verify/x/notes.pass');
  r.git('commit', '-q', '-m', 'rename');
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/notes\.pass/);
});

test('both refusals in one PR are each named', (t) => {
  const r = gateRepo(t, BASE);
  r.branch('build/vep-case');
  r.commit({ 'verify/x/listing.pass': 'ok\n', 'verify/x/big.txt': 'z'.repeat(70 * 1024) });
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/listing\.pass/);
  assert.match(out.out, /verify\/x\/big\.txt/);
});
}

{
const TEST = 'scripts/gates/test/lib.test.mjs';
const CODE = 'scripts/gates/lib.mjs';
const run = (dir) => node(['--test', '--test-reporter=tap', join(dir, TEST)], { cwd: dir });
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing files over the limit',
    from: /if \(size > EVIDENCE_LIMIT\)/, to: 'if (false)' },
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing .pass files',
    from: /if \(path\.endsWith\('\.pass'\)\)/, to: 'if (false)' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'vep-bite-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const green = run(dir);
    assert.equal(green.status, 0, green.out);
    const p = join(dir, CODE);
    const text = readFileSync(p, 'utf8');
    assert.match(text, b.from, 'the rule to break is in checkEvidence');
    writeFileSync(p, text.replace(b.from, b.to));
    const red = run(dir);
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    writeFileSync(p, text);
    const again = run(dir);
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}
}
