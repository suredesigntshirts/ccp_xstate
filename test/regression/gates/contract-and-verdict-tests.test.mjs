// Expect: verification-contract/behaviour-lines, verification-contract/contract-change-once, verification-contract/verdict-runs-tests, verification-contract/tests-bite
// The plan check refuses a ready Expect check that pins main, a contract changes once by a written-down replan, the
// verdict gate runs the tests a verdict names, and the tests that guard these go red when the rule is broken. Every
// run is on a temp plan copy, a temp repo or a temp copy of plan/, scripts/ and test/.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;

/** The modules the checkout's ready items name. */
const liveModules = () => readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE)?.[1] ?? '{}'))
  .filter((it) => it.module && it.status === 'ready')
  .map((it) => it.module);
const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

// The phrases decision 1 lists, copied from the decision file, not from check.mjs.
const DECISION_PHRASES = ['as on main', 'as main', 'on main', 'than main', "main's", 'unchanged', 'same as',
  'byte', 'bytes', 'both shas'];

const cleanEnv = () => { const { NODE_TEST_CONTEXT, ...env } = process.env; return env; };

function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A complete ready item file, for adding to a copy of plan/: the head item's own file with a new id. */
function itemText(id, fields = {}) {
  const text = readFileSync(join(REPO, 'plan/items/verification-contract.md'), 'utf8');
  const head = { ...headOf(text), id, ...fields };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) delete head[k];
  return withHead(text, head);
}

/** A copy of plan/ lacks the rest of the tree: make an empty file at each module a ready item names. */
function makeLiveModules(dir) {
  for (const path of liveModules()) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), ''); }
}

/** A temp folder holding a copy of the checkout's plan/ at <dir>/plan. */
function tempPlan(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-plan-'));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  makeLiveModules(dir);
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    write(id, text) { writeFileSync(join(dir, 'plan/items', `${id}.md`), text); },
    check() { return node([join(dir, 'plan/check.mjs')]); },
  };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vc', GIT_AUTHOR_EMAIL: 'vc@x',
  GIT_COMMITTER_NAME: 'vc', GIT_COMMITTER_EMAIL: 'vc@x' };

/**
 * A temp git repo holding the checkout's plan/ and scripts/ (plus baseFiles) as its base commit on main, then a PR
 * branch. Commit
 * with commit(files, session); run a gate with gate(name, { body, labels }) from the branch tip.
 */
function gateRepo(t, branch, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  makeLiveModules(dir);
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  const write = (files) => { for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
  } };
  const commit = (files, session, msg = 'commit') => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', `${msg}\n\nClaude-Session: ${session}`);
    return git('rev-parse', 'HEAD');
  };
  const base = commit(baseFiles, 'https://claude.ai/code/session_vc_base', 'base');
  git('checkout', '-q', '-b', branch);
  return {
    dir, base, git, commit,
    gate(name, { body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), name], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

{
const ID = 'vfy-pins';
const withCheck = (status, check) => itemText(ID, {
  status,
  ...(status === 'done' ? { done_on: '2026-11-01' } : {}),
  expect: [
    { id: 'clean-line', check: 'The plan check refuses the copy; plan/README.md says why', how: 'run it', proof: 'verifier' },
    { id: 'pinned-line', check, how: 'run it', proof: 'verifier' },
    { id: 'world-line', check: 'A PR on GitHub shows the refusal', how: 'GitHub', proof: 'world' },
  ],
});

test('the untouched copy of the head plan passes', (t) => {
  const r = tempPlan(t).check();
  assert.equal(r.status, 0, r.out);
});

for (const phrase of DECISION_PHRASES) {
  for (const status of ['ready']) {
    test(`a ${status} item whose check says "${phrase}" is refused, naming item, Expect id and phrase`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `Every stage renders ${phrase} the record`));
      const r = p.check();
      assert.equal(r.status, 1, r.out);
      const line = r.out.split('\n').find((l) => l.includes(`${ID}.md`) && l.includes('pinned-line'));
      assert.ok(line, r.out);
      assert.ok(line.toLowerCase().includes(phrase), line);
      assert.ok(!r.out.includes('clean-line'), r.out);
    });
  }
  for (const status of ['draft', 'done']) {
    test(`a ${status} item whose check says "${phrase}" passes`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `Every stage renders ${phrase} the record`));
      const r = p.check();
      assert.equal(r.status, 0, r.out);
    });
  }
}

