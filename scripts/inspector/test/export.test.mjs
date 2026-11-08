// Tests for the Workflow Inspector exporter and build (scripts/inspector, docs/inspector.md): the map and every way
// out come from the engine (chart, explain), and everything about a model run from its stage record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportRun, graphOf, outcomeOf, producerRef, segmentsFrom, stageView, flowOf } from '../export.mjs';
import { build, capture, engineOf, testNames } from '../build.mjs';
import { chart } from '../../../packages/engine/src/stages.js';
import { readWorkflow } from '../../../packages/engine/src/prompts.js';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');
const BLOCKED = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/blocked-retry/journal');
const modelsOf = (b) => b.steps.flatMap((s) => s.actors.filter((a) => a.model));

test('the map of every workflow file is the engine\'s chart: every state, and every transition by its JSON pointer', async () => {
  for (const file of readdirSync(join(REPO, 'workflows')).filter((n) => n.endsWith('.json'))) {
    const { spec } = readWorkflow(file.slice(0, -5), { dir: join(REPO, 'workflows') });
    const c = chart(spec);
    const g = await graphOf(REPO, spec);
    assert.deepEqual(g.nodes.map((n) => n.id), [...c.nodes.keys()], file);
    assert.deepEqual(g.edges.map((e) => e.id), c.transitions.map((t) => t.at), file);
    for (const e of g.edges) assert.ok(g.nodes.some((n) => n.id === e.to), `${file}: ${e.id} leads to a state`);
    assert.ok(g.edges.every((e) => ['on', 'after', 'done', 'error'].includes(e.kind)), file);
  }
});

test('every step\'s ways out are what the engine tried, in its order, and the taken one is where the item went', async () => {
  const b = await exportRun({ engine: REPO, journal: ADOPT, kind: 'real' });
  const step = b.steps.find((s) => s.eventType === 'xstate.done.actor.verify');
  assert.deepEqual(step.candidates.map((c) => [c.to, c.failing, c.taken]), [['awaitingGates', ['gatesTouched'], false], ['merging', ['approved'], false], ['awaitingMerge', [], true]]);
  assert.equal(step.edge.id, '/states/verifying/invoke/onDone/2');
  for (const r of [b, await exportRun({ engine: REPO, journal: BLOCKED, kind: 'real' })]) {
    for (const s of r.steps.filter((x) => x.edge)) assert.ok(s.to.some((l) => l === s.edge.to || l.startsWith(`${s.edge.to}.`)), `step ${s.seq}`);
  }
});

test('an event the engine ignored lists the transitions it tried, none taken, with the tests that failed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-ignored-'));
  cpSync(ADOPT, dir, { recursive: true });
  const file = join(dir, 'items', 'trial.jsonl');
  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const last = rows.filter((r) => r.kind === 'engine.transition' && r.payload.seq === 3)[0];
  // An event nothing in verifying listens for, and a check suite for another PR, which verifying listens for but turns away.
  const again = { ...last, id: 'again', payload: { ...last.payload, seq: 99, transition: 'trial#99', outcome: 'ignored', event: { type: 'github.ping' } } };
  const other = { ...last, id: 'other', payload: { ...last.payload, seq: 98, transition: 'trial#98', outcome: 'ignored', event: { ...last.payload.event, head_sha: 'f'.repeat(40), pr: 'o/r#99' } } };
  const at = rows.indexOf(rows.filter((r) => r.kind === 'engine.transition' && r.payload.seq === 4)[0]);
  rows.splice(at, 0, other, again);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const b = await exportRun({ engine: REPO, journal: dir, kind: 'real' });
  const s = b.steps.find((x) => x.seq === 99);
  assert.deepEqual(s.candidates, []);
  assert.match(s.label, /nothing listens for it/);
  const o = b.steps.find((x) => x.seq === 98);
  assert.deepEqual(o.candidates.map((c) => [c.to, c.failing, c.taken]), [['verifying', ['sameHead'], false], ['reverifying', ['mine'], false]]);
  assert.match(o.label, /verifying listens for it, but sameHead failed .*mine failed/);
});

