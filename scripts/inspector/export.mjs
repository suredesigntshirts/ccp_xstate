#!/usr/bin/env node
// Workflow Inspector exporter: one item of one journal root, replayed on one engine checkout, as a plain JSON bundle
// the page (page.html) renders. It shows what the engine recorded and says, never its own reading of the workflow:
// - the map is the engine's chart() of the workflow (its states and transitions, each named by its JSON pointer);
// - each step's ways out are the engine's explain(): the transitions it tried, in its order, and which tests failed;
// - a model run is a run folder with a stage record (stage.json); the prompt's pieces, their sources, who wrote the
//   task, the added context and the fields the host stamped come from that record.
// It refuses an engine checkout that cannot explain its transitions, and a journal whose model run has no stage
// record. When a step does not replay, the bundle says so and keeps what the journal itself recorded. Usage:
// docs/inspector.md.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safe } from '../../packages/engine/src/names.js';
import { upcast } from '../../packages/journal/src/index.js';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const readText = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
const readJson = (path) => { const t = readText(path); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } };
// Rows in today's kinds and fields, read through the journal's upcast. A row the upcaster changes (an older prompt or
// capture row) keeps the row as the file holds it in `written`, which is what the page shows; every other row is kept
// exactly as written.
const current = (row) => {
  const up = upcast(row);
  if (up.kind === row.kind && JSON.stringify(up.payload) === JSON.stringify(row.payload)) return row;
  return Object.defineProperty(up, 'written', { value: row });
};
const readRows = (path) => (readText(path) ?? '').split('\n').filter(Boolean).map((l) => { try { return current(JSON.parse(l)); } catch { return null; } }).filter(Boolean);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- The workflow map, from the engine's chart()

/**
 * Every state of a workflow and every transition, as the engine's chart() reads them: nodes { id: dotted path, name,
 * parent, depth, type, initial, description, needs, invokes } and edges { id: the transition's JSON pointer, from,
 * to, stays, kind ('on', 'after', 'done' or 'error'), event (the event name, the delay or the invoke id), guard,
 * description, actions }. eng is a loaded engine checkout (loadEngine).
 */
export function graphFrom(eng, spec) {
  const { nodes, transitions } = eng.chart(spec);
  const list = [...nodes.entries()].map(([id, st]) => {
    const cut = id.lastIndexOf('.');
    return {
      id, name: id.slice(cut + 1), parent: cut < 0 ? null : id.slice(0, cut), depth: id.split('.').length - 1,
      type: st.type ?? (st.states ? 'compound' : 'atomic'), initial: st.initial ? `${id}.${st.initial}` : null,
      description: st.description ?? null, needs: st.meta?.needs ?? [],
      invokes: (st.invoke == null ? [] : [st.invoke].flat()).map((i) => ({ id: i.id ?? null, src: i.src ?? null, input: i.input ?? null }))
    };
  });
  const edges = transitions.map((t) => ({
    id: t.at, from: t.state, to: t.after, stays: !t.def.target,
    kind: t.event != null ? 'on' : t.delay != null ? 'after' : t.on, event: t.event ?? t.delay ?? t.invoke ?? null,
    guard: t.guard, description: t.def.description ?? null, actions: [t.def.actions ?? []].flat()
  }));
  return { id: spec.id ?? null, description: spec.description ?? null, initial: spec.initial ?? null, nodes: list, edges };
}

/** The map of a workflow as the engine checkout at `checkout` charts it. */
export async function graphOf(checkout, spec) {
  const eng = await loadEngine(checkout);
  if (!eng.ok) throw new Error(eng.error);
  return graphFrom(eng, spec);
}

/** The active state paths of a snapshot value: "a" -> ["a"], { g: "v" } -> ["g.v"]. */
export function leavesOf(value, prefix = '') {
  if (value == null) return [];
  if (typeof value === 'string') return [prefix ? `${prefix}.${value}` : value];
  return Object.entries(value).flatMap(([k, v]) => leavesOf(v, prefix ? `${prefix}.${k}` : k));
}

// The engine's tried transitions, as the page lists them.
const waysOut = (tried) => tried.map((c) => ({ id: c.at, from: c.state, to: c.after, stays: c.stays, guard: c.guard, needs: c.needs, failing: c.failing, taken: c.taken, description: c.description }));

/** The label of an ignored event, from the transitions the engine tried for it (none taken). */
export function ignoredLabel(words, fromLeaves, listeners) {
  const where = fromLeaves.join(' + ') || 'its state';
  if (!listeners.length) return `The engine ignored this event (${words}): in ${where} nothing listens for it. Nothing changed.`;
  const owners = [...new Set(listeners.map((c) => c.from || '(any state)'))];
  const why = listeners.map((c) => {
    const to = c.stays ? '(stays)' : c.to;
    if (c.failing?.length) return `${c.failing.join(' and ')} failed (→ ${to})`;
    return `the way to ${to} was not taken`;
  });
  return `The engine ignored this event (${words}): ${owners.join(' and ')} ${owners.length > 1 ? 'listen' : 'listens'} for it, but ${why.join(', and ')}. Nothing changed.`;
}

// ---- Loading an engine checkout, and xstate as that checkout resolves it

// ---- Loading an engine checkout (main's or a lane's), and xstate as that checkout resolves it

// A workflow of the engine checkout as its own engine reads it (with its stage files), or null when that engine has no
// stage files (packages/engine/src/prompts.js).
export async function composedIn(checkout, name) {
  const at = join(checkout, 'packages/engine/src/prompts.js');
  if (!existsSync(at)) return null;
  const { readWorkflow } = await import(pathToFileURL(at).href);
  return readWorkflow(name, { dir: join(checkout, 'workflows') });
}