test('the phrase match ignores case', (t) => {
  const p = tempPlan(t);
  p.write(ID, withCheck('ready', 'The page renders to MAIN\'S output'));
  const r = p.check();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /pinned-line/);
});

for (const [label, sha] of [['7-digit', 'a575897'], ['40-digit', '25dddc9d60b3658e97d46ca9b8981630b73712bd']]) {
  for (const status of ['ready']) {
    test(`a ${status} item whose check holds a ${label} sha is refused, naming the item and Expect id`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `The suite passes at ${sha} and at the head`));
      const r = p.check();
      assert.equal(r.status, 1, r.out);
      const line = r.out.split('\n').find((l) => l.includes(`${ID}.md`) && l.includes('pinned-line'));
      assert.ok(line && line.includes(sha), r.out);
    });
  }
  for (const status of ['draft', 'done']) {
    test(`a ${status} item whose check holds a ${label} sha passes`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `The suite passes at ${sha} and at the head`));
      assert.equal(p.check().status, 0);
    });
  }
}

test('a ready check that names repo paths and no listed phrase passes', (t) => {
  const p = tempPlan(t);
  p.write(ID, withCheck('ready', 'plan/README.md and docs/gates.md state the rule; scripts/gates/lib.mjs refuses a verdict with no test, at the head'));
  const r = p.check();
  assert.equal(r.status, 0, r.out);
});
}

{
const ID = 'vfy-frozen';
const BRANCH = 'replan/vfy-frozen-contract';
const SECTION = '\n## Contract change\n\nThe build tried one shape, compared it with another, and the contract moved to say so.\n';
const before = itemText(ID, { status: 'done' });
const changedExpect = (fields = {}) => {
  const head = headOf(before);
  return itemText(ID, { status: 'done', expect: [...head.expect, { id: 'added-line', check: 'The gate refuses a second change',
    how: 'run it', proof: 'verifier' }], ...fields });
};
const plan = (repo) => node([join(repo.dir, 'plan/check.mjs')]);
const replan = { labels: ['replan'] };

test('a replan with contract_changes 1 and a Contract change section passes the freeze gate and the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', replan);
  assert.equal(f.status, 0, f.out);
  const p = plan(repo);
  assert.equal(p.status, 0, p.out);
});

test('the same change without the replan label is refused by the freeze gate', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', { labels: [] });
  assert.equal(f.status, 1, f.out);
  assert.match(f.out, new RegExp(ID));
});

test('contract_changes 2 is refused by the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 2 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const p = plan(repo);
  assert.equal(p.status, 1, p.out);
  assert.match(p.out, new RegExp(`${ID}[^\\n]*contract_changes`));
});

test('contract_changes 1 with no Contract change section is refused by the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) }, 'https://claude.ai/code/session_vc_replan');
  const p = plan(repo);
  assert.equal(p.status, 1, p.out);
  assert.match(p.out, new RegExp(`${ID}[^\\n]*Contract change`));
});

for (const where of ['base', 'head']) {
  test(`a replan-labelled plan-only change to an item whose verdict file exists at the ${where} is refused by the freeze gate, naming the item and the file`, (t) => {
    const verdict = { [`verify/${ID}/verdict.json`]: '{}\n' };
    const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before, ...(where === 'base' ? verdict : {}) });
    repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION, ...(where === 'head' ? verdict : {}) },
      'https://claude.ai/code/session_vc_replan');
    const f = repo.gate('freeze', replan);
    assert.equal(f.status, 1, f.out);
    assert.match(f.out, new RegExp(`${ID}[^\\n]*verify/${ID}/verdict\\.json`));
  });
}

test('a status and done_on change to an item with a verdict file passes the freeze gate', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before, [`verify/${ID}/verdict.json`]: '{}\n' });
  repo.commit({ [`plan/items/${ID}.md`]: itemText(ID, { status: 'done', done_on: '2026-11-08' }) }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', replan);
  assert.equal(f.status, 0, f.out);
});
}

