// Expect: stage-contract-declares-rules/marks-checked, stage-contract-declares-rules/declared-rules-hold
// A workflow's meta.marks: the load check refuses marks that do not name what the output holds, naming the stage and the
// path; and through the real loader and hooks in the tourney world, the marks decide what is stored as a brief, which
// field is a verdict and what value passes, and how each ref is checked, whatever the stage is named and whatever words
// the verdict uses.
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const WORKFLOWS = ['quick-fix', 'research', 'intake', 'feature'];

// Commits made by the fake worlds get the same shas at both checkouts: fixed dates, no signing, no global config.
function fixGit() {
  Object.assign(process.env, {
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1'
  });
}

const imp = (repo, p) => import(pathToFileURL(join(repo, p)).href);
/** A checkout's engine: index.js, stages.js and actors.js exports, and the tourney world (world.js). */
async function engineOf(repo = REPO) {
  const [index, stages, actors, world] = await Promise.all([
    imp(repo, 'packages/engine/src/index.js'), imp(repo, 'packages/engine/src/stages.js'),
    imp(repo, 'packages/engine/src/actors.js'), imp(repo, 'packages/engine/test/tourney/world.js')
  ]);
  return { index, stages, actors, world };
}

/** The raw workflow file of a checkout, parsed. */
const rawWorkflow = (repo, name) => JSON.parse(readFileSync(join(repo, 'workflows', `${name}.json`), 'utf8'));

/**
 * A copy of a checkout's workflows/ (JSON files and stage files) in a temp folder, each workflow file passed through
 * change[name](spec) when given (and through every(spec) first). Returns the folder.
 */
function copyWorkflows(repo, change = {}, every = null) {
  const dir = mkdtempSync(join(tmpdir(), 'scdr-wf-'));
  cpSync(join(repo, 'workflows'), dir, { recursive: true });
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const name = f.slice(0, -5);
    let spec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (every) spec = every(spec) ?? spec;
    if (change[name]) spec = change[name](spec) ?? spec;
    writeFileSync(join(dir, f), `${JSON.stringify(spec, null, 2)}\n`);
  }
  return dir;
}

/** A spec without meta.marks: the reading of a stage with no marks. */
const unmark = (spec) => {
  if (spec?.meta) delete spec.meta.marks;
  return spec;
};

/** Renames stage `from` to `to` in a workflow: its actor, its invokes' src, its marks and its stage file's title. */
function renameStage(dir, spec, from, to) {
  spec.meta.actors[to] = spec.meta.actors[from];
  delete spec.meta.actors[from];
  if (spec.meta.marks?.[from]) { spec.meta.marks[to] = spec.meta.marks[from]; delete spec.meta.marks[from]; }
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.src === from && ('id' in n || 'input' in n)) n.src = to;
    Object.values(n).forEach(walk);
  };
  walk(spec.states);
  const file = spec.meta.actors[to].prompt;
  if (file) {
    const p = join(dir, file);
    const text = readFileSync(p, 'utf8').replace(new RegExp(`^# ${from}$`, 'm'), `# ${to}`);
    const renamed = file.replace(/[^/]+\.md$/, `${to}.md`);
    writeFileSync(join(dir, renamed), text);
    spec.meta.actors[to].prompt = renamed;
  }
  return spec;
}

const isNoise = (k, v) => (k === 'at' ? typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) : ['id', 'hookSession', 'toolUseId', 'ms'].includes(k) && typeof v !== 'object');
/** Times, row ids, hook sessions and tool-use ids differ between runs; the rest must not. Paths are replaced too. */
function strip(value, paths = {}) {
  let text = JSON.stringify(value ?? null, (k, v) => (isNoise(k, v) ? undefined : v));
  for (const [name, p] of Object.entries(paths)) if (p) text = text.split(p).join(`<${name}>`);
  text = text.replace(/-ret-0\.\d+/g, '-ret-<random>');
  return JSON.parse(text);
}

const { index } = await engineOf(REPO);
const load = (name, change) => () => index.loadWorkflow(name, { dir: copyWorkflows(REPO, { [name]: change }) });
const m = (s) => s.meta.marks;

