// Tests for the Workflow Inspector exporter and build (scripts/inspector, docs/inspector.md). The checks on real runs
// and lane checkouts skip when those folders are not on this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportRun, graphOf, leavesOf, segmentsOf, sourceOf, jsonChunks, stringPieces, piecesOf, labelGap, runValuesOf } from '../export.mjs';
import { build, capture, testNames, scenarioText } from '../build.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const LANE_A = '/home/user/lanes/A-minimalist';
const LANE_C = '/home/user/lanes/C-provenance';
const FRI = '/mnt/project-files/first-real-issue/harness/journal';
// The first real issue ran on the engine before the stage contract (engine-stage-contract), which today's engine refuses
// to load by design. Its export is replayed on that engine: main at 36da3e4, the last commit before the contract landed,
// checked out as a worktree of this repo when the commit is here (it is not in a shallow clone).
const PRE_CONTRACT = '36da3e4421c88e6d1762f1f671494a71f0b70940';
const preContractEngine = () => {
  try {
    execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${PRE_CONTRACT}^{commit}`], { stdio: 'ignore' });
  } catch {
    return null;
  }
  const dir = join(mkdtempSync(join(tmpdir(), 'pre-contract-')), 'engine');
  execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '--detach', dir, PRE_CONTRACT], { stdio: 'ignore' });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
};

// Every state of a workflow JSON, as dotted paths, and every transition it declares.
const statesOf = (spec, path = []) => Object.entries(spec.states ?? {}).flatMap(([k, s]) => [[...path, k].join('.'), ...statesOf(s, [...path, k])]);
const countTransitions = (spec) => {
  let n = Object.values(spec.on ?? {}).reduce((m, t) => m + [t].flat().length, 0);
  const walk = (s) => { for (const c of Object.values(s.states ?? {})) {
    for (const t of Object.values(c.on ?? {})) n += [t].flat().length;
    for (const t of Object.values(c.after ?? {})) n += [t].flat().length;
    if (c.always) n += [c.always].flat().length;
    for (const i of [c.invoke ?? []].flat()) { if (i.onDone) n += [i.onDone].flat().length; if (i.onError) n += [i.onError].flat().length; }
    if (c.onDone) n += [c.onDone].flat().length;
    walk(c);
  } };
  walk(spec);
  return n;
};
const workflowFiles = [join(REPO, 'workflows'), join(LANE_A, 'workflows'), join(LANE_C, 'workflows')]
  .filter(existsSync).flatMap((d) => readdirSync(d).filter((n) => n.endsWith('.json')).map((n) => join(d, n)));

test('graphOf finds every state and every transition of every workflow file, with no state names built in', () => {
  assert.ok(workflowFiles.some((f) => f.startsWith(join(REPO, 'workflows'))), 'main workflows found');
  for (const file of workflowFiles) {
    const spec = JSON.parse(readFileSync(file, 'utf8'));
    const g = graphOf(spec);
    assert.deepEqual(g.nodes.map((n) => n.id).sort(), statesOf(spec).sort(), `${file}: states`);
    assert.equal(g.edges.length, countTransitions(spec), `${file}: one edge per transition`);
    for (const e of g.edges) assert.ok(e.to != null, `${file}: target ${e.rawTarget} from ${e.from} resolves`);
    assert.ok(g.nodes.some((n) => n.invokes.length), `${file}: invokes found`);
  }
});

test('graphOf resolves sibling, child and #id targets, and leavesOf flattens nested and parallel values', () => {
  const spec = { id: 'm', initial: 'a', states: {
    a: { on: { GO: 'b', IN: '.x', ROOT: '#m.c' }, initial: 'x', states: { x: { on: { NEXT: 'y' } }, y: { type: 'final' } }, onDone: 'c' },
    b: { id: 'bee', always: { target: 'c', guard: 'g' } },
    c: { type: 'final', on: { BACK: '#bee' } }
  } };
  const g = graphOf(spec);
  const to = (from, event) => g.edges.find((e) => e.from === from && e.event === event)?.to;
  assert.equal(to('a', 'GO'), 'b');
  assert.equal(to('a', 'IN'), 'a.x');
  assert.equal(to('a', 'ROOT'), 'c');
  assert.equal(to('a.x', 'NEXT'), 'a.y');
  assert.equal(to('c', 'BACK'), 'b');
  assert.equal(g.edges.find((e) => e.kind === 'join').to, 'c');
  assert.equal(g.edges.find((e) => e.kind === 'always').guard, 'g');
  assert.deepEqual(leavesOf('a'), ['a']);
  assert.deepEqual(leavesOf({ gated: 'verifying' }), ['gated.verifying']);
  assert.deepEqual(leavesOf({ r: { r1: 'running', r2: 'ended' } }), ['r.r1.running', 'r.r2.ended']);
});

test('segmentsOf labels embedded JSON and literal text, and leaves the rest to the template', () => {
  const text = 'You are x. Your task: Do it well. Input {"a":1,"b":[2]} end.';
  const segs = segmentsOf(text, [{ text: 'Do it well', from: 'workflow' }, { value: { a: 1, b: [2], c: 3 }, subset: true, from: 'input' }], { from: 'template' });
  assert.equal(segs.map((s) => s.text).join(''), text, 'segments cover the text exactly');
  assert.deepEqual(segs.map((s) => s.from), ['template', 'workflow', 'template', 'input', 'template']);
  assert.equal(jsonChunks('x {"k":"}"} y').length, 1);
});

test('stringPieces splits template literals on their holes and skips comments and regexes', () => {
  const src = "// not 'this'\nconst a = `You are the ${actor} actor. Input ${JSON.stringify({ x: '}' })}.`;\nconst r = /'q'/g;\nconst b = 'it\\'s' + \"two\\n\";";
  assert.deepEqual(stringPieces(src), ['You are the ', ' actor. Input ', '}', '.', "it's", 'two\n']);
});

test('labelGap calls only engine string pieces template, fills holes with run values, and leaves the rest unknown', () => {
  const pieces = piecesOf({ 'a.js': "const t = `run ${r} (item ${i}) at ${sha}.`; const j = ['\\n'].join('.');" });
  const values = runValuesOf({ run: 'x:1.verify', item: 'x' }, { subject: 'a'.repeat(40) });
  const segs = labelGap(`run x:1.verify (item x) at ${'a'.repeat(40)}.\nrun x:1.verify (item zz) at 1234.`, pieces, values);
  assert.equal(segs.map((s) => s.text).join(''), `run x:1.verify (item x) at ${'a'.repeat(40)}.\nrun x:1.verify (item zz) at 1234.`);
  assert.deepEqual(segs.map((s) => s.from), ['template', 'run', 'template', 'run', 'template', 'input', 'template', 'run', 'template', 'unknown', 'template', 'unknown', 'template']);
  assert.deepEqual(segs.filter((s) => s.from === 'unknown').map((s) => s.text), ['zz', '1234']);
  assert.deepEqual(runValuesOf({ run: 'q', actor: 'v', invoke: 'v' }, { target: { url: 'https://github.com/o/r/pull/12' } }).map((v) => v.text).sort(), ['12', 'https://github.com/o/r/pull/12', 'o/r', 'q', 'v']);
});

// Every model step of every bundle the default sources build (main real runs, lane scenarios): each "template"
// segment of layers 2 and 3 must be made only of static string pieces of that engine's own src/*.js, each piece
// found verbatim (after unescaping) in that source; and no run value (a SHA, a GitHub URL, the run id, the item id,
// the worktree) may sit inside a template segment.
test('every template segment of every model step is literally the engine\'s own text', { timeout: 300000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-tpl-'));
  const conf = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
  conf.sources = conf.sources.filter((s) => existsSync(s.engine));
  if (!conf.sources.length) return;
  writeFileSync(join(dir, 'sources.json'), JSON.stringify(conf));
  const out = join(dir, 'out');
  await build({ config: join(dir, 'sources.json'), out, captureDir: join(dir, 'cap') });
  const txt = readFileSync(join(out, 'data.js'), 'utf8');
  const data = JSON.parse(txt.slice(txt.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  const engines = {};
  const engineOf = (path) => engines[path] ??= (() => {
    const srcDir = join(path, 'packages/engine/src');
    const sources = Object.fromEntries(readdirSync(srcDir).filter((n) => n.endsWith('.js')).map((n) => [n, readFileSync(join(srcDir, n), 'utf8')]));
    const raw = Object.values(sources).join('\n').replace(/\\(['"`$\\])/g, '$1').replace(/\\n/g, '\n');
    return { pieces: [...new Set(Object.values(sources).flatMap(stringPieces))], raw };
  })();
  const tiles = (text, pieces) => { // can text be cut into whole pieces? (memoised DP from the end)
    const ok = new Array(text.length + 1).fill(false); ok[text.length] = true;
    for (let k = text.length - 1; k >= 0; k--) ok[k] = pieces.some((p) => ok[k + p.length] && text.startsWith(p, k));
    return ok[0];
  };
  let models = 0, segs = 0;
  const bad = [];
  for (const r of data.runs) {
    const eng = engineOf(r.engine.path);
    for (const s of r.steps ?? []) for (const a of s.actors ?? []) {
      if (!a.model || !a.layers) continue;
      models++;
      const runVals = [a.layers.runId, a.layers.worktree, r.item].filter((v) => typeof v === 'string' && v.length >= 4);
      for (const L of ['l2', 'l3']) for (const seg of a.layers[L]?.segments ?? []) {
        if (seg.from !== 'template') continue;
        segs++;
        const where = `${r.id} ${a.effect} ${L}: ${JSON.stringify(seg.text).slice(0, 160)}`;
        if (!tiles(seg.text, eng.pieces.filter((p) => seg.text.includes(p)))) bad.push(`not made of engine string pieces: ${where}`);
        for (const p of eng.pieces.filter((p) => p.length >= 8 && seg.text.includes(p))) if (!eng.raw.includes(p)) bad.push(`piece not verbatim in source (${JSON.stringify(p).slice(0, 60)}): ${where}`);
        if (/\b[0-9a-f]{40}\b|https?:\/\//.test(seg.text)) bad.push(`a SHA or URL inside template: ${where}`);
        for (const v of runVals) if (new RegExp(`(^|[^\\w-])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w-])`).test(seg.text)) bad.push(`run value ${v} inside template: ${where}`);
      }
    }
  }
  assert.ok(models > 0 && segs > 0, 'some model steps were checked');
  assert.deepEqual(bad, []);
});

