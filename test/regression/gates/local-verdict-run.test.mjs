// Expect: verifier-reader-gaps/done-on-when-module, verifier-reader-gaps/local-gate-run, verifier-reader-gaps/world-needs-no-test
// The plan check refuses a done item naming a module without done_on; the local verdict-gate command docs/gates.md
// gives, run by a shell on a temp build branch, passes a complete verdict and refuses with no Item line; the verdict
// gate passes a world result with no test. Every run is on a temp plan copy or in a temp repo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { childEnv } from '../lib.mjs';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const ITEM = 'verifier-reader-gaps';
const read = (p) => readFileSync(join(REPO, p), 'utf8');

function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
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

// The environment a gate or plan run inherits, without anything a CI job or an outer node --test sets.
const cleanEnv = () => {
  return childEnv({ drop: ['BASE_SHA', 'HEAD_SHA', 'PR_BRANCH', 'PR_BODY', 'PR_LABELS'] });
};
function run(cmd, args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env }, maxBuffer: 64 << 20,
    timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const node = (args, opts) => run(process.execPath, args, opts);

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vrg',
  GIT_AUTHOR_EMAIL: 'vrg@x', GIT_COMMITTER_NAME: 'vrg', GIT_COMMITTER_EMAIL: 'vrg@x' };

/**
 * A temp git repo whose main holds a copy of the checkout's plan/, scripts/ and package.json. commit(files, msg)
 * writes files (null deletes) and commits; git(...) runs git in it.
 */
function tempRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vrg-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
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
  commit({}, 'base');
  return { dir, git, commit, file: (p) => readFileSync(join(dir, p), 'utf8') };
}

/** A temp copy of the checkout's plan/, with the module of each ready item made as an empty file. */
function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vrg-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  const items = join(REPO, 'plan/items');
  for (const f of execFileSync('ls', [items], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.md'))) {
    if (f === 'README.md') continue;
    const m = readFileSync(join(items, f), 'utf8').match(/^```json\n([\s\S]*?)\n```/);
    if (!m) continue;
    const h = JSON.parse(m[1]);
    if (h.status === 'ready' && h.module && !existsSync(join(dir, h.module))) {
      mkdirSync(dirname(join(dir, h.module)), { recursive: true });
      writeFileSync(join(dir, h.module), '');
    }
  }
  return { dir, check: () => node([join(dir, 'plan/check.mjs')], { cwd: dir }) };
}

// Helpers for the tests below.
const TOY = 'vrg-toy';
const WORLD_RESULT = { id: 'shown', status: 'MET', command: 'pull_request_read get_check_runs',
  excerpt: 'ci green at verified_sha' };

function buildWithVerdict(t, { world = WORLD_RESULT } = {}) {
  const r = tempRepo(t);
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const toy = { ...head, id: TOY, status: 'done', depends_on: [],
    expect: [
      { id: 'shown', check: 'The PR\'s checks are green at the head sha', how: 'The checks run on GitHub', proof: 'world' },
      { id: 'tested', check: 'A test passes', how: 'The verifier\'s own test', proof: 'verifier' },
    ] };
  r.commit({ [`plan/items/${TOY}.md`]: joinItem(toy, rest) }, 'base: toy item');
  r.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  r.git('checkout', '-q', '-b', `build/${TOY}`);
  const built = r.commit({ 'docs/vrg.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  const verified = r.commit({
    [`verify/${TOY}/ok.test.mjs`]: "import test from 'node:test';\ntest('holds', () => {});\n",
    [`verify/${TOY}/verdict.json`]: JSON.stringify({ item: TOY, verified_sha: built,
      verifier: { session: 's-verify', model: 'm' },
      results: [world, { id: 'tested', status: 'MET', command: 'node --test', excerpt: '1 pass',
        test: `verify/${TOY}/ok.test.mjs` }] }, null, 2),
  }, 'verify: toy\n\nClaude-Session: s-verify');
  return { ...r, built, verified };
}

{

test('the plan check passes a done item without module or done_on, and refuses one naming a module without done_on', (t) => {
  const p = planCopy(t);
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const { module, done_on, ...bare } = head;
  const write = (h) => writeFileSync(join(p.dir, 'plan/items', `vrg-done.md`), joinItem({ ...h, id: 'vrg-done' }, rest));

  write({ ...bare, status: 'done' });
  const plain = p.check();
  t.diagnostic(`no module, no done_on: ${plain.out.trim().split('\n').at(-1)}`);
  assert.equal(plain.status, 0, plain.out);

  write({ ...bare, status: 'done', module: 'docs/gates.md' });
  const refused = p.check();
  t.diagnostic(`module, no done_on: ${refused.out.trim()}`);
  assert.equal(refused.status, 1, refused.out);
  assert.match(refused.out, /vrg-done.*a done item that names a module needs done_on/);

  write({ ...bare, status: 'done', module: 'docs/gates.md', done_on: '2026-11-08' });
  const dated = p.check();
  assert.equal(dated.status, 0, dated.out);
});
}

{
const gates = read('docs/gates.md');
const commands = [...gates.matchAll(/`([^`]*pr-gate\.mjs verdict[^`]*)`/g)].map((m) => m[1]);

test('the command as written passes a build branch with a complete verdict, and refuses with PR_BODY unset', (t) => {
  const r = buildWithVerdict(t);
  const cmd = commands[0].replaceAll('<id>', TOY);
  const ok = run('sh', ['-c', cmd], { cwd: r.dir });
  t.diagnostic(`${cmd}\n${ok.out.trim()}`);
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, new RegExp(`verdict gate passed \\(item ${TOY}\\)`));

  const unset = run('sh', ['-c', cmd.replace(/PR_BODY='[^']*'\s*/, '')], { cwd: r.dir });
  t.diagnostic(unset.out.trim());
  assert.equal(unset.status, 1, unset.out);
  assert.match(unset.out, /names no item/);
});
}

{
const gate = (r) => node(['scripts/gates/pr-gate.mjs', 'verdict'], { cwd: r.dir,
  env: { BASE_SHA: 'origin/main', PR_BODY: `Item: ${TOY}` } });

test('the gate passes a verdict whose world result names no test', (t) => {
  const r = buildWithVerdict(t);
  const v = JSON.parse(r.file(`verify/${TOY}/verdict.json`));
  assert.equal('test' in v.results.find((x) => x.id === 'shown'), false);
  const out = gate(r);
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
});

test('the same fixture is refused when the world result is not complete, so the pass above is the gate judging it', (t) => {
  const r = buildWithVerdict(t, { world: { ...WORLD_RESULT, excerpt: '' } });
  const out = gate(r);
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /shown/);
});
}
