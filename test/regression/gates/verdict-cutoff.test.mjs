// Expect: verdict-cutoff-at-verified-sha/cutoff-refused, verdict-cutoff-at-verified-sha/done-on-held, verdict-cutoff-at-verified-sha/tests-bite
// The verdict gate judges a verdict against the item's contract at verified_sha, the freeze gate holds a set done_on,
// and the gate tests that guard both go red when the rule they guard is broken. Every gate run is in a temp repo
// holding a copy of scripts/gates/; every mutation is in a temp copy of scripts/.
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

const cleanEnv = () => {
  return childEnv({ drop: ['BASE_SHA', 'HEAD_SHA', 'PR_BODY', 'PR_LABELS', 'PR_BRANCH'] });
};

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vcv', GIT_AUTHOR_EMAIL: 'vcv@x',
  GIT_COMMITTER_NAME: 'vcv', GIT_COMMITTER_EMAIL: 'vcv@x' };

const BUILDER = 'Claude-Session: https://claude.ai/code/session_builder';
const VERIFIER = 'Claude-Session: https://claude.ai/code/session_verifier';

/**
 * An item file: a JSON head (pretty-printed, so each field sits on its own lines) and a Verifier brief.
 * Fields far apart in the file merge without conflict.
 */
function itemText({ id = 'x', status = 'ready', done_on, check = 'the thing holds', brief = 'Run the test.',
  extra = '' } = {}) {
  const head = { id, title: `Item ${id}`, status, ...(done_on ? { done_on } : {}), outcome: `${id} works`,
    expect: [{ id: 'e1', check, how: 'a test', proof: 'verifier' }] };
  return `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n\n## What this is\n\nAn item for a gate test.\n${extra}\n## Verifier brief\n\n${brief}\n`;
}

/** A temp git repo on main holding a copy of the checkout's scripts/gates/ plus baseFiles (path -> text, null deletes). */
function tempRepo(t, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vcv-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'scripts/gates'), join(dir, 'scripts/gates'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  const gate = (which, env) => node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env });
  return { dir, base, git, commit, gate };
}

const PASSING_TEST = "import test from 'node:test';\ntest('x holds', () => {});\n";

{
const verdictJson = (verified) => JSON.stringify({
  item: 'x', verified_sha: verified, verifier: { session: 'https://claude.ai/code/session_verifier' },
  results: [{ id: 'e1', status: 'MET', command: 'node --test verify/x/pass.test.mjs', excerpt: '1/1 pass',
    test: 'verify/x/pass.test.mjs' }],
}, null, 2);

/**
 * base: item x ready (unless withItem is false) and another plan file; build/x: status done, a source change and a
 * passing test from the builder (verified_sha), then verdict.json from another session. side(files) branches from
 * the base, commits files, merges into build/x (their side wins a conflict) and runs the verdict gate as main would.
 */
function world(t, { withItem = true } = {}) {
  const r = tempRepo(t, { ...(withItem ? { 'plan/items/x.md': itemText() } : {}), 'plan/items/other.md': itemText({ id: 'other' }),
    'src/a.js': 'export const a = 1;\n' });
  r.git('checkout', '-q', '-b', 'build/x');
  const verified = r.commit({ ...(withItem ? { 'plan/items/x.md': itemText({ status: 'done' }) } : {}),
    'src/a.js': 'export const a = 2;\n', 'verify/x/pass.test.mjs': PASSING_TEST }, `build x\n\n${BUILDER}`);
  r.commit({ 'verify/x/verdict.json': verdictJson(verified) }, `verify x\n\n${VERIFIER}`);
  return {
    ...r, verified,
    side(files) {
      r.git('checkout', '-q', '-b', `side-${Math.random().toString(36).slice(2)}`, r.base);
      const tip = r.commit(files, 'side');
      r.git('checkout', '-q', 'build/x');
      r.git('merge', '-q', '--no-edit', '-X', 'theirs', tip);
      const merge = r.git('rev-parse', 'HEAD');
      return r.gate('verdict', { BASE_SHA: tip, HEAD_SHA: merge, PR_BODY: 'Item: x', PR_LABELS: '[]' });
    },
  };
}

test('control: the verdict passes at the build tip with no side merge', (t) => {
  const w = world(t);
  const r = w.gate('verdict', { BASE_SHA: w.base, HEAD_SHA: '', PR_BODY: 'Item: x', PR_LABELS: '[]' });
  assert.equal(r.status, 0, r.out);
});

test('a merged side branch that rewords an Expect check: exit 1, names x and expect', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ check: 'a reworded thing holds' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /contract of x moved/);
  assert.match(r.out, /\bexpect\b/);
  assert.match(r.out, new RegExp(w.verified.slice(0, 7)));
});

test('a merged side branch that rewords the Verifier brief: exit 1, names Verifier brief', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ brief: 'Run a different test.' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /contract of x moved[^\n]*Verifier brief/);
  assert.doesNotMatch(r.out, /\(expect/);
});