test('sourceOf extracts a const arrow and a function, with their comments', () => {
  const src = 'const a = 1;\n// writes it\nconst writtenBrief = (x) =>\n  `hi ${x}; there`;\n\nfunction contextOf(run) {\n  // don\'t\n  return { a: 1 };\n}\nconst z = 2;';
  assert.equal(sourceOf(src, 'writtenBrief'), '// writes it\nconst writtenBrief = (x) =>\n  `hi ${x}; there`;');
  assert.equal(sourceOf(src, 'contextOf'), "function contextOf(run) {\n  // don't\n  return { a: 1 };\n}");
  assert.equal(sourceOf(src, 'missing'), null);
});

test('fri-jsonl-lint-2: the brief prompt is the engine template; build and verify prompts were written by the brief agent', { skip: !existsSync(FRI) && 'no first-real-issue journal here' }, async (t) => {
  const engine = preContractEngine();
  if (!engine) return t.skip('the pre-contract commit is not in this clone');
  t.after(() => { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', engine], { stdio: 'ignore' }); rmSync(join(engine, '..'), { recursive: true, force: true }); });
  const b = await exportRun({ engine, journal: FRI, item: 'fri-jsonl-lint-2', kind: 'real' });
  assert.equal(b.replay.ok, true);
  assert.deepEqual(b.replay.mismatches, [], 'replay reaches every hash the journal recorded');
  const models = b.steps.flatMap((s) => s.actors.filter((a) => a.model).map((a) => ({ s, a })));
  assert.equal(models[0].a.layers.after.step, 1, 'the brief result was taken at step 1');
  assert.deepEqual(models.map((m) => m.a.actor), ['brief', 'build', 'verify'], 'model actors found from their run folders');
  const [brief, buildRun, verify] = models.map((m) => m.a.layers);
  assert.equal(brief.l2.provenance.kind, 'template');
  assert.match(brief.l2.text, /Do what the brief step asks/);
  assert.match(brief.l2.provenance.templateSource, /const writtenBrief/);
  for (const [layers, field] of [[buildRun, 'builder'], [verify, 'verifier']]) {
    const pv = layers.l2.provenance;
    assert.equal(pv.kind, 'passthrough');
    assert.equal(pv.inputPath, `context.briefs.${field}`);
    assert.equal(pv.producer.actor, 'brief');
    assert.equal(pv.producer.model, true);
    assert.equal(pv.producer.field, field);
    assert.equal(pv.producer.run, 'fri-jsonl-lint-2:0.brief');
  }
  for (const l of [brief, buildRun, verify]) {
    assert.ok(l.l5.trace.some((r) => r.kind === 'tool.call'), 'tool calls found in the live capture');
    assert.ok(l.model, 'model from agent.finish');
    assert.ok(l.l2.checks.length >= 2 && l.l2.checks.every((c) => c.ok), 'brief.md hashes match the journal and the capture');
    assert.ok(l.l7.rows.some((r) => r.verdict === 'accepted'));
    assert.ok(l.l3.text.includes('harness return tool'));
    assert.ok(l.l4.schema);
  }
  const host = b.steps.flatMap((s) => s.actors).filter((a) => a.type === 'run' && !a.model).map((a) => a.actor);
  assert.deepEqual(host, ['ask', 'merge'], 'host actors have no run folder with a brief');
  assert.ok(b.steps.find((s) => s.actors.some((a) => a.actor === 'ask')).actors.find((a) => a.actor === 'ask').card, 'the card json is shown');
  assert.deepEqual(b.steps[1].changed, ['briefs']);
  assert.ok(b.steps.every((s) => s.label && !/undefined/.test(s.label)));
});

test('a lane scenario is captured without editing the lane, exported as scripted, and says no model ran', { skip: !existsSync(join(LANE_A, 'packages/engine/test/tourney/Q1.test.js')) && 'no lane A checkout here' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-cap-'));
  const cap = capture({ engine: LANE_A, scenario: 'packages/engine/test/tourney/Q1.test.js', dir });
  assert.equal(cap.ok, true, cap.log);
  assert.equal(cap.roots.length, 1);
  assert.equal(cap.names.length, 1);
  const b = await exportRun({ engine: LANE_A, journal: cap.roots[0], kind: 'scripted' });
  assert.match(b.workflow.source, /pinned/);
  assert.equal(b.replay.mismatches.length, 0);
  const models = b.steps.flatMap((s) => s.actors.filter((a) => a.model));
  assert.ok(models.length >= 3);
  for (const a of models) {
    assert.match(a.layers.l5.reason, /scripted scenario/);
    assert.match(a.layers.l1.note, /No model ran/);
  }
  const verify = models.find((a) => a.actor === 'verify');
  assert.match(verify.layers.l2.provenance.summary, /test fixture/);
  assert.match(scenarioText(join(LANE_A, 'packages/engine/test/tourney/Q1.test.js')), /Q1 happy path/);
});

test('testNames reads top-level test names from TAP', () => {
  assert.deepEqual(testNames('TAP version 13\n# Subtest: one\nok 1 - one\n# Subtest: two\n'), ['one', 'two']);
});

test('build writes index.html and data.js from a config, and skips missing sources by name', { skip: !existsSync(FRI) && 'no first-real-issue journal here' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-build-'));
  const config = join(dir, 'sources.json');
  writeFileSync(config, JSON.stringify({ sources: [
    { origin: 'Real', kind: 'real', engine: REPO, journal: FRI, label: 'fri' },
    { origin: 'Gone', kind: 'real', engine: join(dir, 'nope'), journal: join(dir, 'nope'), label: 'missing' }
  ] }));
  const out = join(dir, 'out');
  const r = await build({ config, out, captureDir: join(dir, 'cap') });
  assert.equal(r.runs, 2);
  assert.equal(r.skipped.length, 1);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<title>Workflow Inspector<\/title>/);
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/, 'no external scripts or styles');
  const data = readFileSync(join(out, 'data.js'), 'utf8');
  assert.match(data, /^window\.INSPECTOR_DATA = /);
  const D = JSON.parse(data.slice('window.INSPECTOR_DATA = '.length).replace(/;\n$/, ''));
  for (const run of D.runs) assert.ok(D.workflows[run.workflow.key].graph.nodes.length);
  assert.ok(D.shelf.some((w) => w.file.endsWith('workflows/quick-fix.json') && w.runs.length === 2), 'every workflow file of the engine is on the shelf, with its runs');
});