// [label, workflow, change, every part of the message that must appear]
const CASES = [
  ['a part other than verdicts, briefs and refs', 'quick-fix', (s) => { m(s).verify.stores = ['x']; }, ['stage verify', 'stores', "a stage's marks are verdicts, briefs, refs"]],
  ['a verdict path naming no field', 'quick-fix', (s) => { m(s).verify.verdicts.outcome = 'PASS'; }, ['stage verify', 'outcome', 'not one of its values']],
  ['a verdict path naming a text field', 'research', (s) => { m(s).verify.verdicts['lines.0.evidence'] = 'PASS'; }, ['stage verify', 'lines.0.evidence', 'not one of its values']],
  ['a verdict value the enum does not hold', 'quick-fix', (s) => { m(s).verify.verdicts.result = 'OK'; }, ['stage verify', 'result', '"OK"', 'not one of its values']],
  ['a const verdict holding another value', 'intake', (s) => { s.meta.actors.challenge.properties.result = { const: 'PASS' }; m(s).challenge.verdicts.result = 'YES'; }, ['stage challenge', 'result', 'not one of its values']],
  ['a brief naming no field', 'quick-fix', (s) => { m(s).brief.briefs.push('tester'); }, ['stage brief', 'tester', 'no top-level text field']],
  ['a brief naming a list', 'research', (s) => { m(s).brief.briefs.push('questions'); }, ['stage brief', 'questions', 'no top-level text field']],
  ['a brief naming a nested text field', 'quick-fix', (s) => { m(s).verify.briefs = ['pr.url']; }, ['stage verify', 'pr.url', 'no top-level text field']],
  ['a ref path naming no { url, at }', 'quick-fix', (s) => { m(s).verify.refs.issue = 'github-pr'; }, ['stage verify', 'issue', 'a ref names a kind']],
  ['a ref kind not in refs/', 'quick-fix', (s) => { m(s).build.refs.pr = 'gitlab-mr'; }, ['stage build', 'pr', 'gitlab-mr', 'a ref names a kind']],
  ['a { url, at } whose kind the marks do not name', 'research', (s) => { delete m(s).write.refs; }, ['stage write', 'sources.0', 'its marks name no kind']],
  ['a { url, at } in an empty marks entry', 'quick-fix', (s) => { m(s).build = {}; }, ['stage build', 'output pr', 'its marks name no kind']],
  ['a marked covering stage naming no <list>.0.result', 'quick-fix', (s) => { delete m(s).verify.verdicts['lines.0.result']; }, ['stage verify', 'lines.0.result', 'covers issue.expect']],
  ['a marked covering stage with no verdicts at all', 'intake', (s) => { m(s).challenge = {}; }, ['stage challenge', 'lines.0.result', 'covers issue.expect']],
  ['an entry naming no stage', 'quick-fix', (s) => { m(s).review = {}; }, ['meta.marks names review', 'no model stage']],
  ['an entry naming a host effect', 'quick-fix', (s) => { m(s).merge = {}; }, ['meta.marks names merge', 'no model stage']],
  ['an entry naming the ask effect', 'research', (s) => { m(s).ask = {}; }, ['meta.marks names ask', 'no model stage']]
];

for (const [label, name, change, parts] of CASES) {
  test(`marks-checked: refuses ${label} (${name})`, () => {
    let message = null;
    try { load(name, change)(); } catch (e) { message = e.message; }
    assert.ok(message, 'the load check refused it');
    for (const p of parts) assert.ok(message.includes(p), `${JSON.stringify(message)} names ${p}`);
  });
}

test('marks-checked: the repo workflows, and the same marks on a stage renamed with them, load', () => {
  for (const name of ['quick-fix', 'research', 'intake', 'feature']) assert.doesNotThrow(() => index.loadWorkflow(name, { dir: copyWorkflows(REPO) }));
  // A marks entry for a stage with no output refs and no verdicts loads empty.
  assert.doesNotThrow(load('quick-fix', (s) => { m(s).brief = {}; }));
});

fixGit();
const { world: W } = await engineOf(REPO);
const ISSUE = { url: 'https://github.com/o/r/issues/7', title: 'Add multiply', body: 'Add multiply.', expect: ['math.js exports multiply', 'README documents multiply'] };
const briefsOf = (w, item) => w.rows(item).filter((r) => r.kind === 'brief.stored').map((r) => [r.payload.actor, r.payload.role, readFileSync(join(w.root, 'blobs', r.payload.hash), 'utf8')]);