test('a model run is a run folder with a stage record; its prompt is the record\'s pieces in order, its host fields the record\'s stamped', async () => {
  const b = await exportRun({ engine: REPO, journal: ADOPT, kind: 'real' });
  const models = modelsOf(b);
  assert.deepEqual(models.map((a) => a.actor), ['brief', 'build', 'verify']);
  for (const s of b.steps) for (const a of s.actors.filter((x) => x.type === 'run')) {
    const folder = join(ADOPT, 'items', 'trial', 'runs', String(a.effect).split(':')[1]);
    assert.equal(a.model, existsSync(join(folder, 'stage.json')), a.effect);
  }
  for (const a of models) {
    const rec = JSON.parse(readFileSync(join(a.layers.folder, 'stage.json'), 'utf8'));
    const L = a.layers;
    assert.equal(L.l2.segments.map((x) => x.text).join(''), L.l2.text, `${a.actor}: segments are the prompt`);
    const pieces = Object.values(rec.prompt.parts).flat().map((p) => p.text);
    const named = L.l2.segments.filter((x) => !/part headings and line breaks/.test(x.note)).map((x) => x.text);
    assert.deepEqual(named, pieces, `${a.actor}: every other segment is a recorded piece, in order`);
    assert.deepEqual(L.l6.hostWritten.map((h) => h.path), rec.stamped ?? []);
    assert.equal(L.l3.segments[0].text, rec.context.text);
    assert.ok(L.l2.checks.every((c) => c.ok), `${a.actor}: checks`);
  }
  assert.match(models[0].layers.l2.provenance.summary, /workflow author/);
  assert.equal(models[1].layers.l2.provenance.producer?.actor, 'brief', 'the build task was written by the brief agent');
});

test('segmentsFrom says so when the prompt file does not hold the recorded pieces', () => {
  const parts = { rules: [{ text: 'Rule one.', source: { frame: 'DATA_RULE', fixed: true } }], task: [{ text: 'Do it.', source: { input: 'task' } }] };
  const ok = segmentsFrom('## Rules\nRule one.\n\n## Task\nDo it.', parts);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.segments.map((s) => s.from), ['template', 'template', 'template', 'input']);
  const bad = segmentsFrom('## Task\nDo it.\n\n## Rules\nRule one.', parts);
  assert.equal(bad.ok, false);
  assert.equal(bad.segments[0].from, 'unknown');
});

test('a journal whose model run has no stage record, and an engine that cannot explain, are refused by name; build skips them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-refused-'));
  const root = join(dir, 'j');
  cpSync(ADOPT, root, { recursive: true });
  rmSync(join(root, 'items', 'trial', 'runs', '1.build', 'stage.json'));
  await assert.rejects(exportRun({ engine: REPO, journal: root }), /1\.build has a prompt but no stage record/);
  const old = join(dir, 'engine');
  mkdirSync(join(old, 'packages/engine/src'), { recursive: true });
  writeFileSync(join(old, 'packages/engine/src/spec.js'), 'export {};\n');
  await assert.rejects(exportRun({ engine: old, journal: ADOPT }), /cannot explain its transitions \(no packages\/engine\/src\/stages\.js, explain\.js, names\.js\)/);
  const config = join(dir, 'sources.json');
  writeFileSync(config, JSON.stringify({ sources: [
    { origin: 'Real', kind: 'real', engine: REPO, journal: ADOPT, label: 'adopt' },
    { origin: 'Real', kind: 'real', engine: REPO, journal: root, label: 'unrecorded' }
  ] }));
  const r = await build({ config, out: join(dir, 'out'), captureDir: join(dir, 'cap') });
  assert.equal(r.runs, 1);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /^unrecorded: .*no stage record/);
});

test('outcomeOf words a run that finished without returning, one whose returns were refused, and one that failed', () => {
  const finish = { kind: 'agent.finish', at: '2026-11-08T00:00:10Z', ms: 10000 };
  const noReturn = outcomeOf({ trace: [finish], state: 'building' });
  assert.equal(noReturn.status, 'no-return');
  assert.doesNotMatch(noReturn.sentence, /still running/);
  const refused = outcomeOf({ trace: [{ kind: 'tool.call', tool: 'mcp__harness__return', at: '2026-11-08T00:00:05Z' }, finish], rows: [{ verdict: 'refused', at: '2026-11-08T00:00:05Z', payload: { rule: 'schema' } }] });
  assert.equal(refused.status, 'refused');
  assert.doesNotMatch(refused.sentence, /never returned/);
  const failed = outcomeOf({ trace: [finish], files: [{ name: 'failed.json', value: {} }] });
  assert.equal(failed.status, 'failed');
  assert.match(failed.sentence, /never called the return tool/);
  assert.doesNotMatch(failed.sentence, /refused|waiting for a new return/);
});