test('hostFieldsOf flags keys the context tells the agent never to set, and keys the agent-facing schema removed', async () => {
  const { hostFieldsOf } = await import('../export.mjs');
  assert.deepEqual(hostFieldsOf({ pr: { url: 'u', at: 'a', key: 'o/r#1' } }, 'Never set key, gates or green on a reference: the host sets them.', null).map((h) => h.path), ['pr.key']);
  assert.deepEqual(hostFieldsOf({ result: 'PASS', attested: {} }, 'x', { removed: ['attested'] }).map((h) => h.path), ['attested']);
  assert.deepEqual(hostFieldsOf({ result: 'PASS' }, 'Return a result.', null), []);
});

const laneRun = async (lane, scenario, index = 0) => {
  const dir = mkdtempSync(join(tmpdir(), 'wi-cap-'));
  const cap = capture({ engine: lane, scenario: `packages/engine/test/tourney/${scenario}.test.js`, dir });
  assert.ok(cap.roots.length > index, cap.log);
  return exportRun({ engine: lane, journal: cap.roots[index], kind: 'scripted' });
};
const modelsOf = (b) => b.steps.flatMap((s) => s.actors.filter((a) => a.model));

test('lane A Q1: the brief prompt is the workflow author\'s task wrapped by the template, not "nobody"; the build result marks pr.key as host-written', { skip: !existsSync(join(LANE_A, 'packages/engine/test/tourney/Q1.test.js')) && 'no lane A checkout here' }, async () => {
  const b = await laneRun(LANE_A, 'Q1');
  const [brief, buildRun] = modelsOf(b);
  const pv = brief.layers.l2.provenance;
  assert.equal(pv.kind, 'template+workflow');
  assert.deepEqual(pv.literals, ['task']);
  assert.equal(pv.state, 'briefing');
  assert.doesNotMatch(pv.summary, /nobody|No person or agent/i);
  assert.match(pv.summary, /workflow author/);
  assert.ok(brief.layers.l2.segments.some((s) => s.from === 'workflow'));
  assert.equal(buildRun.actor, 'build');
  const key = buildRun.layers.l6.hostWritten.find((h) => h.path === 'pr.key');
  assert.ok(key, 'pr.key is stamped by the host');
  assert.match(key.why, /engine code writes this field .*packages\/engine\/src\/actors\.js line \d+: ref\.key =/);
  assert.doesNotMatch(key.why, /very likely|inferred/);
  assert.ok(!buildRun.layers.l6.hostWritten.some((h) => h.path === 'pr.url'));
});