/** A quick-fix item in the world, through its brief stage (named `briefStage`) and build, to its open verify run. */
async function toVerifying(w, item, briefStage = 'brief') {
  await w.start(item, 'quick-fix', { issue: ISSUE });
  assert.ok((await w.agent(item, briefStage, async () => ({ builder: 'build multiply', verifier: 'check multiply' }))).accepted);
  await w.drive(item);
  assert.equal(w.host(item).snapshot.value, 'building');
  assert.ok((await w.agent(item, 'build', W.builds(w, 1))).accepted);
  await w.drive(item);
  if (w.host(item).snapshot.value !== 'verifying') await w.drive(item, W.suiteWake(w.host(item).snapshot.context.pr.at));
  assert.equal(w.host(item).snapshot.value, 'verifying');
}
const verdict = (w, result, ls, extra = {}) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: structuredClone(input.issue), lines: input.issue.expect.map((line, i) => ({ line, result: ls[i], evidence: `seen ${line}` })), ...extra };
};

test('declared-rules-hold: a renamed brief stage, its marks moved with it, still stores the named fields as briefs under the new name', async () => {
  const dir = copyWorkflows(REPO);
  const spec = JSON.parse(readFileSync(join(dir, 'quick-fix.json'), 'utf8'));
  renameStage(dir, spec, 'brief', 'plan');
  writeFileSync(join(dir, 'quick-fix.json'), JSON.stringify(spec, null, 2));
  assert.deepEqual(spec.meta.marks.plan, { briefs: ['builder', 'verifier'] });
  const w = await W.makeWorld({ dir });
  try {
    await toVerifying(w, 'p1', 'plan');
    assert.deepEqual(briefsOf(w, 'p1'), [['plan', 'builder', 'build multiply'], ['plan', 'verifier', 'check multiply']]);
  } finally { await w.close(); }
});

test('declared-rules-hold: a brief stage whose marks name one field stores only that one', async () => {
  const dir = copyWorkflows(REPO, { 'quick-fix': (s) => { s.meta.marks.brief.briefs = ['verifier']; } });
  const w = await W.makeWorld({ dir });
  try {
    await w.start('o1', 'quick-fix', { issue: ISSUE });
    assert.ok((await w.agent('o1', 'brief', async () => ({ builder: 'build multiply', verifier: 'check multiply' }))).accepted);
    assert.deepEqual(briefsOf(w, 'o1'), [['brief', 'verifier', 'check multiply']]);
  } finally { await w.close(); }
});

// Verify's verdict spelled OK/BAD: the result, the line entries, the guards and the marks.
const okBad = (s) => {
  s.meta.actors.verify.properties.result = { enum: ['OK', 'BAD'] };
  s.meta.schemas.line.properties.result = { enum: ['OK', 'BAD'] };
  s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: ['OK'] };
  s.meta.guards.failed = [{ path: 'context.verdict.result', in: ['BAD'] }];
  s.meta.marks.verify.verdicts = { result: 'OK', 'lines.0.result': 'OK' };
};

test('declared-rules-hold: a verdict of other words, its marks naming the pass, loads, is held to its lines and routes as PASS/FAIL do', async () => {
  const dir = copyWorkflows(REPO, { 'quick-fix': okBad });
  // Without the marks naming OK, the same verdict is refused at load (marks-checked covers why).
  assert.throws(() => W.loadWorkflow('quick-fix', { dir: copyWorkflows(REPO, { 'quick-fix': (s) => { okBad(s); s.meta.marks.verify.verdicts = { result: 'PASS', 'lines.0.result': 'PASS' }; } }) }), /verify/);
  const routes = {};
  for (const [wf, pass, fail] of [[dir, 'OK', 'BAD'], [join(REPO, 'workflows'), 'PASS', 'FAIL']]) {
    const w = await W.makeWorld({ dir: wf });
    try {
      await toVerifying(w, 'k1');
      const disagree = await w.agent('k1', 'verify', verdict(w, pass, [pass, fail]), 'ag-v');
      assert.equal(disagree.refused?.rule, 'covers', JSON.stringify(disagree));
      assert.equal(disagree.refused.reason, 'result.result disagrees with result.lines');
      const disagree2 = await w.agent('k1', 'verify', verdict(w, fail, [pass, pass]), 'ag-v');
      assert.equal(disagree2.refused?.rule, 'covers');
      assert.ok((await w.agent('k1', 'verify', verdict(w, fail, [fail, pass]), 'ag-v')).accepted);
      await w.drive('k1');
      const afterFail = w.host('k1').snapshot.value;
      await toVerifying(w, 'k2');
      assert.ok((await w.agent('k2', 'verify', verdict(w, pass, [pass, pass]), 'ag-v2')).accepted);
      await w.drive('k2');
      routes[pass] = { afterFail, afterPass: w.host('k2').snapshot.value };
    } finally { await w.close(); }
  }
  assert.deepEqual(routes.OK, routes.PASS);
  assert.notEqual(routes.OK.afterPass, routes.OK.afterFail);
  assert.equal(routes.OK.afterFail, 'building');
});

