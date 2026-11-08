// The stage contract's marks: a workflow's meta.marks declares each model stage's verdict fields, the briefs it returns
// and its refs' kinds, and the engine reads those instead of a stage's name, the words PASS and FAIL, or a ref's url.
// A stage without marks is read as before marks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, offer, restore } from '../src/index.js';
import { handlers } from '../src/effects/index.js';
import { accept, actors, bind, loadRun, spawn } from '../src/actors.js';
import { marksIn, marksOf } from '../src/marks.js';
import { REF_KINDS, STAMPED, HIDDEN } from '../src/refs/index.js';
import { coverGap } from '../src/stages.js';
import { readFile } from '../../journal/src/index.js';
import { ISSUE } from './flow.js';

const REPO_WORKFLOWS = new URL('../../../workflows/', import.meta.url).pathname;
const read = (name) => JSON.parse(readFileSync(join(REPO_WORKFLOWS, `${name}.json`), 'utf8'));

// A copy of the repo's workflows with one changed, loaded by name from the copy.
function changed(name, change) {
  const dir = mkdtempSync(join(tmpdir(), 'marks-wf-'));
  cpSync(REPO_WORKFLOWS, dir, { recursive: true });
  const spec = read(name);
  change(spec);
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(spec));
  return dir;
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'marks-repo-'));
  execFileSync('git', ['init', '-q', dir]);
  writeFileSync(join(dir, 'README.md'), 'scratch\n');
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'one']);
  return dir;
}

// An item of quick-fix (from `dir`) started, its first run prepared; that run's agent bound.
async function started(dir) {
  const root = mkdtempSync(join(tmpdir(), 'marks-'));
  const host = restore({ root, item: 'it-1', spec: loadWorkflow('quick-fix', { root, dir }), session: 's', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 's' } }],
    handlers({ actors: actors({ host, repo: repo(), worktrees: join(root, 'worktrees') }) }));
  return root;
}
const briefRows = (root) => readFile(join(root, 'items', 'it-1.jsonl')).rows.filter((r) => r.kind === 'brief.stored');
function agentFor(root, run) {
  spawn({ root, prompt: `ccp-run ${run}`, toolUseId: 'toolu_1' });
  bind({ root, agentId: 'ag-1', toolUseId: 'toolu_1' });
}

test('the repo workflows mark every verdict, brief and ref their stages return', () => {
  const want = {
    'quick-fix': { brief: { briefs: ['builder', 'verifier'] }, build: { refs: ['pr'] }, verify: { verdict: 'result', refs: ['pr'] } },
    research: { brief: { briefs: ['researcher', 'writer', 'verifier'] }, researcher: { refs: ['sources.0'] }, write: { refs: ['sources.0'] }, verify: { verdict: 'result', refs: ['sources.0'] } },
    intake: { challenge: { verdict: 'result' } }
  };
  for (const [name, stages] of Object.entries(want)) {
    const spec = loadWorkflow(name);
    const defs = spec.meta.schemas ?? {};
    for (const [src, w] of Object.entries(stages)) {
      const st = spec.meta.actors[src];
      const m = marksOf(src, st, defs, marksIn(spec, src));
      assert.equal(m.inferred, false, `${name} ${src} is marked`);
      assert.deepEqual(m.verdictAt(), w.verdict ? [w.verdict] : null, `${name} ${src} verdict`);
      const text = Object.fromEntries(Object.keys(st.properties).map((k) => [k, 'x']));
      assert.deepEqual(m.briefs(text).map(([k]) => k), w.briefs ?? [], `${name} ${src} briefs`);
      for (const at of w.refs ?? []) assert.ok(REF_KINDS[m.kindOf(at.split('.'))], `${name} ${src} ${at} has a kind`);
    }
  }
  // The research sources are web pages; the quick-fix PRs are PRs, whatever their url says.
  const research = loadWorkflow('research');
  assert.equal(marksOf('write', research.meta.actors.write, research.meta.schemas, marksIn(research, 'write')).kindOf(['sources', '3'], { url: 'https://github.com/o/r/pull/1' }), 'web-page');
  const qf = loadWorkflow('quick-fix');
  assert.equal(marksOf('build', qf.meta.actors.build, qf.meta.schemas, marksIn(qf, 'build')).kindOf(['pr'], { url: 'https://example.com' }), 'github-pr');
  // feature's brief returns no text to store and no verdict or ref: its marks are empty, and it stores nothing.
  const feature = loadWorkflow('feature');
  const fm = marksOf('brief', feature.meta.actors.brief, feature.meta.schemas, marksIn(feature, 'brief'));
  assert.equal(fm.inferred, false);
  assert.deepEqual(fm.briefs({ slices: 'x', other: 'y' }), []);
  // Every model stage of every repo workflow has its marks: none is read as before marks.
  for (const name of ['quick-fix', 'research', 'intake', 'feature']) {
    const spec = loadWorkflow(name);
    for (const [src, a] of Object.entries(spec.meta.actors)) if ('rules' in a) assert.ok(marksIn(spec, src), `${name} ${src} has marks`);
  }
});

