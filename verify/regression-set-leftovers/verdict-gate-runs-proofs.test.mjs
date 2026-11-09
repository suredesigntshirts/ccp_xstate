// verdict-gate-still-runs-proofs: the head's verdict gate (scripts/gates/pr-gate.mjs verdict), given a verdict whose
// lines name a test file under verify/, runs that file at the head: it passes when the file passes, and fails, naming
// the Expect id and the file, when the file fails. The PR is a temp repo holding the head's plan/, scripts/ and
// package.json (whose npm test runs no verify/ file), with a builder commit and a verifier commit; the named test
// leaves a marker file, so the run is seen, not inferred.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO } from './lib.mjs';

const ID = 'rsl-toy';
const BUILDER = 'https://claude.ai/code/session_rsl_builder';
const VERIFIER = 'https://claude.ai/code/session_rsl_verifier';
const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rsl', GIT_AUTHOR_EMAIL: 'rsl@x',
  GIT_COMMITTER_NAME: 'rsl', GIT_COMMITTER_EMAIL: 'rsl@x' };
const HEAD_RE = /^```json\n([\s\S]*?)\n```/;

/** The head's own item file with a new id and two Expect lines, one verifier and one world. */
function itemText() {
  const text = readFileSync(join(REPO, 'plan/items/regression-set-leftovers.md'), 'utf8');
  const head = { ...JSON.parse(text.match(HEAD_RE)[1]), id: ID, status: 'ready', expect: [
    { id: 'proof-line', check: 'The toy holds', how: 'verifier tests', proof: 'verifier' },
    { id: 'world-line', check: 'GitHub shows it', how: 'a PR', proof: 'world' },
  ] };
  delete head.done_on;
  return text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');
}

const proof = (marker, ok) => `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { writeFileSync } from 'node:fs';\n` +
  `test('toy holds', () => { writeFileSync(${JSON.stringify(marker)}, 'ran'); assert.equal(${ok ? 1 : 2}, 1); });\n`;

function gate(t, ok) {
  const dir = mkdtempSync(join(tmpdir(), `rsl-gate-${process.pid}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(repo, p), { recursive: true });
  const git = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files, session, msg) => {
    for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), c); }
    git('add', '-A');
    git('commit', '-q', '-m', `${msg}\n\nClaude-Session: ${session}`);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit({ [`plan/items/${ID}.md`]: itemText() }, 'https://claude.ai/code/session_rsl_base', 'base');
  git('checkout', '-q', '-b', `build/${ID}`);
  const built = commit({ 'src/toy.txt': 'built\n' }, BUILDER, 'build');
  const marker = join(dir, 'ran.txt');
  const file = `verify/${ID}/toy.test.mjs`;
  const verdict = { item: ID, verified_sha: built, verifier: { session: VERIFIER, model: 'm' }, results: [
    { id: 'proof-line', status: 'MET', command: `node --test ${file}`, excerpt: 'seen', test: file },
    { id: 'world-line', status: 'MET', command: 'GitHub', excerpt: 'green' },
  ] };
  commit({ [file]: proof(marker, ok), [`verify/${ID}/verdict.json`]: JSON.stringify(verdict, null, 2) }, VERIFIER, 'verdict');
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [join(repo, 'scripts/gates/pr-gate.mjs'), 'verdict'], { cwd: repo, encoding: 'utf8',
    env: { ...env, BASE_SHA: base, HEAD_SHA: '', PR_BODY: `Item: ${ID}`, PR_LABELS: '[]' } });
  const script = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).scripts.test;
  return { status: r.status, out: `${r.stdout}${r.stderr}`, ran: existsSync(marker), script, file };
}

test('verdict-gate-still-runs-proofs: a passing verify/ test the verdict names is run, and the gate passes', (t) => {
  const r = gate(t, true);
  assert.doesNotMatch(r.script, /verify\//, 'npm test in this repo runs no verify/ file');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /verdict gate passed/);
  assert.ok(r.ran, 'the named test ran');
});

test('verdict-gate-still-runs-proofs: a failing verify/ test the verdict names is run, and the gate fails naming the line and file', (t) => {
  const r = gate(t, false);
  assert.equal(r.status, 1, r.out);
  assert.ok(r.ran, 'the named test ran');
  assert.match(r.out, new RegExp(`proof-line[^\\n]*${r.file.replace(/[.]/g, '\\.')}`));
});