{
const ID = 'vfy-toy';
const BUILDER = 'https://claude.ai/code/session_vc_builder';
const VERIFIER = 'https://claude.ai/code/session_vc_verifier';
const expect = [
  { id: 'v-line', check: 'The toy does its thing', how: 'verifier tests', proof: 'verifier' },
  { id: 'b-line', check: 'The builder tests bite', how: 'break and run', proof: 'builder' },
  { id: 'w-line', check: 'GitHub shows it', how: 'a PR', proof: 'world' },
];
const TESTS = {
  [`verify/${ID}/pass.test.mjs`]: "import test from 'node:test';\ntest('toy holds', () => {});\ntest('bite holds', () => {});\n",
  [`verify/${ID}/fail.test.mjs`]: "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('toy holds', () => { assert.equal(1, 2); });\n",
  [`verify/${ID}/crash.test.mjs`]: "import test from 'node:test';\ntest('toy holds', () => {});\nprocess.exit(3);\n",
};

/** A repo whose PR branch has one builder commit and one verifier commit with the given verdict results. */
function pr(t, results, extra = {}) {
  const repo = gateRepo(t, `build/${ID}`, { [`plan/items/${ID}.md`]: itemText(ID, { expect }) });
  const built = repo.commit({ 'src/toy.txt': 'built\n' }, BUILDER, 'build');
  const verdict = { item: ID, verified_sha: built, verifier: { session: VERIFIER, model: 'm' }, results, ...extra };
  repo.commit({ ...TESTS, [`verify/${ID}/verdict.json`]: JSON.stringify(verdict, null, 2) }, VERIFIER, 'verdict');
  return { run: () => repo.gate('verdict', { body: `Item: ${ID}` }) };
}

const res = (id, more = {}) => ({ id, status: 'MET', command: 'cmd', excerpt: 'seen', ...more });
const good = (vTest = `verify/${ID}/pass.test.mjs`, more = {}) => [
  res('v-line', vTest === null ? {} : { test: vTest, ...more }),
  res('b-line', { test: `verify/${ID}/pass.test.mjs`, test_name: 'bite holds', mutation: 'broke it', red_test: 'went red' }),
  res('w-line'),
];

for (const obs of [undefined, ['a naming concern']]) {
  const tag = obs ? 'with observations' : 'without observations';

  test(`passes a verdict whose named tests pass, the world line naming none (${tag})`, (t) => {
    const r = pr(t, good(), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /verdict gate passed/);
  });

  test(`refuses a result whose named test fails by assertion, naming the Expect id and the test (${tag})`, (t) => {
    const r = pr(t, good(`verify/${ID}/fail.test.mjs`), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line[^\n]*fail\.test\.mjs/);
  });

  test(`refuses a result whose named test exits non-zero without an assertion (${tag})`, (t) => {
    const r = pr(t, good(`verify/${ID}/crash.test.mjs`), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line[^\n]*crash\.test\.mjs/);
  });

  test(`refuses a verifier result that names no test (${tag})`, (t) => {
    const r = pr(t, good(null), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line/);
  });
}

test('refuses a builder result that names no test', (t) => {
  const results = good();
  delete results[1].test; delete results[1].test_name;
  const r = pr(t, results).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /b-line/);
});

test('refuses a named test file that does not exist at the head', (t) => {
  const r = pr(t, good(`verify/${ID}/nope.test.mjs`)).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line[^\n]*nope\.test\.mjs/);
});

test('refuses a test path outside verify/<item>/', (t) => {
  const r = pr(t, good('scripts/gates/lib.mjs')).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line/);
});

test('refuses a test_name that matches no test in the file', (t) => {
  const r = pr(t, good(`verify/${ID}/pass.test.mjs`, { test_name: 'no such test' })).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line/);
});
}

{
function copy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'test/plan-check.test.mjs', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  makeLiveModules(dir);
  return dir;
}
function mutate(dir, file, from, to) {
  const p = join(dir, file);
  const text = readFileSync(p, 'utf8');
  assert.ok(from.test(text), `${file} has the code to break`);
  writeFileSync(p, text.replace(from, to));
  return () => writeFileSync(p, text);
}
const run = (dir, file) => node(['--test', '--test-reporter=tap', join(dir, file)], { cwd: dir });
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'test/plan-check.test.mjs goes red when the deny-list in check.mjs is emptied',
    test: 'test/plan-check.test.mjs', code: 'plan/check.mjs', from: /const PINS = \[[^\]]*\]/, to: 'const PINS = []' },
  { name: 'scripts/gates/test/lib.test.mjs goes red when checkVerdict stops requiring test',
    test: 'scripts/gates/test/lib.test.mjs', code: 'scripts/gates/lib.mjs', from: /if \(TESTED\.includes\(e\.proof\)\) \{/, to: 'if (false) {' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = copy(t);
    const green = run(dir, b.test);
    assert.equal(green.status, 0, green.out);
    const restore = mutate(dir, b.code, b.from, b.to);
    const red = run(dir, b.test);
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    restore();
    const again = run(dir, b.test);
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}
}