test('declared-rules-hold: an unmarked PASS/FAIL field in a marked stage is not held to the lines (and is, without marks)', async () => {
  const note = (s) => {
    s.meta.actors.verify.properties.note = { enum: ['PASS', 'FAIL'] };
  };
  const withLine = (dir) => appendFileSync(join(dir, 'quick-fix', 'verify.md'), '- note: PASS or FAIL, a second opinion.\n');
  const marked = copyWorkflows(REPO, { 'quick-fix': note });
  const bare = copyWorkflows(REPO, { 'quick-fix': note }, unmark);
  withLine(marked);
  withLine(bare);
  const got = {};
  for (const [label, dir] of [['marked', marked], ['unmarked', bare]]) {
    const w = await W.makeWorld({ dir });
    try {
      await toVerifying(w, 'n1');
      got[label] = await w.agent('n1', 'verify', verdict(w, 'PASS', ['PASS', 'PASS'], { note: 'FAIL' }), 'ag-n');
    } finally { await w.close(); }
  }
  assert.ok(got.marked.accepted, JSON.stringify(got.marked));
  assert.equal(got.unmarked.refused?.reason, 'result.note disagrees with result.lines');
});

test('declared-rules-hold: a research web-page ref whose url is a GitHub PR is checked as a page', async () => {
  const PR = 'https://github.com/o/r/pull/9';
  const w = await W.makeWorld({ pages: { [PR]: 'A pull request page that quotes multiply is fine here.' } });
  try {
    await w.start('r1', 'research', { issue: { ...ISSUE, url: 'https://github.com/o/r/issues/8' } });
    assert.ok((await w.agent('r1', 'brief', async () => ({ questions: ['a', 'b', 'c'], researcher: 'r', writer: 'w', verifier: 'v' }))).accepted);
    await w.drive('r1');
    // PR 9 is not on the fake GitHub: a PR check would refuse it. As a page it counts when the page holds the quote.
    const ok = await w.agent('r1', 'q1', async () => ({ text: 't', sources: [{ url: PR, at: 'multiply is fine' }] }), 'ag-q1');
    assert.ok(ok.accepted, JSON.stringify(ok));
    const stored = JSON.parse(readFileSync(join(w.root, 'blobs', ok.accepted.hash), 'utf8'));
    assert.deepEqual(stored.sources, [{ url: PR, at: 'multiply is fine' }]);
    const missing = await w.agent('r1', 'q2', async () => ({ text: 't', sources: [{ url: PR, at: 'not quoted there' }] }), 'ag-q2');
    assert.equal(missing.refused?.reason, `result.sources.0: the page at ${PR} does not contain the quoted text`);
  } finally { await w.close(); }
});

test('declared-rules-hold: a github-pr ref is checked against GitHub and stamped', async () => {
  const w = await W.makeWorld();
  try {
    await w.start('g1', 'quick-fix', { issue: ISSUE });
    assert.ok((await w.agent('g1', 'brief', async () => ({ builder: 'b', verifier: 'v' }))).accepted);
    await w.drive('g1');
    const nopr = await w.agent('g1', 'build', async ({ worktree }) => ({ pr: { url: 'https://github.com/o/r/pull/5', at: w.commit(worktree) } }), 'ag-g');
    assert.equal(nopr.refused?.reason, 'result.pr: https://github.com/o/r/pull/5: GitHub shows no such PR');
    const ok = await w.agent('g1', 'build', W.builds(w, 1, { files: ['.github/workflows/x.yml', 'a.js'] }), 'ag-g');
    const pr = JSON.parse(readFileSync(join(w.root, 'blobs', ok.accepted.hash), 'utf8')).pr;
    assert.deepEqual(Object.keys(pr), ['url', 'at', 'key', 'branch', 'checkout', 'gates', 'green']);
    assert.equal(pr.key, 'o/r#1');
    assert.deepEqual(pr.gates, ['.github/workflows/x.yml']);
    assert.equal(pr.green, true);
  } finally { await w.close(); }
});