test('testNames reads top-level test names from TAP', () => {
  assert.deepEqual(testNames('TAP version 13\n# Subtest: one\nok 1 - one\n# Subtest: two\n'), ['one', 'two']);
});

test('build writes index.html and data.js from a config, and skips missing sources by name', { timeout: 300000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-build-'));
  const config = join(dir, 'sources.json');
  writeFileSync(config, JSON.stringify({ sources: [
    { origin: 'Real', kind: 'real', engine: REPO, journal: ADOPT, label: 'adopt' },
    { origin: 'Gone', kind: 'real', engine: join(dir, 'nope'), journal: join(dir, 'nope'), label: 'missing' }
  ] }));
  const out = join(dir, 'out');
  const r = await build({ config, out, captureDir: join(dir, 'cap') });
  assert.equal(r.runs, 1);
  assert.equal(r.skipped.length, 1);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<title>Workflow Inspector<\/title>/);
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/, 'no external scripts or styles');
  const data = readFileSync(join(out, 'data.js'), 'utf8');
  assert.match(data, /^window\.INSPECTOR_DATA = /);
  const D = JSON.parse(data.slice('window.INSPECTOR_DATA = '.length).replace(/;\n$/, ''));
  for (const run of D.runs) assert.ok(D.workflows[run.workflow.key].graph.nodes.length);
  assert.ok(D.shelf.some((w) => w.file.endsWith('workflows/quick-fix.json')), 'every workflow file of the engine is on the shelf');
});