test('a merged side branch that changes only status: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ status: 'done' }) });
  assert.equal(r.status, 0, r.out);
  assert.match(w.git('show', 'HEAD:plan/items/x.md'), /"status": "done"/, 'the status change reached the head');
});

test('a merged side branch that changes only done_on: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ done_on: '2026-11-08' }) });
  assert.equal(r.status, 0, r.out);
  assert.match(w.git('show', 'HEAD:plan/items/x.md'), /"done_on": "2026-11-08"/, 'the done_on change reached the head');
});

test('a merged side branch that changes only another plan file: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/other.md': itemText({ id: 'other', check: 'reworded other' }), 'plan/notes.md': 'a note\n' });
  assert.equal(r.status, 0, r.out);
});

test('a verdict whose verified_sha predates the item file: exit 1', (t) => {
  const w = world(t, { withItem: false });
  const r = w.side({ 'plan/items/x.md': itemText({ status: 'done' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /plan\/items\/x\.md does not exist at the verified sha/);
});
}

{
const WAS = '2026-11-01', NOW = '2026-11-05';
const WHY = '\n## Done on change\n\nThe merge landed on 2026-11-05; 2026-11-01 was the replan date.\n';

/** base: item y done on WAS, item z ready with no date, a source file. pr(files, labels) runs freeze on a PR branch. */
function world(t, { yExtra = '' } = {}) {
  const r = tempRepo(t, {
    'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: WAS, extra: yExtra }),
    'plan/items/z.md': itemText({ id: 'z', status: 'ready' }),
    'src/a.js': 'export const a = 1;\n',
  });
  let n = 0;
  return {
    ...r,
    pr(files, labels) {
      r.git('checkout', '-q', '-b', `pr-${n++}`, r.base);
      r.commit(files, 'pr');
      return r.gate('freeze', { BASE_SHA: r.base, HEAD_SHA: '', PR_BODY: '', PR_LABELS: JSON.stringify(labels) });
    },
  };
}

const refusedNaming = (r, now) => {
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, new RegExp(`done_on of y from ${WAS} to ${now.replace(/[()]/g, '\\$&')}`));
};

test('date changed with no replan label: exit 1, names y and both dates', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW }) }, []);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('replan label with a file outside plan/, even with a Done on change section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }),
    'src/a.js': 'export const a = 2;\n' }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
  assert.match(r.out, /src\/a\.js/);
});

test('plan-only replan with no Done on change section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('plan-only replan that removes done_on without the section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done' }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, '(none)');
});

test('plan-only replan whose base already has the section and that does not rewrite it: exit 1', (t) => {
  const r = world(t, { yExtra: WHY }).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('plan-only replan whose item gains a Done on change section: exit 0', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }) }, ['replan']);
  assert.equal(r.status, 0, r.out);
});

test('plan-only replan that rewrites an existing Done on change section: exit 0', (t) => {
  const r = world(t, { yExtra: WHY }).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW,
    extra: `${WHY}A second move: the release date is the one the fix budget counts.\n` }) }, ['replan']);
  assert.equal(r.status, 0, r.out);
});

test('any PR that sets done_on on an item that had none: exit 0', (t) => {
  const w = world(t);
  const plain = w.pr({ 'plan/items/z.md': itemText({ id: 'z', status: 'done', done_on: NOW }) }, []);
  assert.equal(plain.status, 0, plain.out);
  const replan = w.pr({ 'plan/items/z.md': itemText({ id: 'z', status: 'done', done_on: NOW }) }, ['replan']);
  assert.equal(replan.status, 0, replan.out);
});
}

{
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when contractMoves stops reporting a changed Verifier brief',
    code: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: "return a.brief === b.brief ? moved : [...moved, 'Verifier brief'];", to: 'return moved;' },
  { name: 'lib.test.mjs goes red when checkDoneOn stops refusing a moved date',
    code: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: 'if (was === undefined || was === now) continue;', to: 'continue;' },
  { name: 'pr-gate.test.mjs goes red when the verdict gate stops reading the item at verified_sha',
    code: 'scripts/gates/pr-gate.mjs', test: 'scripts/gates/test/pr-gate.test.mjs',
    from: 'before: show(verified, itemFile)', to: 'before: show(head, itemFile)',
    names: ['verdict gate: a contract reworded on main and merged in after the verified sha is refused; a status-only merge passes', 'verdict gate: a verdict whose verified sha has no item file is refused'] },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'vcv-bite-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const run = () => node(['--test', '--test-reporter=tap', ...(b.names ? [onlyTests(b.names)] : []), join(dir, b.test)], { cwd: dir });
    const green = run();
    assert.equal(green.status, 0, green.out);
    if (b.names) assert.deepEqual(ranTests(green.out), [...b.names].sort(), 'the named tests ran');
    const p = join(dir, b.code);
    const text = readFileSync(p, 'utf8');
    assert.ok(text.includes(b.from), `the rule to break is in ${b.code}`);
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
