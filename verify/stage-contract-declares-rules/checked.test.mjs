// marks-checked: the head's load check refuses marks that do not name what the output holds, naming the stage and
// the path. Each case changes one repo workflow's meta.marks in a copy and loads it by name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REPO, copyWorkflows, engineOf } from './lib.mjs';

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
