// Expect lines explained and true-to-record of plan item inspector-reads-records. Every committed item journal with
// engine transitions, and every journal the tourney scenarios Q1, Q3, Q5 and R1 leave at the checkout, is exported
// with the checkout's exportRun and checked against the verifier's own replay (machineOf and xstate, explain and
// failingOf called here) and against the run folders on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, SCENARIOS, TRIALS, committedItems, imp, leaves, nodeAt, rowsOf, scenarioItems, withTransitions, xstateOf } from './lib.mjs';

const engine = await imp(REPO, 'packages/engine/src/index.js');
const names = await imp(REPO, 'packages/engine/src/names.js');
const { exportRun } = await imp(REPO, 'scripts/inspector/export.mjs');
const xstate = await xstateOf(REPO);

const committed = committedItems();
const replayable = withTransitions(committed);
const scenario = SCENARIOS.flatMap((n) => scenarioItems(n));
const all = [...replayable, ...scenario];

const bundles = new Map();
const bundleOf = async (x) => {
  if (!bundles.has(x.rel)) bundles.set(x.rel, await exportRun({ engine: REPO, journal: x.root, item: x.item }));
  return bundles.get(x.rel);
};

// The spec the item ran: the pinned bytes when its journal pins them (checked against the pin), else the bundle's.
const specOf = (x, bundle) => {
  const first = rowsOf(x.file).find((r) => r.kind === 'engine.transition' && r.payload?.seq === 0);
  const pin = String(first?.payload?.workflow ?? '').match(/^(.+)@([0-9a-f]{64})$/);
  if (pin && existsSync(join(x.root, 'blobs', pin[2]))) {
    const bytes = readFileSync(join(x.root, 'blobs', pin[2]));
    assert.equal(names.sha256(bytes), pin[2], `${x.rel}: blob hashes to its pin`);
    assert.equal(bundle.workflow.sha256, pin[2], `${x.rel}: the bundle replays the pinned bytes`);
    return { ...JSON.parse(bytes), id: first.payload.workflow };
  }
  return bundle.workflow.spec;
};

const tally = { items: 0, applied: 0, ignored: 0, triedChecked: 0, notTaken: 0, scenarioItems: scenario.length };

test('committed journals and scenario journals are found', () => {
  assert.ok(replayable.length >= 200, `committed replayable items: ${replayable.length}`);
  for (const t of TRIALS) assert.ok(replayable.some((x) => x.root === join(REPO, t)), `trial ${t} is among them`);
  for (const n of SCENARIOS) assert.ok(scenario.some((x) => x.rel.startsWith(`${n}:`)), `scenario ${n} left a journal`);
});

test('explained: every step is the engine\'s explain, XState agrees, and every tried way out fails as failingOf says', async () => {
  for (const x of all) {
    const bundle = await bundleOf(x);
    const spec = specOf(x, bundle);
    const machine = engine.machineOf(spec);
    const transitions = rowsOf(x.file).filter((r) => r.kind === 'engine.transition');
    assert.equal(bundle.steps.length, transitions.length, `${x.rel}: one step per transition row`);
    let snap = null;
    tally.items++;
    transitions.forEach((row, i) => {
      const p = row.payload;
      const step = bundle.steps[i];
      const where = `${x.rel} row ${i} (seq ${p.seq}, ${p.event?.type})`;
      assert.equal(step.seq, p.seq, where);
      if (p.event?.type === 'xstate.init') {
        if (p.outcome === 'applied') [snap] = xstate.initialTransition(machine, p.event.input);
        return;
      }
      if (!snap) return;
      const ex = engine.explain(spec, snap, p.event);
      const scope = { context: snap.context, event: p.event };
      // The bundle's ways out are explain's tried list, entry for entry.
      assert.deepEqual(step.candidates.map((c) => [c.id, c.from, c.to, c.taken, c.failing]), ex.tried.map((t) => [t.at, t.state, t.after, t.taken, t.failing]), `${where}: candidates are explain's tried`);
      // Each tried transition: its failing tests are failingOf's on the context before the step; only the last can be taken.
      ex.tried.forEach((t, j) => {
        const def = pointer(spec, t.at);
        const target = nodeAt(spec, t.after);
        const failing = engine.failingOf(spec, def, target, scope);
        assert.deepEqual(t.failing, failing, `${where}: ${t.at} failing`);
        assert.deepEqual(step.candidates[j].failing, failing, `${where}: bundle ${t.at} failing`);
        assert.equal(t.taken, failing.length === 0, `${where}: ${t.at} taken exactly when nothing fails`);
        if (j < ex.tried.length - 1) assert.ok(failing.length > 0, `${where}: only the last tried can be taken`);
        tally.triedChecked++;
        if (!t.taken) tally.notTaken++;
      });
      const [next] = xstate.transition(machine, snap, p.event);
      if (p.outcome === 'applied') {
        tally.applied++;
        assert.ok(ex.taken, `${where}: explain names a taken transition`);
        assert.equal(step.edge?.id, ex.taken, `${where}: the bundle's taken way out is explain's`);
        const t = ex.tried.at(-1);
        const lands = leaves(next.value);
        assert.ok(lands.some((l) => l === t.after || l.startsWith(`${t.after}.`)), `${where}: XState lands in ${lands} under ${t.after}`);
        assert.equal(engine.hashOf(next), p.hash, `${where}: XState's next snapshot hashes to the journal's`);
        snap = next;
      } else {
        tally.ignored++;
        // An event the engine did not apply: the bundle lists explain's tried, and none is taken, whenever explain
        // says the machine itself would not move (the host can turn away an event the machine would take).
        assert.equal(step.edge, null, `${where}: no taken edge for an event not applied`);
        if (!ex.taken) assert.ok(step.candidates.every((c) => !c.taken), `${where}: none taken`);
        else tally.hostTurnedAway = (tally.hostTurnedAway ?? 0) + 1;
      }
    });
  }
  console.log('explained', JSON.stringify(tally));
});