test('the briefs stored are the fields its marks name, whatever the stage is named', async () => {
  // The brief stage renamed plan: its marked fields are still stored as briefs.
  const renamed = changed('quick-fix', (s) => {
    s.meta.actors.plan = s.meta.actors.brief;
    delete s.meta.actors.brief;
    s.meta.marks.plan = s.meta.marks.brief;
    delete s.meta.marks.brief;
    s.states.briefing.invoke.src = 'plan';
  });
  const md = join(renamed, 'quick-fix', 'brief.md');
  writeFileSync(md, readFileSync(md, 'utf8').replace(/^# brief/, '# plan'));
  let root = await started(renamed);
  agentFor(root, 'it-1:0.brief');
  assert.equal(loadRun(root, 'it-1:0.brief').actor, 'plan');
  const ok = await accept({ root, caller: 'ag-1', run: 'it-1:0.brief', result: { builder: 'B', verifier: 'V' }, toolUseId: 't1', github: null });
  assert.ok(ok.accepted, JSON.stringify(ok));
  assert.deepEqual(briefRows(root).map((r) => [r.payload.role, r.payload.actor, readFileSync(join(root, 'blobs', r.payload.hash), 'utf8')]), [['builder', 'plan', 'B'], ['verifier', 'plan', 'V']]);

  // Named brief, with only builder marked: only builder is stored.
  const one = changed('quick-fix', (s) => { s.meta.marks.brief.briefs = ['builder']; });
  root = await started(one);
  agentFor(root, 'it-1:0.brief');
  assert.ok((await accept({ root, caller: 'ag-1', run: 'it-1:0.brief', result: { builder: 'B', verifier: 'V' }, toolUseId: 't1', github: null })).accepted);
  assert.deepEqual(briefRows(root).map((r) => r.payload.role), ['builder']);
});

test('a stage without marks is read as before them: the stage named brief stores each text field', async () => {
  const bare = changed('quick-fix', (s) => { delete s.meta.marks.brief; });
  const root = await started(bare);
  agentFor(root, 'it-1:0.brief');
  assert.ok((await accept({ root, caller: 'ag-1', run: 'it-1:0.brief', result: { builder: 'B', verifier: 'V' }, toolUseId: 't1', github: null })).accepted);
  assert.deepEqual(briefRows(root).map((r) => r.payload.role), ['builder', 'verifier']);
  // The same stage under another name stores none.
  const m = marksOf('plan', { properties: { builder: { type: 'string' } } });
  assert.deepEqual(m.briefs({ builder: 'B' }), []);
});

test('a verdict is the field its marks name, and the value they name is the pass, whatever the words', () => {
  const schema = {
    properties: {
      outcome: { enum: ['ok', 'bad'] },
      note: { enum: ['PASS', 'FAIL'] },
      lines: { type: 'array', items: { $ref: '#line' }, covers: 'issue.expect' }
    }
  };
  const defs = { line: { type: 'object', properties: { line: { type: 'string' }, result: { enum: ['yes', 'no'] } } } };
  const m = marksOf('judge', schema, defs, { verdicts: { outcome: 'ok', 'lines.0.result': 'yes' } });
  const input = { issue: { expect: ['a', 'b'] } };
  const lines = (a, b) => [{ line: 'a', result: a }, { line: 'b', result: b }];
  const gap = (result) => coverGap(schema, input, result, m)?.message ?? null;
  assert.equal(gap({ outcome: 'ok', lines: lines('yes', 'yes') }), null);
  assert.equal(gap({ outcome: 'bad', lines: lines('yes', 'no') }), null);
  assert.deepEqual(gap({ outcome: 'ok', lines: lines('yes', 'no') }), { entry: 'covers-disagrees', slots: { key: 'outcome', field: 'lines' } });
  assert.deepEqual(gap({ outcome: 'bad', lines: lines('yes', 'yes') }), { entry: 'covers-disagrees', slots: { key: 'outcome', field: 'lines' } });
  // An unmarked PASS/FAIL field in a marked stage is no verdict: accept does not hold it to the lines.
  assert.equal(gap({ outcome: 'ok', note: 'FAIL', lines: lines('yes', 'yes') }), null);
  assert.deepEqual(m.verdictAt(), ['outcome']);
  assert.equal(m.isVerdict(['outcome']), true);
  assert.equal(m.isVerdict(['note']), false);
  // Unmarked, the word is the verdict, in any case, as before marks.
  const bare = { properties: { note: { enum: ['pass', 'fail'] }, lines: { covers: 'issue.expect' } } };
  assert.deepEqual(coverGap(bare, input, { note: 'pass', lines: [{ line: 'a', result: 'PASS' }, { line: 'b', result: 'fail' }] })?.message, { entry: 'covers-disagrees', slots: { key: 'note', field: 'lines' } });
  assert.deepEqual(marksOf('judge', bare).verdictAt(), ['note']);
});

test('the load check refuses marks that name nothing the output holds, and an unnamed ref or covered result', () => {
  const load = (change) => () => loadWorkflow('quick-fix', { dir: changed('quick-fix', change) });
  assert.doesNotThrow(load(() => {}));
  const v = (s) => s.meta.actors.verify.properties;
  const mv = (s) => s.meta.marks.verify;
  assert.throws(load((s) => { mv(s).verdicts.result = 'OK'; }), /stage verify marks verdict result as "OK", which is not one of its values$/);
  assert.throws(load((s) => { v(s).result = { type: 'string' }; }), /stage verify marks verdict result as "PASS", which is not one of its values$/);
  assert.throws(load((s) => { mv(s).verdicts['issue.url'] = 'x'; }), /stage verify marks verdict issue\.url as "x"/);
  assert.throws(load((s) => { s.meta.marks.build.refs.pr = 'gitlab-mr'; }), /stage build marks ref pr as "gitlab-mr": a ref names a kind \(github-pr, web-page\) on a ref \{ url, at \}$/);
  assert.throws(load((s) => { mv(s).refs.issue = 'web-page'; }), /stage verify marks ref issue as "web-page"/);
  assert.throws(load((s) => { delete s.meta.marks.build.refs; }), /stage build output pr is a ref \{ url, at \} its marks name no kind for \(github-pr, web-page\)$/);
  assert.throws(load((s) => { delete mv(s).verdicts['lines.0.result']; }), /stage verify output lines covers issue\.expect, but meta\.marks\.verify\.verdicts has no lines\.0\.result: name the value that means a line passed$/);
  assert.throws(load((s) => { s.meta.marks.brief.briefs.push('nope'); }), /stage brief marks brief nope, which is no top-level text field$/);
  assert.throws(load((s) => { mv(s).briefs = ['issue']; }), /stage verify marks brief issue, which is no top-level text field$/);
  assert.throws(load((s) => { mv(s).store = []; }), /stage verify marks have store: a stage's marks are verdicts, briefs, refs$/);
  assert.throws(load((s) => { s.meta.marks.merge = {}; }), /meta\.marks names merge, which is no model stage/);
  // A marked verdict with the covers removed is refused as before: the verdict is given lines.
  assert.throws(load((s) => { delete v(s).lines.covers; }), /stage verify output result decides guard \w+ .* but no output field declares covers$/);
  // A verdict the chart does not route on still needs covers.
  assert.throws(load((s) => {
    delete v(s).lines.covers;
    s.meta.guards.verifiedHead = s.meta.guards.verifiedHead.filter((c) => c?.path !== 'context.verdict.result');
    s.meta.guards.failed = [{ path: 'context.verdict.pr.url', in: ['never'] }];
  }), /stage verify output result is a verdict \(meta\.marks\) while input issue may hold lines, but no output field declares covers$/);
  // The chart may route on a marked verdict of any words, and not on an unmarked word field beside the covered lines.
  assert.doesNotThrow(load((s) => {
    v(s).result = { enum: ['ok', 'bad'] };
    mv(s).verdicts.result = 'ok';
    s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: ['ok'] };
    s.meta.guards.failed = [{ path: 'context.verdict.result', in: ['bad'] }];
  }));
  assert.throws(load((s) => { delete mv(s).verdicts.result; }), /stage verify output result decides guard \w+ .*, but the host holds only lines and verdict fields to the covered lines: decide on those$/);
});

test('each ref kind declares what it stamps; STAMPED and HIDDEN are their union', () => {
  assert.deepEqual(Object.keys(REF_KINDS), ['github-pr', 'web-page']);
  assert.deepEqual(STAMPED, ['key', 'gates', 'green', 'checkout', 'branch']);
  assert.deepEqual(HIDDEN, ['key', 'gates', 'green', 'checkout']);
  assert.deepEqual(REF_KINDS['web-page'].stamps, []);
});

test('a ref is checked by its declared kind: a web-page ref to a PR url is read as a page', async () => {
  const ref = { url: 'https://github.com/o/r/pull/1', at: 'quoted words' };
  const page = (body) => ({ get: async () => ({ status: 200, body }) });
  assert.deepEqual(await REF_KINDS['web-page'].check(ref, { path: 'result.sources.0', web: page('some quoted   words here') }), { stamp: {} });
  assert.equal((await REF_KINDS['web-page'].check(ref, { path: 'result.sources.0', web: page('nothing') })).refused.message.entry, 'ref-page');
  // A github-pr ref whose url is no PR is refused as no such PR, without asking GitHub.
  const got = await REF_KINDS['github-pr'].check({ url: 'https://example.com/x', at: 'a'.repeat(40) }, { path: 'result.pr', github: null });
  assert.equal(got.refused.message.entry, 'ref-no-pr');
});
