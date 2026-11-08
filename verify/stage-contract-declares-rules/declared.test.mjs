// declared-rules-hold: through the real loader and hooks (the tourney world: real spawn, bind, accept and drive), a
// workflow's meta.marks decide what is stored as a brief, which field is a verdict and what value passes, and how
// each ref is checked, whatever the stage is named and whatever words the verdict uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, copyWorkflows, engineOf, fixGit, renameStage, unmark } from './lib.mjs';

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