// The transition a JSON pointer names in the workflow file.
function pointer(spec, at) {
  return at.split('/').slice(1).map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~')).reduce((v, k) => v?.[k], spec);
}

test('true-to-record: model runs, prompt segments, context and hostWritten come from the run folders', async () => {
  const PIECE = { frame: 'template', workflow: 'workflow', input: 'input' };
  const counts = { bundles: 0, folders: 0, model: 0, notModel: 0, pieces: 0, contexts: 0, stamped: 0 };
  for (const x of all) {
    const bundle = await bundleOf(x);
    counts.bundles++;
    const runsDir = names.runsDir(x.root, x.item);
    const folders = existsSync(runsDir) ? readdirSync(runsDir) : [];
    const runActors = bundle.steps.flatMap((s) => s.actors.filter((a) => a.type === 'run'));
    // A run folder with stage.json is shown as a model run, and one without is not.
    for (const f of folders) {
      counts.folders++;
      const name = f;
      const a = runActors.find((r) => names.safe(String(r.effect).split(':').pop()) === name);
      const recorded = existsSync(join(runsDir, f, 'stage.json'));
      if (!a) { assert.ok(!recorded, `${x.rel}: run folder ${f} has stage.json but no run in the bundle`); continue; }
      assert.equal(a.model, recorded, `${x.rel}: ${f} model flag is stage.json present`);
    }
    for (const a of runActors) {
      if (!a.model) { counts.notModel++; continue; }
      counts.model++;
      const runName = String(a.effect).split(':').pop();
      const dir = join(runsDir, names.safe(runName));
      const stage = JSON.parse(readFileSync(join(dir, 'stage.json'), 'utf8'));
      const promptPath = names.promptFile(x.root, names.runId(x.item, runName));
      const prompt = readFileSync(promptPath, 'utf8');
      const L = a.layers;
      const where = `${x.rel} ${runName}`;
      assert.equal(L.l2.segments.map((s) => s.text).join(''), prompt, `${where}: segments joined are the prompt file byte for byte`);
      const pieces = Object.entries(stage.prompt.parts).flatMap(([part, list]) => list.filter((p) => p.text).map((p) => ({ part, ...p })));
      const gap = "the harness frame's part headings and line breaks, between the pieces the stage record names";
      const shown = L.l2.segments.filter((s) => s.note !== gap);
      assert.equal(shown.length, pieces.length, `${where}: one segment per stage.json piece`);
      shown.forEach((s, i) => {
        const p = pieces[i];
        assert.equal(s.text, p.text, `${where}: segment ${i} is piece ${p.part}[${i}]`);
        assert.ok(s.note.startsWith(`${p.part} part: `), `${where}: segment ${i} names part ${p.part}: ${s.note}`);
        const kind = p.source.frame != null ? 'frame' : p.source.workflow != null ? 'workflow' : p.source.input != null ? 'input' : 'unknown';
        assert.equal(s.from, PIECE[kind] ?? 'unknown', `${where}: segment ${i} from its source kind`);
        const key = kind === 'frame' ? p.source.frame : kind === 'workflow' ? (p.source.file ? `${p.source.file}:${p.source.line}` : 'workflow JSON') : `input ${p.source.input}`;
        assert.ok(s.note.includes(key), `${where}: segment ${i} label names its source ${key}: ${s.note}`);
        counts.pieces++;
      });
      const ctxFile = join(dir, 'context.md');
      if (existsSync(ctxFile)) {
        const text = readFileSync(ctxFile, 'utf8');
        assert.equal(L.l3.segments.map((s) => s.text).join(''), text, `${where}: context segments are context.md`);
        assert.equal(stage.context?.text, text, `${where}: context.md is the record's context piece`);
        assert.equal(L.l3.segments.length, 1, `${where}: one context segment, the record's`);
        counts.contexts++;
      }
      assert.deepEqual(L.l6.hostWritten.map((h) => h.path), stage.stamped ?? [], `${where}: hostWritten is stage.json stamped`);
      counts.stamped += (stage.stamped ?? []).length;
    }
  }
  console.log('true-to-record', JSON.stringify(counts));
  assert.ok(counts.model > 0);
});