test('lane C Q1 verify: the agent-facing schema has no attested, and attested in the stored result is marked host-written', { skip: !existsSync(join(LANE_C, 'packages/engine/test/tourney/Q1.test.js')) && 'no lane C checkout here' }, async () => {
  const b = await laneRun(LANE_C, 'Q1');
  const verify = modelsOf(b).find((a) => a.actor === 'verify');
  const l4 = verify.layers.l4;
  assert.ok(l4.shownInContext);
  assert.ok(!('attested' in (l4.schema.properties ?? {})));
  assert.ok(!(l4.schema.required ?? []).includes('attested'));
  assert.deepEqual(l4.diff.removed, ['attested']);
  assert.ok((l4.hostSchema.required ?? []).includes('attested'));
  assert.ok(verify.layers.l6.hostWritten.some((h) => h.path === 'attested'));
  assert.equal(modelsOf(b)[0].layers.l2.provenance.kind, 'template', 'lane C\'s brief has no authored task: nobody wrote it');
  const briefAttested = modelsOf(b)[0].layers.l6.hostWritten.find((h) => h.path === 'attested');
  assert.ok(briefAttested, 'the brief result\'s attested is host-written too');
  assert.match(briefAttested.why, /engine code stamps it .*packages\/engine\/src\/attest\.js line \d+/);
  assert.doesNotMatch(briefAttested.why, /very likely|inferred/);
});