test('the page never tells a scripted run that Claude Code started its agent', () => {
  const page = readFileSync(new URL('../page.html', import.meta.url), 'utf8');
  const at = page.indexOf('first message Claude Code started the agent with');
  assert.ok(at > 0);
  assert.match(page.slice(at - 400, at), /scripted \? 'The exact text the engine wrote/);
});


const MAIN = REPO;
// A two-stage workflow and its stage records, written by hand.
function stageFixture() {
  const engine = mkdtempSync(join(tmpdir(), 'wi-stage-eng-'));
  const journal = mkdtempSync(join(tmpdir(), 'wi-stage-j-'));
  const spec = { id: 'tiny', initial: 'a', context: { plan: null, out: null },
    states: { a: { invoke: { id: 'plan', src: 'plan', input: { task: { value: 'plan it' } }, onDone: { target: 'b', actions: [{ type: 'set', params: { plan: 'event.output' } }] } } },
      b: { invoke: { id: 'do', src: 'do', input: { task: 'context.plan.steps' }, onDone: { target: 'c', actions: [{ type: 'set', params: { out: 'event.output' } }] } } },
      c: { type: 'final' } } };
  mkdirSync(join(engine, 'workflows'), { recursive: true });
  writeFileSync(join(engine, 'workflows', 'tiny.json'), JSON.stringify(spec));
  const at = (n) => `2026-11-04T00:00:0${n}Z`;
  const tr = (seq, event, state, run = null) => ({ kind: 'engine.transition', at: at(seq), state: JSON.stringify(state), payload: { workflow: 'tiny', seq, transition: `t#${seq}`, outcome: 'applied', event, run } });
  const eff = (seq, invoke) => ({ kind: 'engine.effect', at: at(seq), payload: { effect: `t:${seq}.${invoke}`, type: 'run', phase: 'start', transition: `t#${seq}`, actor: invoke } });
  const rows = [tr(0, { type: 'xstate.init', input: {} }, 'a'), eff(0, 'plan'), tr(1, { type: 'xstate.done.actor.plan', output: { steps: 'do it' } }, 'b', 't:0.plan'), eff(1, 'do'), tr(2, { type: 'xstate.done.actor.do', output: { done: true } }, 'c', 't:1.do')];
  mkdirSync(join(journal, 'items', 't', 'runs', '0.plan'), { recursive: true });
  mkdirSync(join(journal, 'items', 't', 'runs', '1.do'), { recursive: true });
  writeFileSync(join(journal, 'items', 't.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(journal, 'items', 't', 'runs', '0.plan', 'brief.md'), '## Task\nplan it\n');
  writeFileSync(join(journal, 'items', 't', 'runs', '1.do', 'brief.md'), '## Task\ndo it\n');
  const plan = { run: 't:0.plan', stage: 'plan', invoke: 'plan', state: 'a', invokeAt: '/states/a/invoke', workflow: { id: 'tiny', name: 'tiny', hash: null }, started: 't#0',
    prompt: { hash: 'h0', parts: { rules: [{ text: 'Data rule.', source: { frame: 'DATA_RULE', fixed: true } }], task: [{ text: 'plan it', source: { input: 'task' } }],
      return: [{ text: 'Run t:0.plan.', source: { frame: 'runLine', filled: { run: 't:0.plan' } } }] } },
    inputs: [{ name: 'task', meaning: 'What to plan.', meaningAt: '/meta/actors/plan/inputs/task', value: 'plan it', from: { value: 'plan it' }, wiredAt: '/states/a/invoke/input/task', producer: { kind: 'literal', at: '/states/a/invoke/input/task/value' } }],
    finished: { transition: 't#1', event: 'xstate.done.actor.plan', state: ['b'] }, output: { steps: 'do it' }, stamped: [],
    wrote: [{ path: 'plan', from: 'event.output', at: '/states/a/invoke/onDone/actions/0/params/plan', into: 'b',
      replaced: null, readBy: [{ actor: 'do', invoke: 'do', state: 'b', input: 'task', reads: 'context.plan.steps', at: '/states/b/invoke/input/task', kind: 'stage' }] }] };
  const doer = { run: 't:1.do', stage: 'do', invoke: 'do', state: 'b', invokeAt: '/states/b/invoke', workflow: { id: 'tiny', name: 'tiny', hash: null }, started: 't#1',
    prompt: { hash: 'h1', parts: { task: [{ text: 'do it', source: { input: 'task' } }], output: [{ text: 'Schema: {}', source: { workflow: '/meta/actors/do', inlined: '/meta/schemas' } }] } },
    inputs: [{ name: 'task', meaning: 'The steps.', value: 'do it', from: 'context.plan.steps', wiredAt: '/states/b/invoke/input/task',
      producer: { kind: 'stage', run: 't:0.plan', actor: 'plan', field: 'steps', transition: 't#1', at: '/states/a/invoke/onDone/actions/0/params/plan' } }],
    finished: { transition: 't#2', event: 'xstate.done.actor.do', state: ['c'] }, output: { done: true }, stamped: [], wrote: [] };
  writeFileSync(join(journal, 'items', 't', 'runs', '0.plan', 'stage.json'), JSON.stringify(plan));
  writeFileSync(join(journal, 'items', 't', 'runs', '1.do', 'stage.json'), JSON.stringify(doer));
  return { engine, journal };
}

test('stage.json goes into the run bundle: prompt parts with sources, inputs with producers linked to runs, output with readers linked to runs', async () => {
  const { engine, journal } = stageFixture();
  const b = await exportRun({ engine: REPO, journal, workflow: join(engine, 'workflows', 'tiny.json'), kind: 'scripted' });
  const runs = b.steps.flatMap((s) => s.actors);
  const plan = runs.find((a) => a.effect === 't:0.plan');
  const doer = runs.find((a) => a.effect === 't:1.do');
  assert.ok(plan.stage && doer.stage, 'both runs carry their stage view');
  assert.ok(!('stageRaw' in JSON.parse(JSON.stringify(plan))), 'the raw record is not exported twice');
  // Instructions: parts in the engine's order, each piece with its source.
  assert.deepEqual(plan.stage.parts.map((p) => p.part), ['rules', 'task', 'return']);
  assert.deepEqual(plan.stage.parts[0].pieces[0].source, { kind: 'frame', name: 'DATA_RULE', label: 'harness frame: DATA_RULE', fixed: true, filled: null, detail: 'fixed text in the engine (packages/engine/src/stages.js), the same for every stage' });
  assert.match(plan.stage.parts.find((p) => p.part === 'return').pieces[0].source.detail, /filled in with this run's run/);
  assert.equal(doer.stage.parts.find((p) => p.part === 'output').pieces[0].source.at, '/meta/actors/do');
  const taskSrc = doer.stage.parts.find((p) => p.part === 'task').pieces[0].source;
  assert.equal(taskSrc.kind, 'input');
  assert.equal(taskSrc.producer.link.run, 't:0.plan', 'a task piece names the run that wrote it');
  // Inputs: a literal, and a stage producer resolved to the producing run's step.
  assert.equal(plan.stage.inputs[0].producer.kind, 'literal');
  assert.equal(plan.stage.inputs[0].literal, true);
  const inp = doer.stage.inputs[0];
  assert.equal(inp.from, 'context.plan.steps');
  assert.deepEqual(inp.producer.link, { run: 't:0.plan', index: 0, seq: 0, actor: 'plan', invoke: 'plan' });
  assert.equal(inp.producer.detail, 'its output field steps');
  assert.deepEqual(inp.producer.step, { index: 1, seq: 1 });
  // Output: the value, the path written, and the later run that read it.
  assert.deepEqual(plan.stage.output, { steps: 'do it' });
  assert.deepEqual(plan.stage.finished, { transition: 't#1', step: { index: 1, seq: 1 }, event: 'xstate.done.actor.plan', state: 'b', stopped: false });
  const rb = plan.stage.wrote[0].readBy[0];
  assert.deepEqual(rb.runs, [{ run: 't:1.do', index: 1, seq: 1, actor: 'do', invoke: 'do', read: true }]);
  // The item's flow: start order, and the context path between the two runs.
  assert.deepEqual(b.flow.nodes.map((n) => n.id), ['t:0.plan', 't:1.do']);
  assert.deepEqual(b.flow.edges, [{ from: 't:0.plan', to: 't:1.do', paths: ['plan.steps'], unverified: false }]);
});

test('producerRef words every producer kind, and runs without stage records make no flow', () => {
  const ctx = { runs: [{ run: 'x:1.build', actor: 'build', invoke: 'build', index: 1, seq: 1 }], steps: [{ seq: 0, index: 0 }, { seq: 1, index: 1 }, { seq: 2, index: 2 }] };
  const r = (p) => producerRef(p, ctx);
  assert.equal(r({ kind: 'initial', field: 'issue', transition: 'x#0' }).label, "the item's start input");
  assert.equal(r({ kind: 'default', at: '/context/pr' }).at, '/context/pr');
  assert.equal(r({ kind: 'none' }).label, 'nothing');
  assert.match(r({ kind: 'event', event: 'github.check_suite.completed', source: { system: 'github' }, field: 'head_sha', transition: 'x#2' }).label, /from github/);
  const host = r({ kind: 'host', stamped: 'checkout', run: 'x:1.build', actor: 'build', field: 'pr.checkout', transition: 'x#2' });
  assert.equal(host.link.run, 'x:1.build');
  assert.match(host.detail, /did not write it/);
  const copy = r({ kind: 'copy', from: 'context.pr', of: { kind: 'stage', run: 'x:1.build', actor: 'build', field: 'pr' } });
  assert.equal(copy.of.link.index, 1);
  const parts = r({ kind: 'parts', default: '/context/answers', parts: [{ path: 'answers.q1', kind: 'stage', run: 'x:1.build', actor: 'build', field: null }, { path: 'answers.q3.error', kind: 'stage', run: 'x:9.gone', actor: 'researcher', field: 'error' }] });
  assert.equal(parts.parts.length, 2);
  assert.equal(parts.parts[0].detail, 'its whole output');
  assert.equal(parts.parts[1].detail, 'its error');
  assert.equal(parts.parts[1].link, null, 'a run not in this item is named, not linked');
  // A write that replaced an earlier one names it; a reader that is the writing invoke itself is marked self.
  const v = stageView({ run: 'x:1.build', stage: 'build', invoke: 'build', state: 'building', inputs: [], prompt: { parts: {} }, finished: { transition: 'x#2', event: 'xstate.done.actor.build', state: ['checking'] }, output: { pr: { url: 'u', at: 'a', key: 'k' } }, stamped: ['pr.key'],
    wrote: [{ path: 'pr', from: 'event.output.pr', into: 'checking', replaced: { kind: 'stage', run: 'x:1.build', actor: 'build', field: 'pr' }, readBy: [{ actor: 'build', invoke: 'build', state: 'building', input: 'previous', reads: 'context.pr', kind: 'stage', self: true }] }] }, ctx);
  assert.equal(v.wrote[0].replaced.link.run, 'x:1.build');
  assert.equal(v.wrote[0].readBy[0].self, true);
  assert.deepEqual(v.stamped, ['pr.key']);
  assert.equal(v.finished.state, 'checking');
  assert.equal(flowOf([{ run: 'x:1.build', actor: 'build', stage: null }], ctx.steps), null);
});

test('main Q1 and R1: every model run has its stage record, producers link to runs of the item, and R1 answers are made of researcher parts', { skip: !existsSync(join(MAIN, 'packages/engine/test/tourney/R1.test.js')) && 'no tourney scenarios here', timeout: 300000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-stage-cap-'));
  const q1 = capture({ engine: MAIN, scenario: 'packages/engine/test/tourney/Q1.test.js', dir: join(dir, 'q1') });
  const b = await exportRun({ engine: MAIN, journal: q1.roots[0], kind: 'scripted' });
  const models = b.steps.flatMap((s) => s.actors.filter((a) => a.model));
  assert.ok(models.length >= 3 && models.every((a) => a.stage), 'every model run has a stage view');
  const verify = models.find((a) => a.actor === 'verify');
  const target = verify.stage.inputs.find((i) => i.name === 'target');
  assert.equal(target.producer.link.actor, 'build');
  assert.ok(target.amended.length, 'the CI event changed parts of the PR after build returned it');
  assert.equal(verify.stage.inputs.find((i) => i.name === 'checkout').producer.kind, 'host');
  assert.ok(models.find((a) => a.actor === 'build').stage.stamped.includes('pr.key'), 'build output names the paths the harness stamped');
  assert.ok(models.every((a) => a.stage.parts.every((p) => p.pieces.every((x) => x.source.kind !== 'frame' || x.source.fixed || x.source.filled))), 'every frame piece says fixed or filled');
  const build = models.find((a) => a.actor === 'build');
  const pr = build.stage.wrote.find((w) => w.path === 'pr');
  assert.ok(pr.readBy.some((rb) => rb.runs.some((x) => x.run === verify.effect && x.read === true)), 'build.pr is read by the verify run');
  assert.deepEqual(b.flow.nodes.slice(0, 4).map((n) => n.actor), ['start input', 'brief', 'build', 'verify']);
  const r1 = capture({ engine: MAIN, scenario: 'packages/engine/test/tourney/R1.test.js', dir: join(dir, 'r1') });
  const rb = await exportRun({ engine: MAIN, journal: r1.roots[0], kind: 'scripted' });
  const write = rb.steps.flatMap((s) => s.actors).find((a) => a.actor === 'write' && a.stage);
  const answers = write.stage.inputs.find((i) => i.name === 'answers');
  assert.equal(answers.producer.kind, 'parts');
  assert.equal(answers.producer.parts.length, 3);
  assert.ok(answers.producer.parts.every((p) => p.link && p.link.actor === 'researcher'));
  assert.deepEqual(answers.amended, []);
});

// The stage-contract tournament's adopt trial is committed, so this check runs everywhere: real agents, main's engine.

test('adopt trial: every model run carries its stage.json as on disk, and the flow is brief, build, verify with briefs.builder, pr and verdict between them', { timeout: 300000 }, async () => {
  const b = await exportRun({ engine: REPO, journal: ADOPT, kind: 'real' });
  const models = b.steps.flatMap((s) => s.actors.filter((a) => a.model));
  assert.deepEqual(models.map((a) => a.actor), ['brief', 'build', 'verify']);
  for (const a of models) {
    const [, n] = a.effect.split(':');
    const disk = JSON.parse(readFileSync(join(ADOPT, 'items', 'trial', 'runs', n, 'stage.json'), 'utf8'));
    assert.equal(a.stage.run, disk.run);
    assert.deepEqual(a.stage.parts.map((p) => p.part), Object.keys(disk.prompt.parts), `${a.effect}: parts in order`);
    for (const p of a.stage.parts) assert.deepEqual(p.pieces.map((x) => x.text), disk.prompt.parts[p.part].map((x) => x.text), `${a.effect}: ${p.part} pieces`);
    // A literal input's from is { value } on disk; the view marks it literal and keeps the value.
    const fromOf = (i) => (typeof i.from === 'string' ? i.from : null);
    assert.deepEqual(a.stage.inputs.map((i) => [i.name, i.meaning, fromOf(i)]), disk.inputs.map((i) => [i.name, i.meaning, fromOf(i)]), `${a.effect}: inputs`);
    for (const [i, inp] of a.stage.inputs.entries()) assert.deepEqual(inp.value, disk.inputs[i].value, `${a.effect}: ${inp.name} value`);
    for (const [i, inp] of a.stage.inputs.entries()) if (disk.inputs[i].producer.run) assert.equal(inp.producer.link.run, disk.inputs[i].producer.run, `${a.effect}: ${inp.name} producer links its run`);
    assert.deepEqual(a.stage.output, disk.output);
    assert.deepEqual(a.stage.wrote.map((w) => w.path), disk.wrote.map((w) => w.path), `${a.effect}: paths written`);
  }
  const between = (from, to) => b.flow.edges.find((e) => e.from === from.effect && e.to === to.effect)?.paths ?? [];
  const [brief, build, verify] = models;
  assert.ok(between(brief, build).includes('briefs.builder'));
  assert.ok(between(build, verify).includes('pr'));
  const order = b.flow.nodes.map((n) => n.id);
  assert.ok(order.indexOf(brief.effect) < order.indexOf(build.effect) && order.indexOf(build.effect) < order.indexOf(verify.effect), 'brief, build, verify in start order');
  assert.ok(b.flow.edges.some((e) => e.from === verify.effect && e.paths.includes('verdict')), 'verify passes verdict on');
});

test('engineOf: a string engine is relative to the repo root, a { commit } engine is a worktree of that commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-engine-'));
  assert.equal(engineOf('.', dir).path, REPO.replace(/\/$/, ''));
  assert.match(engineOf({ commit: '0'.repeat(40) }, dir).missing, /not in this clone/);
  assert.match(engineOf({}, dir).missing, /neither a folder nor/);
  const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const made = new Map();
  const e = engineOf({ commit: head }, dir, made);
  try {
    assert.ok(existsSync(join(e.path, 'packages/engine/src/spec.js')), 'the worktree holds the engine');
    assert.equal(engineOf({ commit: head }, dir, made), e, 'checked out once per build');
  } finally {
    execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', e.path], { stdio: 'ignore' });
  }
});

test('a stage record that names catalogue entries (prompt-catalogue) carries them on each piece and in the detail', async () => {
  const { engine, journal } = stageFixture();
  const file = join(journal, 'items', 't', 'runs', '0.plan', 'stage.json');
  const rec = JSON.parse(readFileSync(file, 'utf8'));
  rec.prompt.parts.rules[0].source.entry = 'data-rule';
  rec.prompt.parts.return[0].source.entry = 'return-line';
  writeFileSync(file, JSON.stringify(rec));
  const b = await exportRun({ engine: REPO, journal, workflow: join(engine, 'workflows', 'tiny.json'), kind: 'scripted' });
  const plan = b.steps.flatMap((s) => s.actors).find((a) => a.effect === 't:0.plan');
  assert.deepEqual(plan.stage.parts[0].pieces[0].source, { kind: 'frame', name: 'DATA_RULE', label: 'harness frame: DATA_RULE', fixed: true, filled: null, entry: 'data-rule',
    detail: 'message catalogue entry data-rule (packages/engine/messages.md), the same for every stage' });
  assert.equal(plan.stage.parts.find((p) => p.part === 'return').pieces[0].source.detail, 'message catalogue entry return-line (packages/engine/messages.md), filled in with this run\'s run');
});