// The engine of a checkout: its spec.js (machineOf, hashOf, mapPaths), its chart() and explain(), its names.js, and
// xstate as that checkout resolves it. { ok: false, error } when it has none of these to give.
async function loadEngine(checkout) {
  const src = join(checkout, 'packages/engine/src');
  const missing = ['spec.js', 'stages.js', 'explain.js', 'names.js'].filter((f) => !existsSync(join(src, f)));
  if (missing.length) return { ok: false, error: `the engine at ${checkout} cannot explain its transitions (no packages/engine/src/${missing.join(', ')})` };
  try {
    const at = (f) => import(pathToFileURL(join(src, f)).href);
    const [spec, stages, explained, names] = await Promise.all([at('spec.js'), at('stages.js'), at('explain.js'), at('names.js')]);
    const req = createRequire(join(src, 'spec.js'));
    const pkgPath = req.resolve('xstate/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const exp = pkg.exports?.['.'];
    const esm = (typeof exp?.import === 'string' ? exp.import : exp?.import?.default) ?? pkg.module ?? pkg.main;
    const xstate = await import(pathToFileURL(join(dirname(pkgPath), esm)).href);
    return { ok: true, spec, xstate, chart: stages.chart, explain: explained.explain, names };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

const git = (dir, args) => { try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

// ---- The export

const SCRIPTED_NOTE = 'Scripted scenario: the agents here are test fixtures (their briefs and results are written in the test), GitHub is a fake local server, and no model ran.';

/**
 * One item as a bundle. engine: a checkout path; journal: a journal root (with items/); item: the item id (default:
 * the only or first item); workflow: a workflow JSON path (default: the pinned blob the journal names, else
 * <engine>/workflows/<name>.json); kind: 'real' | 'scripted'; label, origin, note: how the page names it.
 */
export async function exportRun({ engine, journal, item = null, workflow = null, kind = 'real', label = null, origin = null, note = null, id = null }) {
  engine = resolve(engine);
  journal = resolve(journal);
  const eng = await loadEngine(engine);
  if (!eng.ok) throw new Error(eng.error);
  const itemsDir = join(journal, 'items');
  const items = existsSync(itemsDir) ? readdirSync(itemsDir).filter((n) => n.endsWith('.jsonl')).map((n) => basename(n, '.jsonl')).sort() : [];
  item ??= items[0];
  if (!item) throw new Error(`no items/*.jsonl under ${journal}`);
  const rows = readRows(join(itemsDir, `${item}.jsonl`));
  const notes = [];
  const transitions = rows.filter((r) => r.kind === 'engine.transition');
  const first = transitions.find((r) => r.payload?.seq === 0) ?? transitions[0];
  const wfName = first?.payload?.workflow ?? null;

  // The workflow: the exact pinned bytes when the journal pins them, else the file given or the engine's own.
  let spec = null, wf = { name: wfName, source: null, path: null, sha256: null, note: null };
  const pin = String(wfName ?? '').match(/^(.+)@([0-9a-f]{64})$/);
  if (workflow) {
    const text = readText(workflow);
    if (text) { spec = JSON.parse(text); wf = { ...wf, source: 'file given', path: resolve(workflow), sha256: sha256(text) }; }
  }
  if (!spec && pin && existsSync(join(journal, 'blobs', pin[2]))) {
    const text = readFileSync(join(journal, 'blobs', pin[2]), 'utf8');
    spec = JSON.parse(text);
    wf = { ...wf, source: 'pinned bytes from the journal (blobs/)', path: join(journal, 'blobs', pin[2]), sha256: sha256(text) };
  }
  if (!spec && wfName) {
    const p = join(engine, 'workflows', `${(pin ? pin[1] : wfName)}.json`);
    const text = readText(p);
    if (text) {
      // A workflow that names stage files is read as the engine reads it: filled in from them, hashed as it is pinned.
      const read = await composedIn(engine, pin ? pin[1] : wfName);
      spec = read ? read.spec : JSON.parse(text);
      wf = { ...wf, source: "the engine checkout's workflows/ folder", path: p, sha256: read ? sha256(read.bytes) : sha256(text) };
    }
  }
  if (!spec) throw new Error(`cannot find the workflow ${wfName} for ${item}`);
  if (pin && wf.sha256 && wf.sha256 !== pin[2]) wf.note = `The journal pins ${pin[2].slice(0, 12)}, and this file hashes to ${wf.sha256.slice(0, 12)}: the run used other bytes.`;
  if (!pin && wf.source !== 'file given') wf.note = 'The journal names the workflow without pinning its bytes, so this is the file as it is in the engine checkout now; it may have changed since the run.';
  if (wfName) spec = { ...spec, id: wfName };
  const graph = graphFrom(eng, spec);

  // Replay on the engine checkout, to recover the context after every step (the journal keeps only a hash of it).
  const replay = { ok: true, error: null, mismatches: [], failedAt: null };
  let machine = null;
  try { machine = eng.spec.machineOf(spec); } catch (error) { replay.ok = false; replay.error = `machineOf failed: ${error.message}`; }
  const invokes = eng.chart(spec).invokes;
  const sessionsDirs = [join(journal, 'sessions'), join(journal, '..', 'sessions')].filter((d) => existsSync(d) && statSync(d).isDirectory());
  const sessionRows = sessionsDirs.flatMap((d) => readdirSync(d).filter((n) => n.endsWith('.jsonl')).flatMap((n) => readRows(join(d, n))));
  const { names } = eng;
  const runsDir = names.runsDir(journal, item);
  const runNames = existsSync(runsDir) ? readdirSync(runsDir) : [];
  // Runs recorded before stage records are not shown: a run folder with a prompt has one.
  const unrecorded = runNames.filter((n) => !existsSync(join(runsDir, n, 'stage.json')) && existsSync(names.promptFile(journal, names.runId(item, n))));
  if (unrecorded.length) throw new Error(`${item}: run ${unrecorded.join(', ')} has a prompt but no stage record (stage.json), so it was recorded before stage records and is not shown`);

  const steps = [];
  let snap = null, prevContext = {}, prevLeaves = [];
  const occurrences = {};
  const modelRuns = [];
  for (const row of transitions) {
    const p = row.payload ?? {};
    const applied = p.outcome === 'applied';
    const event = p.event ?? {};
    let value = null, context = null, replayHash = null;
    const before = snap;
    if (applied && machine && replay.failedAt == null) {
      try {
        [snap] = snap ? eng.xstate.transition(machine, snap, event) : eng.xstate.initialTransition(machine, event.input);
        value = snap.value; context = snap.context; replayHash = eng.spec.hashOf(snap);
        if (p.hash && p.hash !== replayHash) replay.mismatches.push(p.seq);
      } catch (error) {
        replay.failedAt = p.seq; replay.error = `step ${p.seq} did not replay: ${error.message}`;
      }
    }
    if (value == null) { try { value = JSON.parse(row.state); } catch { value = row.state ?? null; } }
    const toLeaves = applied ? leavesOf(value) : prevLeaves;
    // What the engine did with the event, in its own words: the transitions it tried and the one it took.
    const explained = p.seq === 0 || event.type === 'xstate.init' || !before || replay.failedAt != null ? null : eng.explain(spec, before, event);
    const edge = applied && explained?.taken ? graph.edges.find((x) => x.id === explained.taken) ?? null : null;
    const candidates = explained ? waysOut(explained.tried) : [];
    const changed = context ? [...new Set([...Object.keys(prevContext), ...Object.keys(context)])].filter((k) => !same(prevContext[k], context[k])) : [];
    const writes = (edge?.actions ?? []).flatMap((a) => (a.type === 'set' ? Object.entries(a.params ?? {}).map(([path, src]) => ({ path: `context.${path}`, source: src })) : a.type === 'inc' ? [{ path: `context.${a.params}`, source: '+1' }] : []));
    const tid = p.transition ?? `${item}#${p.seq}`;
    const related = rows.filter((r) => r !== row && r.payload && (r.payload.transition === tid || (typeof r.payload.run === 'string' && r.payload.run.startsWith(`${item}:${p.seq}.`))));

    // The actors this step started, from the journal's own effect rows.
    const starts = rows.filter((r) => r.kind === 'engine.effect' && r.payload?.transition === tid && r.payload?.phase === 'start');
    const actors = [];
    for (const s of starts) {
      const e = s.payload;
      if (e.type !== 'run') {
        const done = rows.find((r) => r.kind === 'engine.effect' && r.payload?.effect === e.effect && r.payload?.phase === 'done');
        actors.push({ effect: e.effect, type: e.type, timer: e.timer ?? null, due: e.due ?? null, outcome: done?.payload?.outcome ?? null });
        continue;
      }
      const name = String(e.effect).split(':').pop();
      const invokeId = name.slice(name.indexOf('.') + 1);
      const done = rows.find((r) => r.kind === 'engine.effect' && r.payload?.effect === e.effect && r.payload?.phase === 'done');
      const def = invokeOf(invokes, toLeaves, invokeId);
      const folder = runNames.find((n) => n === names.safe(name));
      const runPath = folder ? join(runsDir, folder) : null;
      const promptPath = runPath ? names.promptFile(journal, names.runId(item, name)) : null;
      const promptText = promptPath ? readText(promptPath) : null;
      const runJson = runPath ? readJson(join(runPath, 'run.json')) : null;
      let input = runJson?.input ?? null, inputFrom = runJson ? 'run.json (recorded when the run started)' : null;
      if (!input && def?.input && context) {
        try { input = eng.spec.mapPaths(def.input, { context }); inputFrom = 'recomputed by replaying the journal (the host does not store it)'; } catch { /* leave null */ }
      }
      // The stage record the engine writes for every model stage run (runs/<n>.<actor>/stage.json): resolved below.
      const stageRaw = runPath ? readJson(join(runPath, 'stage.json')) : null;
      const a = { effect: e.effect, type: 'run', state: def?.state ?? null, actor: e.actor ?? def?.src ?? invokeId, invoke: invokeId, inputMap: def?.input ?? null, input, inputFrom, outcome: done?.payload?.outcome ?? null, model: stageRaw != null };
      if (stageRaw) Object.defineProperty(a, 'stageRaw', { value: stageRaw, enumerable: false });
      if (!a.model) {
        const cardPath = names.cardFile(journal, names.runId(item, name));
        a.card = readJson(cardPath);
        a.hostNote = runPath ? 'It has a run folder but no stage record, so it is no model stage.' : null;
      } else {
        occurrences[a.actor] = (occurrences[a.actor] ?? 0) + 1;
        a.occurrence = occurrences[a.actor];
        a.layers = layersOf({ a, runPath, runJson, promptPath, promptText, stage: stageRaw, rows, sessionRows, sessionsDirs, kind });
        modelRuns.push({ key: `${a.actor} #${a.occurrence}`, step: p.seq, effect: a.effect });
      }
      actors.push(a);
    }
    steps.push({
      seq: p.seq, at: row.at, outcome: p.outcome ?? null, reason: p.reason ?? null, event, eventType: event.type ?? null,
      index: steps.length, from: prevLeaves, to: toLeaves, value, words: eventWords(event.type),
      label: applied ? labelOf(p.seq, event, edge, toLeaves) : ignoredLabel(eventWords(event.type), prevLeaves, candidates),
      atNote: steps.length && row.at && steps.at(-1).at && row.at < steps.at(-1).at ? (kind === 'scripted' ? 'This time comes from the event itself (the test fixture), not the clock, so it is earlier than the step before.' : 'This time is earlier than the step before: the journal stamps the row with the time inside the event.') : null, edge: edge ? { id: edge.id, ids: [edge.id], from: edge.from, to: edge.to, kind: edge.kind, guard: edge.guard, description: edge.description } : null,
      writes, candidates, context, changed, hash: p.hash ?? null, replayHash, hashOk: p.hash && replayHash ? p.hash === replayHash : null,
      source: p.source ?? row.source ?? null, actors, rows: related.map((r) => r.written ?? r)
    });
    if (applied && context) prevContext = context;
    if (applied) prevLeaves = toLeaves;
  }
  // After the fact: what became of each model run (the step that took its result, or the step that left it behind).
  const appliedSteps = steps.filter((s) => s.outcome === 'applied');
  for (const s of steps) for (const a of s.actors) {
    if (!a.model) continue;
    const L = a.layers;
    const state = a.state;
    const later = appliedSteps.filter((x) => x.seq > s.seq);
    const done = later.find((x) => x.eventType === `xstate.done.actor.${a.invoke}` || x.eventType === `xstate.error.actor.${a.invoke}`);
    const left = state ? later.find((x) => !x.to.some((l) => l === state || l.startsWith(`${state}.`))) : null;
    const pick = done && (!left || done.seq <= left.seq) ? done : left;
    L.after = pick ? { step: pick.seq, index: pick.index, eventType: pick.eventType, to: pick.to, label: pick.label, took: pick === done } : null;
    const o = outcomeOf({ trace: L.l5.trace, rows: L.l7.rows, files: L.l7.files, accepted: !!L.l6.raw, after: L.after, state, scripted: kind === 'scripted', agentId: L.agentId, prompt: L.l2.file });
    L.outcome = o;
    L.l5.story = o.story;
    L.l2.resumes = o.resumes;
    L.l2.resumeNote = resumeNote(o.resumes, L.l5.trace, L.l2.file);
    if (!L.l6.raw) {
      L.l6.missing = o.sentence;
      L.l6.short = o.short;
      L.l7.empty = L.l7.rows.length ? null : `No accept or refuse row for this run. ${o.sentence}`;
      if (!L.l5.trace.length) {
        L.l5.reason = (kind === 'scripted' ? 'None recorded: this is a scripted scenario, so no model ran and no tools were called. ' : (L.l5.reason ?? '') + ' ') + o.sentence;
      }
    }
  }
  // The stage records, with every producer and reader resolved to a run of this item where there is one.
  const itemRuns = steps.flatMap((s) => s.actors.filter((a) => a.type === 'run').map((a) => ({ run: a.effect, actor: a.actor, invoke: a.invoke, state: a.state, index: s.index, seq: s.seq, model: a.model, stage: a.stageRaw ?? null })));
  for (const s of steps) for (const a of s.actors) if (a.stageRaw) a.stage = stageView(a.stageRaw, { runs: itemRuns, steps });
  const flow = flowOf(itemRuns, steps);
  {
    const last = appliedSteps.at(-1);
    const where = last ? last.to.join(' + ') : '?';
    const finals = last ? last.to.every((l) => graph.nodes.find((n) => n.id === l)?.type === 'final' || graph.nodes.find((n) => n.id === l.split('.')[0])?.type === 'final') : false;
    const open = steps.flatMap((s) => s.actors.filter((a) => a.model && !a.layers.l6.raw && !a.layers.after).map((a) => {
      const st = a.layers.outcome?.status;
      return `${a.actor} #${a.occurrence} ${st === 'refused' ? `had returned ${times(a.layers.l7.rows.filter((r) => r.verdict === 'refused').length)}, and every return was refused` : st === 'no-return' ? 'had finished without calling the return tool' : st === 'failed' ? 'had failed' : 'had not returned a result'}`;
    }));
    var endNote = !last ? 'The journal has no applied step.' : finals ? `The item reached the final state ${where} at step ${last.seq}.`
      : `The journal stops at step ${last.seq} with the item in ${where}, not a final state` + (open.length ? `, while ${open.join(', and ')}.` : ', waiting for the next event.');
  }
  if (replay.mismatches.length) notes.push(`Replay on this engine gives a different state hash than the journal recorded at step(s) ${replay.mismatches.join(', ')}: the context shown there may not be what the engine had.`);
  if (!eng.ok || replay.failedAt != null) notes.push(`Could not replay ${replay.failedAt != null ? `from step ${replay.failedAt}` : 'at all'} (${replay.error}). Context is not shown where it could not be recovered; the journal rows, run folders and prompts still are.`);
  const commit = git(engine, ['rev-parse', '--short', 'HEAD']);
  const branch = git(engine, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return {
    id: id ?? `${safe(origin ?? 'run')}--${safe(item)}`,
    origin: origin ?? (kind === 'scripted' ? 'Scripted scenarios' : 'Real runs'),
    label: label ?? item, kind, note: note ?? (kind === 'scripted' ? SCRIPTED_NOTE : 'Real run: real Claude Code agents did this work.'),
    item, items, journal, engine: { path: engine, commit, branch, loaded: eng.ok, error: eng.ok ? null : eng.error },
    workflow: { ...wf, spec }, graph, replay, notes, sessionsFound: sessionsDirs.length > 0,
    final: steps.filter((s) => s.outcome === 'applied').at(-1)?.value ?? null, endNote, rowCount: rows.length, steps, modelRuns, flow
  };
}

// The invoke a run started from, from the engine's chart: an invoke with this id on an active state or one of its
// ancestors, else (the item moved on in the same step) any invoke with that id. { ...invoke, state: dotted path }.
function invokeOf(invokes, leaves, invokeId) {
  const at = (inv) => ({ ...inv, state: inv.state.join('.') });
  const mine = invokes.filter((i) => (i.id ?? i.src) === invokeId).map(at);
  return mine.find((i) => leaves.some((l) => l === i.state || l.startsWith(`${i.state}.`))) ?? mine[0] ?? null;
}

/** An event type in plain words: "xstate.done.actor.build" -> "the build actor finished". */
export function eventWords(type) {
  const t = String(type ?? '');
  if (t === 'xstate.init') return 'the item was started';
  if (t.startsWith('xstate.done.actor.')) return `the ${t.slice(18)} actor finished`;
  if (t.startsWith('xstate.error.actor.')) return `the ${t.slice(19)} actor failed`;
  if (t.startsWith('xstate.after.')) return `the ${t.slice(13).split('.')[0]} timer fired`;
  return t.replace(/[._]+/g, ' ').trim() || 'an event';
}

function labelOf(seq, event, edge, toLeaves) {
  const to = toLeaves.join(' + ') || '?';
  if (edge?.description) return edge.description;
  const type = event?.type ?? '?';
  const words = eventWords(type);
  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  if (type === 'xstate.init') return `The item starts in ${to}`;
  const why = edge?.guard ? `, and the guard "${edge.guard}" held` : '';
  const where = edge?.stays ? `the item stays in ${to}` : `the item moves to ${to}`;
  return `${cap}${why}; ${where}`;
}

// Who wrote each live-capture row, and what it means in plain words.
const TRACE_BY = { 'tool.call': 'agent', 'agent.finish': 'agent', 'agent.spawn': 'platform' };
const TRACE_WHAT = {
  'agent.spawn': 'agent started (SubagentStart)',
  'agent.finish': 'agent finished',
  'agent.final': "capture saved the agent's final message (a hash)",
  'agent.prompt': "capture saved the agent's prompt (a hash)"
};
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const isReturnTool = (tool) => /(^|[_\s])return$/i.test(String(tool ?? ''));
const hms = (at) => String(at ?? '').slice(11, 19);

/**
 * What a reader must know when an agent took in messages after its first one: the text of those messages is never
 * recorded, so the run's prompt file (`prompt`) is the first message, not everything the agent was told. Null when it
 * was never resumed.
 */
export function resumeNote(resumes = [], trace = [], prompt = 'prompt.md') {
  if (!resumes.length) return null;
  const n = resumes.length;
  const firstFinish = trace.find((r) => r.kind === 'agent.finish');
  const returnedFirst = trace.some((r) => r.kind === 'tool.call' && isReturnTool(r.tool) && firstFinish && r.at <= firstFinish.at);
  const bySpawn = resumes.filter((r) => r.how === 'spawn');
  const when = resumes.map((r) => hms(r.at ?? r.after)).filter(Boolean);
  const chip = `resumed ${times(n).replace('once', '1×').replace('twice', '2×').replace(' times', '×')}, message not recorded`;
  const how = bySpawn.length
    ? `The parent session resumed it with a new message (a new start row with the same agent id${when.length ? `, at ${when.join(', ')}` : ''}). The text of that message was not recorded.`
    : `It took in a further message after it finished (same agent id, no new start row${when.length ? `, after ${when.join(', ')}` : ''}), then handed back a chat message (SubagentHandback, of which only a hash and a size are kept). Who sent that further message and what it said were not recorded.`;
  const carries = resumes.every((r) => r.carries);
  return {
    chip,
    text: `This agent was resumed ${times(n)} after it finished ${returnedFirst ? '(it had already returned)' : 'without returning'}. ${how} So ${prompt} is the first message it was given, not everything it was told.` +
      (carries ? ' Its time and token counts carry on across the resume, which is how the capture shows it was one conversation and not a fresh start.' : '')
  };
}

/**
 * What became of one model run's return, in words, from the live capture (layer 5), the host rows (layer 7) and the
 * run folder: { status, sentence, short, finishes }. status: 'accepted' | 'refused' | 'no-return' | 'failed' |
 * 'left' | 'waiting'. Never says "still running" when the capture shows the agent finished, and never "never returned"
 * when the host refused a return.
 */
export function outcomeOf({ trace = [], rows = [], files = [], accepted = false, after = null, state = null, scripted = false, agentId = null, prompt = 'prompt.md' }) {
  const refusals = rows.filter((r) => r.verdict === 'refused');
  // A refusal of a handback (the agent ended its turn with a chat message, rule no-return) is not a refused return:
  // the agent never called the return tool, and the harness sent it back.
  const isHandbackRefusal = (r) => r.payload?.rule === 'no-return' || (r.payload?.tool != null && !isReturnTool(r.payload.tool));
  const returnRefusals = refusals.filter((r) => !isHandbackRefusal(r));
  const handbackRefusals = refusals.filter(isHandbackRefusal);
  // The capture's own hook refusals (sent back) also count as handbacks refused.
  const hookRefusals = trace.filter((r) => r.kind === 'refusal');
  const sentBack = files.find((f) => /^sent-back\b/.test(f.name));
  const acceptRow = rows.find((r) => r.verdict === 'accepted');
  const finishes = trace.filter((r) => r.kind === 'agent.finish');
  const returns = trace.filter((r) => r.kind === 'tool.call' && isReturnTool(r.tool));
  const failed = files.find((f) => /^failed\b/.test(f.name));
  const errored = after?.took && String(after.eventType ?? '').startsWith('xstate.error.actor.');
  const rules = [...new Set(returnRefusals.map((r) => r.payload?.rule).filter(Boolean))];
  const hbRules = [...new Set(handbackRefusals.map((r) => r.payload?.rule).filter(Boolean))];
  const leftWords = after && !after.took ? `the item left ${state ?? 'its state'} at step ${after.step} (${after.label})` : null;
  // Resumes: a later finish of the same agent took in a further message. Its text is never recorded.
  const resumes = [];
  // The story of the finishes: each one, whether the return tool was called before it, and what came between.
  let story = null;
  if (finishes.length) {
    const parts = [];
    let from = 0;
    for (const [i, f] of finishes.entries()) {
      const at = trace.indexOf(f);
      const seg = trace.slice(from, at);
      const ret = seg.find((r) => r.kind === 'tool.call' && isReturnTool(r.tool));
      const handback = seg.some((r) => r.kind === 'tool.call' && r.tool === 'SubagentHandback');
      const spawn = i > 0 && seg.find((r) => r.kind === 'agent.spawn');
      const prev = finishes[i - 1];
      const carries = i > 0 && f.ms != null && prev?.ms != null && f.ms > prev.ms;
      if (i > 0) resumes.push({ at: spawn ? spawn.at : null, after: prev?.at ?? null, how: spawn ? 'spawn' : handback ? 'handback' : 'other', carries });
      const carryWords = carries ? '; its time and token counts carry on from the first start' : '';
      const lead = i === 0 ? 'It'
        : spawn ? `At ${hms(spawn.at)} the parent session resumed this same agent (same agent id${carryWords}) with a new message. That message is not recorded: only ${prompt} and context.md are. It then`
          : `It was then resumed (same agent id, no new start row${carryWords}) by a further message whose text is not recorded${handback ? '; it handed back a chat message (SubagentHandback)' : ''}, and`;
      const secs = f.ms != null ? ` (${Math.round(f.ms / 1000)} s in)` : '';
      const before = trace.slice(0, from).some((r) => r.kind === 'tool.call' && isReturnTool(r.tool));
      parts.push(ret ? `${lead} called the return tool at ${hms(ret.at)} and finished at ${hms(f.at)}${secs}.`
        : before ? `${lead} finished again at ${hms(f.at)}${secs}; it had already returned, so nothing new went to the host.`
          : `${lead} finished at ${hms(f.at)}${secs} without calling the return tool${handback ? ' (it handed back a chat message instead)' : ''}.`);
      from = at + 1;
    }
    const tokens = finishes.filter((f) => f.tokens?.output != null).map((f) => f.tokens.output.toLocaleString('en-US'));
    const nHb = new Set([...handbackRefusals, ...hookRefusals].map((r) => hms(r.at))).size;
    story = (finishes.length > 1 ? `The agent finished ${times(finishes.length)}. ` : '') + parts.join(' ') +
      (finishes.length > 1 && tokens.length > 1 ? ` Output tokens at each finish: ${tokens.join(', then ')} (the capture's figures at each finish).` : '') +
      (returnRefusals.length ? ` The host refused ${returnRefusals.length} return(s) (layer 7).` : '') +
      (nHb ? ` The harness refused ${nHb === 1 ? 'a handback' : `${nHb} handbacks`} that came without a return${sentBack ? `: it sent the agent back once (${sentBack.name})` : ''}${failed ? `${sentBack ? ', then' : ', and'} marked the run failed (${failed.name})` : ''} (layer 7).` : '') +
      (!refusals.length && !hookRefusals.length && finishes.length > 1 ? ` The host refused nothing${acceptRow ? `; it had stored the result at ${hms(acceptRow.at)}` : ''}.` : '');
  }
  if (accepted || acceptRow) return { status: 'accepted', sentence: null, short: null, story, finishes: finishes.length, resumes };
  const lastFinish = finishes.at(-1);
  let status, sentence, short;
  if (failed || errored) {
    status = 'failed';
    const nReturns = returns.length;
    const hbTimes = [sentBack?.value?.at, ...handbackRefusals.map((r) => r.at)].filter(Boolean).map(hms);
    const failWords = failed ? `the host marked the run failed (${failed.name}${hbRules.length ? `, rule ${hbRules.join(', ')}` : ''})` : null;
    let how;
    if (nReturns) how = `It called the return tool ${times(nReturns)}, but no return was stored${failWords ? `, and ${failWords}` : ''}.`;
    else if (hbTimes.length) {
      const bits = [`handed back a chat message at ${hbTimes[0]}` + (sentBack ? ` and was sent back once (${sentBack.name})` : '')];
      if (hbTimes.length > 1) bits.push(`handed back again at ${hbTimes.at(-1)}`);
      if (failWords) bits.push(failWords.replace(/^the host/, 'the host'));
      how = `It never called the return tool. It ${bits.length > 1 ? bits.slice(0, -1).join(', ') + ', and ' + bits.at(-1) : bits[0]}.`;
    } else how = `It never called the return tool${failWords ? `, and ${failWords}` : ''}.`;
    sentence = how + (errored ? ` At step ${after.step} ${eventWords(after.eventType)} and the item moved to ${(after.to ?? []).join(' + ') || '?'}.` : leftWords ? ` Then ${leftWords}.` : '') + ' No result was stored.';
    short = nReturns ? `failed: returns not stored${rules.length ? ` (${rules.join(', ')})` : ''}` : `failed: never returned${hbRules.length ? ` (${hbRules.join(', ')})` : ''}`;
  } else if (returnRefusals.length) {
    status = 'refused';
    sentence = `It returned ${times(returnRefusals.length)}; ${returnRefusals.length > 1 ? 'each return was' : 'the return was'} refused${rules.length ? ` (${rules.join(', ')})` : ''}, so the host stored no result. ` +
      (leftWords ? `Then ${leftWords}.` : `The journal ends while the run waits for a new return${scripted ? ' (the test stopped here)' : ''}.`);
    short = `returned ${returnRefusals.length}×, refused${rules.length ? ` (${rules.join(', ')})` : ''}; no accepted result`;
  } else if (lastFinish) {
    const ret = returns.filter((r) => r.at <= lastFinish.at);
    status = 'no-return';
    sentence = ret.length
      ? `The agent called the return tool at ${hms(ret.at(-1).at)} and finished at ${hms(lastFinish.at)}, but the host wrote no accept or refuse row for it, so no result reached the item.`
      : `The agent finished at ${hms(lastFinish.at)} without calling the harness return tool (it handed back a chat message instead), so the host never received a result` +
        (handbackRefusals.length ? ` (the harness refused the handback${sentBack ? ' and sent it back' : ''})` : '') +
        (leftWords ? `; later ${leftWords}.` : ` and the item stayed in ${state ?? 'its state'}.`);
    short = ret.length ? 'called return; no host row' : 'finished without calling return';
  } else if (leftWords) {
    status = 'left';
    sentence = `No answer: ${leftWords} before this run returned.`;
    short = `no answer: the item left ${state ?? 'its state'} at step ${after.step}`;
  } else {
    status = 'waiting';
    sentence = !agentId && !scripted ? 'No answer: no agent was ever bound to this run, and the journal ends there.'
      : `No answer yet: the journal ends while this ${scripted ? 'run waits for a return (the test stopped here)' : 'agent was still running (the capture has no finish row for it)'}.`;
    short = 'no answer before the journal ends';
  }
  return { status, sentence, short, story, finishes: finishes.length, resumes };
}


// How the page colours a piece of a prompt, by the source its stage record names.
const PIECE_FROM = { frame: 'template', workflow: 'workflow', input: 'input' };
const FRAME_GAP = { from: 'template', note: "the harness frame's part headings and line breaks, between the pieces the stage record names" };

/**
 * A prompt file split into the stage record's pieces, in part order, each labelled from the source it records; the
 * text between pieces is the frame's headings and line breaks. When the file does not hold the pieces in that order,
 * one segment of unknown origin, and ok: false.
 */
export function segmentsFrom(text, parts) {
  const order = [...PART_ORDER.filter((k) => k in parts), ...Object.keys(parts).filter((k) => !PART_ORDER.includes(k))];
  const out = [];
  let pos = 0;
  for (const part of order) for (const piece of parts[part] ?? []) {
    const t = piece.text ?? '';
    const at = text.indexOf(t, pos);
    if (at < 0) return { ok: false, segments: [{ text, from: 'unknown', note: 'the prompt file does not hold the pieces its stage record names, in order' }] };
    if (at > pos) out.push({ text: text.slice(pos, at), ...FRAME_GAP });
    const src = sourceRef(piece.source, {}, { runs: [], steps: [] });
    if (t) out.push({ text: t, from: PIECE_FROM[src.kind] ?? 'unknown', note: `${part} part: ${src.label}${src.detail ? ` (${src.detail})` : ''}` });
    pos = at + t.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), ...FRAME_GAP });
  return { ok: true, segments: out };
}

// Who wrote one Task piece, from the producer its stage record names.
const writerOf = (piece) => {
  const p = piece.source?.producer ?? {};
  if (p.kind === 'stage') return { kind: 'stage', actor: p.actor, run: p.run, field: p.field ?? null, model: true, words: `the ${p.actor} agent (run ${p.run}${p.field ? `, its ${p.field} field` : ''})` };
  if (p.kind === 'literal') return { kind: 'workflow', at: p.at, words: `the workflow author, in the workflow JSON at ${p.at}` };
  if (piece.source?.workflow != null) return { kind: 'workflow', at: piece.source.workflow, words: `the workflow author, in ${piece.source.file ? `${piece.source.file}:${piece.source.line}` : `the workflow JSON at ${piece.source.workflow}`}` };
  if (p.kind === 'initial') return { kind: 'initial', words: 'whoever started the item (its start input)' };
  return { kind: p.kind ?? 'unknown', words: p.kind ? `a ${p.kind} value` : 'an unrecorded source' };
};

// The seven layers of one model run, from its run folder: stage.json, run.json, the prompt and context files, the
// result, the host's rows and the live capture.
function layersOf({ a, runPath, runJson, promptPath, promptText, stage, rows, sessionRows, sessionsDirs, kind }) {
  const agent = readJson(join(runPath, 'agent.json'));
  const result = readJson(join(runPath, 'result.json'));
  const added = readText(join(runPath, 'context.md'));
  const agentId = agent?.agentId ?? null;
  const runId = runJson?.run ?? a.effect;
  const scripted = kind === 'scripted';

  // Layer 2: who wrote the prompt, from the producers of its Task pieces; the rest is the harness frame.
  const taskPieces = stage.prompt?.parts?.task ?? [];
  const writers = taskPieces.map(writerOf);
  const stageWriter = writers.find((w) => w.kind === 'stage');
  const provenance = promptText == null ? { kind: 'missing', summary: `${basename(promptPath)} is missing from the run folder.` } : {
    kind: 'stage', scripted, writers, producer: stageWriter ? { actor: stageWriter.actor, run: stageWriter.run, field: stageWriter.field, model: true } : null,
    summary: (writers.length ? `The Task part of this prompt was written by ${[...new Set(writers.map((w) => w.words))].join(' and ')}; the rest is the harness's fixed frame around it.`
      : 'This stage has no Task part: its prompt is the harness frame around the rules, inputs and output its workflow names.') +
      ' The Stage view above names the source of every piece, from stage.json.' +
      (scripted && stageWriter ? ' In this scenario that "agent" is a test fixture: the text was typed into the test, not written by a model.' : '')
  };
  const split = promptText == null ? { ok: true, segments: [] } : segmentsFrom(promptText, stage.prompt?.parts ?? {});

  // Layer 3: added context, the record's context piece.
  const ctx = stage.context ?? null;
  const ctxSrc = ctx ? sourceRef(ctx.source, {}, { runs: [], steps: [] }) : null;
  const contextSegments = added == null ? [] : ctx && ctx.text === added
    ? [{ text: added, from: PIECE_FROM[ctxSrc.kind] ?? 'unknown', note: `${ctxSrc.label}${ctxSrc.detail ? ` (${ctxSrc.detail})` : ''}` }]
    : [{ text: added, from: 'unknown', note: 'context.md is not the context piece its stage record names' }];

  // Layer 6: what the host stored, and the paths the host stamped on it (stage.json stamped).
  const stored6 = result && typeof result === 'object' && 'result' in result ? result.result : result;
  const hostWritten = (stage.stamped ?? []).map((path) => ({ path, why: 'The stage record says the host stamped this on the result when it accepted it, so the host wrote it, not the agent.' }));
  // Layer 7 extras: other files the host left in the run folder (a send-back, a failure).
  const KNOWN = new Set([basename(promptPath), 'context.md', 'run.json', 'result.json', 'agent.json', 'spawn.json']);
  const extraFiles = existsSync(runPath) ? readdirSync(runPath).filter((n) => !KNOWN.has(n)).sort().map((n) => ({ name: n, value: readJson(join(runPath, n)) ?? readText(join(runPath, n)) })) : [];
  // Layer 5: what it did.
  const mine = agentId ? sessionRows.filter((r) => r.agent === agentId || r.payload?.agentId === agentId) : [];
  // The capture can hold the same row twice (a session file both under the journal and beside it): keep one.
  const seen = new Set();
  const trace = mine.filter((r) => !['hook.run'].includes(r.kind)).filter((r) => { const k = r.id ?? JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => ({ ...(r.payload ?? {}), at: r.at, kind: r.kind, by: r.kind === 'refusal' ? (r.source?.system === 'hook' || r.payload?.source === 'hook' ? 'harness hook' : 'harness') : TRACE_BY[r.kind] ?? 'capture',
      what: r.kind === 'tool.call' ? r.payload?.tool : r.kind === 'refusal' ? (r.payload?.rule === 'no-return' ? `refused a handback without a return (rule no-return) and sent the agent back${r.payload?.tool ? ` (${r.payload.tool})` : ''}` : `refused (${r.payload?.rule ?? 'no rule named'})`) : TRACE_WHAT[r.kind] ?? r.kind }))
    .sort((x, y) => String(x.at).localeCompare(String(y.at)));
  const hooks = mine.filter((r) => r.kind === 'hook.run').length;
  const finish = trace.filter((r) => r.kind === 'agent.finish').at(-1) ?? null;
  let traceReason = null;
  if (!trace.length) {
    traceReason = scripted ? 'None recorded: this is a scripted scenario, so no model ran and no tools were called.' + (result ? ' The test handed the harness this result directly.' : '')
      : !agentId ? 'None recorded: no agent was ever bound to this run (agent.json is missing), so it may never have started.'
        : !sessionsDirs.length ? 'None recorded: this journal kept no live session capture (no sessions/ folder), so tool calls cannot be shown.'
          : `None recorded: the live session capture has no rows for agent ${agentId}.`;
  }
  // Hash checks: the prompt the model received is the bytes in the run's prompt file.
  const promptHash = promptText != null ? sha256(promptText) : null;
  const checks = [];
  const stored = rows.find((r) => r.kind === 'prompt.stored' && r.payload?.run === runId);
  if (stored && promptHash) checks.push({ what: `${basename(promptPath)} matches the hash the host journaled when it wrote the prompt`, ok: stored.payload.hash === promptHash });
  if (stored && added != null) checks.push({ what: 'context.md matches the hash the host journaled', ok: stored.payload.contextHash === sha256(added) });
  const live = agentId && sessionRows.find((r) => r.kind === 'agent.prompt' && (r.agent === agentId || r.payload?.agentId === agentId));
  if (live && promptHash) checks.push({ what: `the prompt the harness's SubagentStart capture saw the agent start with hashes to ${basename(promptPath)}`, ok: live.payload.hash === promptHash });

  // Layer 7: the host's answer to the return.
  const verdicts = rows.filter((r) => r.payload?.run === runId && ['result.stored', 'refusal', 'result.refused', 'result.accepted', 'brief.stored'].includes(r.kind))
    .map((r) => ({ at: r.at, kind: r.kind, verdict: r.kind === 'refusal' || /refus/.test(r.kind) ? 'refused' : r.kind === 'result.stored' || r.kind === 'result.accepted' ? 'accepted' : 'info', payload: r.payload }));

  if (!split.ok) checks.push({ what: `${basename(promptPath)} holds the pieces its stage record names, in order`, ok: false });

  return {
    agentId, model: finish?.model ?? null, ms: finish?.ms ?? null, tokens: finish?.tokens ?? null, worktree: runJson?.worktree ?? null, runId, folder: runPath,
    l1: { note: scripted ? 'No model ran in this scenario, so there was no system prompt.' : 'Not recorded. The agent is a Claude Code subagent, so it also got Claude Code\'s own system prompt, its tool list and the CLAUDE.md files of its worktree. The harness writes none of that down.' },
    l2: { file: basename(promptPath), text: promptText, bytes: promptText == null ? 0 : Buffer.byteLength(promptText), sha256: promptHash, provenance, segments: split.segments, checks: checks.filter((c) => !/context\.md/.test(c.what)) },
    l3: { text: added, segments: contextSegments, checks: checks.filter((c) => /context\.md/.test(c.what)) },
    l4: { schema: runJson?.schema ?? null, defs: runJson?.defs ?? null, from: `run.json (the output schema the host checks the ${a.actor} return against; the agent saw it in the Output part of its prompt)` },
    l5: { trace, hooks, reason: traceReason, bound: !!agentId },
    l6: { result: stored6 ?? null, raw: result, hostWritten },
    l7: { rows: verdicts, files: extraFiles }
  };
}

// ---- The stage record: runs/<n>.<actor>/stage.json, which the engine leaves in each model stage's run folder. It
// says what went into the prompt and from where, which earlier run produced each input, and where the output went
// (finished, output or error, the paths the harness stamped, and wrote). The page shows it as the run's "Stage" view;
// nothing here is inferred, it is the engine's own record with each run id it names resolved to a run of this item.

const PART_ORDER = ['rules', 'inputs', 'task', 'output', 'return'];
const seqOfTransition = (t) => { const n = Number(String(t ?? '').split('#').pop()); return t != null && Number.isFinite(n) ? n : null; };
const RUN_KINDS = ['stage', 'effect', 'workflow'];

/** One producer of a stage record, as the page shows it: a label, a detail and a link to the producing run of this item when there is one. */
export function producerRef(p, ctx) {
  if (!p || typeof p !== 'object') return { kind: 'none', label: 'not recorded', detail: null, link: null };
  const runOf = (id) => ctx.runs.find((r) => r.run === id) ?? null;
  const stepOf = (t) => { const q = seqOfTransition(t); const s = q == null ? null : ctx.steps.find((x) => x.seq === q); return s ? { index: s.index, seq: s.seq } : null; };
  const linkOf = (id) => { const r = id ? runOf(id) : null; return r ? { run: r.run, index: r.index, seq: r.seq, actor: r.actor, invoke: r.invoke } : null; };
  const base = { kind: p.kind, at: p.at ?? null, transition: p.transition ?? null, step: stepOf(p.transition), link: null, detail: null };
  const field = p.field ?? null;
  switch (p.kind) {
    case 'stage': case 'effect': case 'workflow': {
      const what = p.kind === 'stage' ? `the ${p.actor} stage` : p.kind === 'effect' ? `the ${p.actor} host effect` : `the child workflow ${p.actor}`;
      return { ...base, run: p.run, actor: p.actor, field, link: linkOf(p.run), label: `${what}, run ${p.run}`,
        detail: field === 'error' ? 'its error' : field ? `its output field ${field}` : 'its whole output' };
    }
    case 'host':
      return { ...base, run: p.run, actor: p.actor, field, stamped: p.stamped, link: linkOf(p.run), label: `the host, on the ${p.actor} result of run ${p.run}`,
        detail: `the host stamped ${p.stamped} (${field}) on that result when it accepted it; the agent did not write it` };
    case 'initial':
      return { ...base, field, label: "the item's start input", detail: field ? `its field ${field}` : null };
    case 'literal':
      return { ...base, label: 'a literal in the workflow JSON', detail: p.event ? `set when the item took ${p.event}` : 'wired straight into the invoke input' };
    case 'event':
      return { ...base, event: p.event, field, label: `the ${p.event} event${p.source?.system ? ` (from ${p.source.system})` : ''}`, detail: field ? `its field ${field}` : 'the whole event' };
    case 'copy':
      return { ...base, from: p.from, of: producerRef(p.of, ctx), label: `a copy of ${p.from}`, detail: p.event ? `copied when the item took ${p.event}` : null };
    case 'default':
      return { ...base, label: 'the context default in the workflow JSON', detail: 'nothing had written this path yet' };
    case 'parts':
      return { ...base, default: p.default ?? null, label: `${(p.parts ?? []).length} part-writes onto a null default`,
        detail: 'no one wrote the whole value: it is made of these parts', parts: (p.parts ?? []).map((x) => ({ path: x.path, ...producerRef(x, ctx) })) };
    case 'none':
      return { ...base, label: 'nothing', detail: 'the invoke wires no context path or literal to it' };
    default:
      return { ...base, label: `a ${p.kind ?? 'unknown'} producer`, detail: JSON.stringify(p) };
  }
}

// True when a producer (raw, from stage.json) names run `id`, directly, through a copy, or as one of its parts.
const names = (p, id) => !!p && (p.run === id || (p.kind === 'copy' && names(p.of, id)) || (p.kind === 'parts' && (p.parts ?? []).some((x) => x.run === id)));

function sourceRef(src, byName, ctx) {
  if (!src || typeof src !== 'object') return { kind: 'unknown', label: 'not recorded' };
  // A record may name the message catalogue entry each piece was rendered from (packages/engine/messages.md); one
  // that names none reads without it.
  const entry = typeof src.entry === 'string' ? { entry: src.entry } : {};
  const where = entry.entry ? `message catalogue entry ${entry.entry} (packages/engine/messages.md)` : null;
  if (src.frame != null) return { kind: 'frame', name: src.frame, label: `harness frame: ${src.frame}`, fixed: !!src.fixed, filled: src.filled ?? null, ...entry,
    detail: src.filled ? `${where ? `${where}, ` : 'an engine template, '}filled in with this run's ${Object.keys(src.filled).join(', ')}` : src.fixed ? `${where ?? 'fixed text in the engine (packages/engine/src/stages.js)'}, the same for every stage` : 'engine text (the record does not say whether it is fixed or filled in)' };
  // A piece whose words came from a stage file is labelled by that file and line.
  if (src.workflow != null) return { kind: 'workflow', at: src.workflow, inlined: src.inlined ?? null, file: src.file ?? null, line: src.line ?? null, ...entry,
    label: src.file ? `${src.file}:${src.line}` : 'workflow JSON', detail: [src.inlined ? `with ${src.inlined} inlined` : null, where && `line shape: ${where}`].filter(Boolean).join('; ') || null };
  if (src.input != null) {
    const inp = byName[src.input];
    return { kind: 'input', input: src.input, meaningAt: src.meaningAt ?? null, ...entry, from: [src.from, inp?.from].find((f) => typeof f === 'string') ?? null, label: `input ${src.input}`,
      file: src.file ?? null, line: src.line ?? null, meaningFile: src.meaningFile ?? null, meaningLine: src.meaningLine ?? null,
      producer: inp?.producer ?? producerRef(src.producer, ctx) };
  }
  return { kind: 'unknown', label: JSON.stringify(src) };
}

const leavesText = (v) => (v == null ? null : typeof v === 'string' ? v : Array.isArray(v) ? v.join(' + ') : leavesOf(v).join(' + '));

/**
 * The page's Stage view of one stage.json: the prompt as parts (each piece with its source), the inputs (each with its
 * producer resolved to a run of this item), and what came out: the output, each context path written, the invokes
 * that could read it next, and the later runs of those invokes (read: true when that run's own record names this
 * run as the producer of that input; false when it read a newer value; null for a host effect, whose input is not
 * traced). ctx: { runs: [{ run, actor, invoke, state, index, seq, stage }], steps }.
 */
export function stageView(raw, ctx) {
  const inputs = (raw.inputs ?? []).map((i) => {
    const producer = producerRef(i.producer, ctx);
    const amended = (i.amended ?? []).map((x) => ({ path: x.path, by: producerRef(x.by, ctx) }));
    const literal = i.from && typeof i.from === 'object';
    return { name: i.name, meaning: i.meaning ?? null, meaningAt: i.meaningAt ?? null, value: i.value ?? null, from: literal ? null : i.from ?? null, literal, wiredAt: i.wiredAt ?? null, producer, amended };
  });
  const byName = Object.fromEntries(inputs.map((i) => [i.name, i]));
  const rawParts = raw.prompt?.parts ?? {};
  const order = [...PART_ORDER.filter((k) => k in rawParts), ...Object.keys(rawParts).filter((k) => !PART_ORDER.includes(k))];
  const parts = order.map((part) => ({ part, pieces: (rawParts[part] ?? []).map((p) => ({ text: p.text ?? '', source: sourceRef(p.source, byName, ctx) })) }));
  const fin = raw.finished ?? null;
  const endSeq = seqOfTransition(fin?.transition);
  const endStep = endSeq == null ? null : ctx.steps.find((s) => s.seq === endSeq);
  const wrote = (raw.wrote ?? []).map((w) => ({
    path: w.path, from: w.from ?? null, at: w.at ?? null, into: leavesText(w.into), replaced: w.replaced ? producerRef(w.replaced, ctx) : null,
    readBy: (w.readBy ?? []).map((rb) => {
      const later = ctx.runs.filter((r) => r.invoke === rb.invoke && r.state === rb.state && r.run !== raw.run && endSeq != null && r.seq >= endSeq);
      const judged = later.map((r) => {
        const inp = r.stage?.inputs?.find((x) => x.name === rb.input);
        const read = !r.stage ? null : !!inp && (names(inp.producer, raw.run) || (inp.amended ?? []).some((x) => names(x.by, raw.run)));
        return { run: r.run, index: r.index, seq: r.seq, actor: r.actor, invoke: r.invoke, read };
      });
      const yes = judged.filter((r) => r.read === true);
      return { actor: rb.actor, invoke: rb.invoke, state: rb.state, input: rb.input, reads: rb.reads, at: rb.at ?? null, kind: rb.kind ?? null, self: !!rb.self,
        runs: yes.length ? yes : judged.slice(0, 1), later: later.length };
    })
  }));
  return {
    run: raw.run, stage: raw.stage, invoke: raw.invoke, state: raw.state, invokeAt: raw.invokeAt ?? null,
    workflow: raw.workflow ?? null, started: raw.started ?? null, promptHash: raw.prompt?.hash ?? null,
    parts, inputs,
    finished: fin ? { transition: fin.transition ?? null, step: endStep ? { index: endStep.index, seq: endStep.seq } : null, event: fin.event ?? null, state: leavesText(fin.state), stopped: !!fin.stopped } : null,
    stamped: raw.stamped ?? [],
    output: 'output' in raw ? raw.output : undefined, error: 'error' in raw ? raw.error : undefined, hasOutput: 'output' in raw, hasError: 'error' in raw,
    wrote
  };
}

/**
 * The item's data flow, for the page's flow strip: every run with a stage record, every run that produced one of their
 * inputs, and every later run that read one of their outputs, in the order they started; and the context paths
 * between them. An edge from "start" is the item's start input. unverified: a host effect the chart says reads the
 * path, whose own input is not traced.
 */
export function flowOf(runs, steps) {
  const ctx = { runs, steps };
  const staged = runs.filter((r) => r.stage);
  if (!staged.length) return null;
  const edges = new Map();
  const add = (from, to, path, unverified = false) => {
    const k = `${from}\u0000${to}`;
    const e = edges.get(k) ?? { from, to, paths: [], unverified };
    if (path && !e.paths.includes(path)) e.paths.push(path);
    e.unverified = e.unverified && unverified;
    edges.set(k, e);
  };
  const strip = (p) => String(p ?? '').replace(/^context\./, '');
  for (const r of staged) {
    for (const i of r.stage.inputs ?? []) {
      const p = i.producer ?? {};
      const via = typeof i.from === 'string' ? strip(i.from) : null;
      if (RUN_KINDS.includes(p.kind) || p.kind === 'host') add(p.run, r.run, via);
      else if (p.kind === 'initial') add('start', r.run, via);
      else if (p.kind === 'copy' && p.of?.run) add(p.of.run, r.run, via);
      else if (p.kind === 'parts') for (const x of p.parts ?? []) if (x.run) add(x.run, r.run, x.path);
    }
    const view = stageView(r.stage, ctx);
    for (const w of view.wrote) for (const rb of w.readBy) for (const x of rb.runs) {
      if (x.read === null) add(r.run, x.run, strip(rb.reads), true);
    }
  }
  const used = new Set([...edges.values()].flatMap((e) => [e.from, e.to]));
  for (const r of staged) used.add(r.run);
  const status = (r) => (!r.stage ? null : !r.stage.finished ? 'open' : r.stage.finished.stopped ? 'stopped' : 'error' in r.stage ? 'error' : 'returned');
  const nodes = runs.filter((r) => used.has(r.run)).map((r) => ({ id: r.run, actor: r.actor, invoke: r.invoke, index: r.index, seq: r.seq, staged: !!r.stage, model: !!r.model, status: status(r) }));
  // A producer run that is not a run of this item (it should not happen) is still named.
  for (const id of used) if (id !== 'start' && !nodes.some((n) => n.id === id)) nodes.push({ id, actor: id, invoke: null, index: null, seq: null, staged: false, model: false });
  if (used.has('start')) nodes.unshift({ id: 'start', actor: 'start input', invoke: null, index: 0, seq: 0, staged: false, model: false });
  return { nodes, edges: [...edges.values()].filter((e) => e.from !== e.to) };
}

export async function exportRoot(opts) {
  const itemsDir = join(resolve(opts.journal), 'items');
  const items = readdirSync(itemsDir).filter((n) => n.endsWith('.jsonl')).map((n) => basename(n, '.jsonl')).sort();
  const out = [];
  for (const item of items) out.push(await exportRun({ ...opts, item, label: opts.label ? `${opts.label}${items.length > 1 ? ` · ${item}` : ''}` : item, id: opts.id ? `${opts.id}${items.length > 1 ? `--${safe(item)}` : ''}` : null }));
  return out;
}

// ---- CLI: node scripts/inspector/export.mjs --engine <checkout> --journal <root> [--item id] [--workflow f.json]
//      [--kind real|scripted] [--label text] [--origin text] [--out bundle.json]
const argv = process.argv.slice(2);
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const opt = {};
  for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!opt.engine || !opt.journal) {
    console.error('usage: export.mjs --engine <checkout> --journal <root> [--item id] [--workflow file] [--kind real|scripted] [--label text] [--origin text] [--out file]');
    process.exit(2);
  }
  const bundles = opt.item ? [await exportRun(opt)] : await exportRoot(opt);
  const json = JSON.stringify(bundles.length === 1 ? bundles[0] : bundles, null, 1);
  if (opt.out) writeFileSync(opt.out, json); else process.stdout.write(json);
}