test('stampOf finds where the engine spreads a result and sets a key; hostFieldsOf then states it firmly', async () => {
  const { stampOf, hostFieldsOf } = await import('../export.mjs');
  const src = { 'attest.js': 'a\n  return { output: { ...result, attested: { run } } };' };
  assert.deepEqual(stampOf(src, 'attested'), { file: 'packages/engine/src/attest.js', line: 2, text: 'return { output: { ...result, attested: { run } } };' });
  assert.equal(stampOf(src, 'other'), null);
  const nested = { 'actors.js': '// ref.gates = old\n  if (gates.length) ref.gates = gates;\n  if (ref.green == null) x();' };
  assert.equal(stampOf(nested, 'gates', { nested: true }).line, 2, 'an assignment, not a comment');
  assert.equal(stampOf(nested, 'green', { nested: true }), null, 'a comparison is not an assignment');
  const [h] = hostFieldsOf({ attested: {} }, 'Don\'t include an "attested" field: the host writes it.', null, src);
  assert.match(h.why, /engine code stamps it/);
  const [g] = hostFieldsOf({ attested: {} }, 'Don\'t include an "attested" field: the host writes it.', null, {});
  assert.match(g.why, /very likely/);
});

test('the page never tells a scripted run that Claude Code started its agent', () => {
  const page = readFileSync(new URL('../page.html', import.meta.url), 'utf8');
  const at = page.indexOf('first message Claude Code started the agent with');
  assert.ok(at > 0);
  assert.match(page.slice(at - 400, at), /scripted \? 'The exact text the engine wrote/);
});

test('lane C Q3: a verify run that never returned says so, and does not claim the test handed over a result', { skip: !existsSync(join(LANE_C, 'packages/engine/test/tourney/Q3.test.js')) && 'no lane C checkout here' }, async () => {
  const b = await laneRun(LANE_C, 'Q3');
  const open = modelsOf(b).filter((a) => !a.layers.l6.raw);
  assert.ok(open.length >= 1);
  for (const a of open) {
    assert.doesNotMatch(a.layers.l5.reason, /handed/);
    assert.match(a.layers.l5.reason, /no answer: the item left gated\.verifying at step \d+/i);
    assert.match(a.layers.l6.missing, /left gated\.verifying at step \d+/);
  }
});

test('lane C Q5: the step that skips awaitingMerge names the needs that failed, from the engine\'s own guards', { skip: !existsSync(join(LANE_C, 'packages/engine/test/tourney/Q5.test.js')) && 'no lane C checkout here' }, async () => {
  const b = await laneRun(LANE_C, 'Q5');
  const step = b.steps.find((s) => s.eventType === 'xstate.done.actor.verify');
  const merge = step.candidates.find((c) => c.to === 'gated.awaitingMerge');
  assert.equal(merge.taken, false);
  assert.ok(merge.failing.includes('verifiedHead'));
  assert.equal(step.candidates.at(-1).taken, true);
  assert.equal(step.edge.then.kind, 'join');
  assert.equal(step.thenCandidates.at(-1).to, 'replanning');
});

const TRR = '/mnt/project-files/toy-run-returns/harness/journal';

test('ignored events name the listeners whose guards failed (lane C Q3 step 3, lane A Q3 test 2 step 6), and say "nothing listens" only when nothing does', { skip: !(existsSync(LANE_C) && existsSync(LANE_A)) && 'no lane checkouts here' }, async () => {
  const c = await laneRun(LANE_C, 'Q3', 0);
  const s3 = c.steps[3];
  assert.equal(s3.outcome, 'refused');
  assert.deepEqual(s3.candidates.map((x) => [x.from, x.to, x.failing]), [['gated', 'building', ['redOnHead']], ['gated', 'replanning', ['redOnHead']]]);
  assert.doesNotMatch(s3.label, /nothing listens/);
  assert.match(s3.label, /gated listens for it, but redOnHead failed \(→ building\)/);
  const a = await laneRun(LANE_A, 'Q3', 1);
  const s6 = a.steps[6];
  assert.equal(s6.outcome, 'refused');
  assert.doesNotMatch(s6.label, /nothing listens/);
  assert.match(s6.label, /replanning listens for it, but replan failed \(→ briefing\), and drop failed \(→ dropped\)/);
  const { ignoredLabel } = await import('../export.mjs');
  assert.match(ignoredLabel('x', ['a'], []), /in a nothing listens for it/);
});

test('ar2: an agent that finished without calling the return tool is not "still running", and capture rows are not host accepts', { skip: !existsSync(TRR) && 'no toy-run-returns journal here' }, async () => {
  const b = await exportRun({ engine: REPO, journal: TRR, item: 'ar2', kind: 'real' });
  const L = b.steps[0].actors.find((a) => a.model).layers;
  assert.equal(L.outcome.status, 'no-return');
  assert.match(L.l6.missing, /finished at 03:39:32 without calling the harness return tool/);
  assert.match(L.l7.empty, /without calling the harness return tool/);
  for (const t of [L.l6.missing, L.l7.empty, b.endNote]) assert.doesNotMatch(t, /still running|never returned/);
  assert.match(b.endNote, /finished without calling the return tool/);
  const stored = L.l5.trace.filter((r) => r.kind === 'result.stored' || r.kind === 'brief.stored');
  assert.ok(stored.length && stored.every((r) => r.by === 'capture' && /capture saved/.test(r.what)));
});

test('fri-jsonl-lint-2: two finishes with no refusal are not called "sent back"', { skip: !existsSync(FRI) && 'no first-real-issue journal here' }, async () => {
  const b = await exportRun({ engine: REPO, journal: FRI, item: 'fri-jsonl-lint-2', kind: 'real' });
  const L = b.steps[0].actors.find((a) => a.model).layers;
  assert.match(L.l5.story, /finished twice/);
  assert.match(L.l5.story, /refused nothing; it had stored the result at 03:24:31/);
  assert.doesNotMatch(L.l5.story, /sent back/);
});

test('lane C Q5 test 2: a verifier whose return was refused says it returned and was refused, never "never returned"', { skip: !existsSync(LANE_C) && 'no lane C checkout here' }, async () => {
  const b = await laneRun(LANE_C, 'Q5', 1);
  const v = modelsOf(b).find((a) => a.actor === 'verify');
  assert.equal(v.layers.outcome.status, 'refused');
  for (const t of [v.layers.l5.reason, v.layers.l6.missing, v.layers.l6.short, b.endNote]) assert.doesNotMatch(t, /never returned|still running|still waiting/);
  assert.match(v.layers.l6.missing, /returned once; the return was refused \(attested-reserved\)/);
  assert.match(v.layers.l6.short, /refused \(attested-reserved\)/);
  assert.match(b.endNote, /every return was refused/);
});

test('ar4: an agent that never called the return tool and whose run failed is not "refused" or "waiting for a new return"', { skip: !existsSync(TRR) && 'no toy-run-returns journal here' }, async () => {
  const b = await exportRun({ engine: REPO, journal: TRR, item: 'ar4', kind: 'real' });
  const L = b.steps[0].actors.find((a) => a.model).layers;
  assert.notEqual(L.outcome.status, 'refused');
  assert.equal(L.outcome.status, 'failed');
  for (const t of [L.l6.missing, L.l6.short, L.l5.story]) {
    assert.doesNotMatch(t, /returned once|waits for a new return|refused \d+ return/);
  }
  assert.match(L.l6.missing, /never called the return tool/);
  assert.match(L.l6.missing, /sent back once \(sent-back\.json\)/);
  assert.match(L.l6.missing, /failed/);
  assert.match(L.l6.missing, /replanning/);
  assert.match(L.l6.short, /^failed: never returned \(no-return\)/);
  assert.match(L.l5.story, /refused 2 handbacks that came without a return: it sent the agent back once/);
  const hook = L.l5.trace.find((r) => r.kind === 'refusal');
  assert.equal(hook.by, 'harness hook');
  assert.match(hook.what, /sent the agent back/);
});

test('fri-jsonl-lint-2 verify: the agent was resumed with a message that was not recorded, and the page data says so', { skip: !existsSync(FRI) && 'no first-real-issue journal here' }, async () => {
  const b = await exportRun({ engine: REPO, journal: FRI, item: 'fri-jsonl-lint-2', kind: 'real' });
  const verify = b.steps.flatMap((s) => s.actors).find((a) => a.model && a.actor === 'verify').layers;
  assert.match(verify.l5.story, /parent session resumed this same agent/);
  assert.match(verify.l5.story, /not recorded/);
  assert.doesNotMatch(verify.l5.story, /started again|a new agent\.spawn row/);
  assert.ok(verify.l2.resumeNote, 'layer 2 carries a resume note');
  assert.match(verify.l2.resumeNote.text, /resumed once after it finished without returning/);
  assert.match(verify.l2.resumeNote.text, /not recorded/);
  assert.match(verify.l2.resumeNote.chip, /resumed 1×, message not recorded/);
  const build = b.steps.flatMap((s) => s.actors).find((a) => a.model && a.actor === 'build').layers;
  assert.equal(build.l2.resumeNote, null, 'an agent that finished once has no resume note');
  const page = readFileSync(join(REPO, 'scripts/inspector/page.html'), 'utf8');
  assert.match(page, /messages the parent session sends when it resumes an agent/);
});
