#!/usr/bin/env node
// Workflow Inspector exporter: one item of one journal root, replayed on one engine checkout, as a plain JSON bundle
// the page (page.html) renders. Nothing here knows a workflow's state names or which actors are models:
// - the graph comes from the workflow JSON (states, on, after, always, invoke onDone/onError, a state's own onDone);
// - an actor is a model when its run has a folder with brief.md; every other started actor is host code;
// - step labels come from the transitions' "description" in the JSON, else from the event type and target.
// It degrades instead of failing: when the engine cannot be loaded or a step does not replay, the bundle says so and
// keeps what the journal itself recorded. Usage: docs/inspector.md.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const readText = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
const readJson = (path) => { const t = readText(path); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } };
const readRows = (path) => (readText(path) ?? '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const get = (root, path) => String(path).split('.').reduce((v, k) => v?.[k], root);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

// ---- The workflow graph, from the JSON alone

const asList = (t) => (t == null ? [] : [t].flat().map((x) => (typeof x === 'string' ? { target: x } : x)));
const invokesOf = (state) => (state.invoke == null ? [] : [state.invoke].flat());

/** Every state of a workflow as { id: dotted path, ... } and every transition as an edge. Generic over any XState JSON. */
export function graphOf(spec) {
  const nodes = [];
  const byXsId = {};
  const walk = (state, path, parent) => {
    for (const [name, child] of Object.entries(state.states ?? {})) {
      const id = [...path, name].join('.');
      nodes.push({
        id, name, parent, depth: path.length,
        type: child.type ?? (child.states ? 'compound' : 'atomic'),
        initial: child.initial ? `${id}.${child.initial}` : null,
        description: child.description ?? null,
        needs: child.meta?.needs ?? [],
        invokes: invokesOf(child).map((i) => ({ id: i.id ?? null, src: i.src ?? null, input: i.input ?? null }))
      });
      if (child.id) byXsId[child.id] = id;
      walk(child, [...path, name], id);
    }
  };
  walk(spec, [], null);
  const ids = new Set(nodes.map((n) => n.id));
  // A target is a sibling name, ".child" (a child of the source), "#id", or a dotted path below a sibling.
  const resolveTarget = (target, sourceId) => {
    if (target == null) return null;
    const t = String(target);
    if (t.startsWith('#')) {
      const [xs, ...rest] = t.slice(1).split('.');
      const base = xs === spec.id || xs === String(spec.id ?? '').split('@')[0] ? '' : byXsId[xs];
      if (base == null) return null;
      const id = [base, ...rest].filter(Boolean).join('.');
      return ids.has(id) ? id : null;
    }
    if (t.startsWith('.')) { const id = `${sourceId}${t}`; return ids.has(id) ? id : null; }
    const parent = sourceId.includes('.') ? sourceId.slice(0, sourceId.lastIndexOf('.')) : '';
    const id = parent ? `${parent}.${t}` : t;
    return ids.has(id) ? id : (ids.has(t) ? t : null);
  };
  const edges = [];
  const add = (sourceId, kind, event, list) => {
    asList(list).forEach((t, i) => {
      const target = [t.target].flat()[0] ?? null;
      edges.push({
        id: `e${edges.length}`, from: sourceId, to: target == null ? sourceId : resolveTarget(target, sourceId),
        rawTarget: target, stays: target == null, kind, event, order: i,
        guard: t.guard ?? null, description: t.description ?? null, actions: t.actions ?? [], reenter: !!t.reenter
      });
    });
  };
  const visit = (state, path) => {
    for (const [name, child] of Object.entries(state.states ?? {})) {
      const id = [...path, name].join('.');
      for (const [ev, list] of Object.entries(child.on ?? {})) add(id, 'on', ev, list);
      for (const [delay, list] of Object.entries(child.after ?? {})) add(id, 'after', delay, list);
      if (child.always) add(id, 'always', null, child.always);
      for (const inv of invokesOf(child)) {
        if (inv.onDone) add(id, 'done', inv.id ?? inv.src, inv.onDone);
        if (inv.onError) add(id, 'error', inv.id ?? inv.src, inv.onError);
      }
      if (child.onDone) add(id, 'join', null, child.onDone);
      visit(child, [...path, name]);
    }
  };
  visit(spec, []);
  for (const [ev, list] of Object.entries(spec.on ?? {})) add('', 'on', ev, list);
  return { id: spec.id ?? null, description: spec.description ?? null, initial: spec.initial ?? null, nodes, edges };
}

/** The active state paths of a snapshot value: "a" -> ["a"], { g: "v" } -> ["g.v"], parallel -> one per region. */
export function leavesOf(value, prefix = '') {
  if (value == null) return [];
  if (typeof value === 'string') return [prefix ? `${prefix}.${value}` : value];
  return Object.entries(value).flatMap(([k, v]) => leavesOf(v, prefix ? `${prefix}.${k}` : k));
}
const ancestorsOf = (id) => { const parts = id.split('.'); return parts.map((_, i) => parts.slice(0, parts.length - i).join('.')); };
const within = (leaf, node) => leaf === node || leaf.startsWith(`${node}.`);

// Which edge of the graph an event took: from an active state (or an ancestor), for that event, into the new state.
function matchEdge(graph, fromLeaves, event, toLeaves) {
  const type = event?.type ?? '';
  let kind = 'on', key = type;
  if (type.startsWith('xstate.done.actor.')) { kind = 'done'; key = type.slice(18); }
  else if (type.startsWith('xstate.error.actor.')) { kind = 'error'; key = type.slice(19); }
  else if (type.startsWith('xstate.after.')) { kind = 'after'; key = type.slice(13).split('.')[0]; }
  const sources = [...new Set(fromLeaves.flatMap(ancestorsOf)), ''];
  const depth = (id) => (id === '' ? -1 : id.split('.').length);
  const candidates = graph.edges.filter((e) => sources.includes(e.from) && e.kind === kind && e.event === key)
    .sort((x, y) => depth(y.from) - depth(x.from));
  const lands = (e) => (e.stays ? e.from === '' || fromLeaves.some((l) => within(l, e.from)) && toLeaves.some((l) => within(l, e.from)) : toLeaves.some((l) => within(l, e.to)));
  const hit = candidates.find(lands);
  if (hit) return hit;
  // Into a final child, then out through the parent's join (a compound state's own onDone), or on through an
  // eventless transition: the first edge plus the one that lands, as one chain.
  const node = (id) => graph.nodes.find((n) => n.id === id);
  const parentOf = (id) => (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null);
  for (const e of candidates) {
    if (!e.to) continue;
    // A join is taken only when the transition lands in a final child; an eventless one from the state it lands in.
    const next = graph.edges.find((x) => x.to && toLeaves.some((l) => within(l, x.to)) &&
      ((x.kind === 'join' && node(e.to)?.type === 'final' && ancestorsOf(parentOf(e.to) ?? '').includes(x.from)) ||
       (x.kind === 'always' && ancestorsOf(e.to).includes(x.from))));
    if (next) return { ...e, then: next };
  }
  return null;
}

// Every transition the engine tried for this event, in order, up to the one it took: each with its guard and the needs
// of the state it enters, and (when this engine exports failing() and the workflow names its guards) which held.
function candidatesOf({ graph, spec, eng, fromLeaves, event, taken, context, join = false, all = null }) {
  let kind = taken.kind, key = taken.event;
  const sources = [...new Set(fromLeaves.flatMap(ancestorsOf)), ''];
  const depth = (id) => (id === '' ? -1 : id.split('.').length);
  const list = graph.edges.filter((e) => (join ? e.kind === taken.kind && e.from === taken.from : sources.includes(e.from) && e.kind === kind && e.event === key))
    .sort((x, y) => depth(y.from) - depth(x.from) || x.order - y.order);
  const at = list.findIndex((e) => e.id === taken.id);
  const tried = all ?? (at >= 0 ? list.slice(0, at + 1) : [taken]);
  const node = (id) => graph.nodes.find((n) => n.id === id);
  const canCheck = eng.ok && typeof eng.spec.failing === 'function' && spec.meta?.guards;
  return tried.map((e) => {
    const needs = (e.stays ? node(e.from)?.needs : node(e.to)?.needs) ?? [];
    const names = [...(e.guard ? [e.guard] : []), ...needs];
    let failing = null;
    if (canCheck && names.length && context) {
      try {
        const after = applyActions(eng, context, event, e.actions);
        failing = eng.spec.failing(spec, names, { context: after, event });
      } catch { failing = null; }
    }
    return { id: e.id, from: e.from, to: e.to, stays: e.stays, guard: e.guard, needs, failing, taken: e.id === taken.id, description: e.description };
  });
}

// For an event the engine ignored: every transition on the active states and their ancestors (and the root) that
// listens for this event type, in the order the engine tries them, each with which of its guard and needs failed on the
// unchanged context. Empty only when nothing on that path listens for it at all.
export function listenersOf({ graph, spec, eng, fromLeaves, event, context }) {
  const type = event?.type ?? '';
  let kind = 'on', key = type;
  if (type.startsWith('xstate.done.actor.')) { kind = 'done'; key = type.slice(18); }
  else if (type.startsWith('xstate.error.actor.')) { kind = 'error'; key = type.slice(19); }
  else if (type.startsWith('xstate.after.')) { kind = 'after'; key = type.slice(13).split('.')[0]; }
  const sources = [...new Set(fromLeaves.flatMap(ancestorsOf)), ''];
  const depth = (id) => (id === '' ? -1 : id.split('.').length);
  const list = graph.edges.filter((e) => sources.includes(e.from) && e.kind === kind && e.event === key)
    .sort((x, y) => depth(y.from) - depth(x.from) || x.order - y.order);
  if (!list.length) return [];
  const fake = list.at(-1);
  return candidatesOf({ graph, spec, eng, fromLeaves, event, taken: { ...fake, id: '\u0000none', kind, event: key }, context, all: list });
}

/** The label of an ignored event, from its listeners (listenersOf). */
export function ignoredLabel(words, fromLeaves, listeners) {
  const where = fromLeaves.join(' + ') || 'its state';
  if (!listeners.length) return `The engine ignored this event (${words}): in ${where} nothing listens for it. Nothing changed.`;
  const owners = [...new Set(listeners.map((c) => c.from || '(any state)'))];
  const why = listeners.map((c) => {
    const to = c.stays ? '(stays)' : c.to;
    if (c.failing?.length) return `${c.failing.join(' and ')} failed (→ ${to})`;
    const names = [...(c.guard ? [c.guard] : []), ...c.needs];
    return names.length ? `${names.join(' and ')} did not hold (→ ${to})` : `the way to ${to} was not taken`;
  });
  return `The engine ignored this event (${words}): ${owners.join(' and ')} ${owners.length > 1 ? 'listen' : 'listens'} for it, but ${why.join(', and ')}. Nothing changed.`;
}

// The context as a transition's set/inc actions leave it (guards and needs are checked against that).
function applyActions(eng, context, event, actions) {
  const out = structuredClone(context);
  const put = (root, path, v) => { const ks = path.split('.'); let o = root; for (const k of ks.slice(0, -1)) o = o[k] ??= {}; o[ks.at(-1)] = v; };
  for (const a of actions ?? []) {
    if (a.type === 'set' && typeof eng.spec.mapPaths === 'function') for (const [path, v] of Object.entries(eng.spec.mapPaths(a.params ?? {}, { context: out, event }))) put(out, path, v);
    if (a.type === 'inc') put(out, a.params, (get(out, a.params) ?? 0) + 1);
  }
  return out;
}

// ---- Loading an engine checkout (main's or a lane's), and xstate as that checkout resolves it

async function loadEngine(checkout) {
  const specPath = join(checkout, 'packages/engine/src/spec.js');
  if (!existsSync(specPath)) return { ok: false, error: `no packages/engine/src/spec.js under ${checkout}` };
  try {
    const spec = await import(pathToFileURL(specPath).href);
    const req = createRequire(specPath);
    const pkgPath = req.resolve('xstate/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const exp = pkg.exports?.['.'];
    const esm = (typeof exp?.import === 'string' ? exp.import : exp?.import?.default) ?? pkg.module ?? pkg.main;
    const xstate = await import(pathToFileURL(join(dirname(pkgPath), esm)).href);
    const missing = ['machineOf', 'hashOf'].filter((n) => typeof spec[n] !== 'function');
    if (missing.length) return { ok: false, error: `spec.js does not export ${missing.join(', ')}` };
    const srcDir = join(checkout, 'packages/engine/src');
    const sources = Object.fromEntries(readdirSync(srcDir).filter((n) => n.endsWith('.js')).map((n) => [n, readText(join(srcDir, n)) ?? '']));
    return { ok: true, spec, xstate, specPath, actorsSource: sources['actors.js'] ?? null, sources };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

const git = (dir, args) => { try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

/** The source text of a named function or const arrow in a file, or null. Used to show the template that wrote a text. */
export function sourceOf(text, name) {
  if (!text) return null;
  const m = text.match(new RegExp(`(^|\\n)((?:export )?(?:const ${name}\\s*=|function ${name}\\s*\\())`));
  if (!m) return null;
  const start = m.index + m[1].length;
  // Include the comment lines right above it.
  let head = start;
  const before = text.slice(0, start).split('\n');
  before.pop();
  while (before.length && /^\s*\/\//.test(before.at(-1))) { head -= before.pop().length + 1; }
  const isFunction = /^(?:export )?function/.test(text.slice(start));
  let depth = 0, i = start, seen = false, inStr = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === '/' && text[i + 1] === '/') { const nl = text.indexOf('\n', i); i = nl < 0 ? text.length : nl - 1; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; seen = true; continue; }
    if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (isFunction && depth === 0 && c === '}') { i++; break; }
      continue;
    }
    if (!isFunction && depth === 0 && c === ';') { i++; break; }
    if (!isFunction && seen && depth === 0 && c === '\n' && text[i + 1] === '\n') break;
  }
  return text.slice(Math.max(0, head), i).trim();
}

/** A function's source plus every top-level function or const of the same file it names (one level deep). */
export function withHelpers(text, name) {
  const main = sourceOf(text, name);
  if (!main) return null;
  const names = [...new Set(main.replace(/\/\/.*$/gm, "").match(/\b[A-Za-z_$][\w$]*\b/g) ?? [])].filter((n) => n !== name);
  const helpers = names.filter((n) => new RegExp(`(^|\\n)(?:export )?(?:const ${n.replace(/\$/g, '\\$')}\\s*=|function ${n.replace(/\$/g, '\\$')}\\s*\\()`).test(text)).map((n) => sourceOf(text, n)).filter(Boolean);
  return [main, ...helpers].join('\n\n');
}

// ---- Where each part of a prompt came from

// The JSON objects and arrays embedded in a text, as { start, end, value }.
export function jsonChunks(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' && text[i] !== '[') continue;
    let depth = 0, inStr = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) { if (c === '\\') j++; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { if (--depth === 0) { end = j + 1; break; } }
    }
    if (end < 0) continue;
    try {
      const value = JSON.parse(text.slice(i, end));
      if (value && typeof value === 'object' && end - i >= 4) { out.push({ start: i, end, value }); i = end - 1; }
    } catch { /* not JSON */ }
  }
  return out;
}

// Does every key of part hold the same value in whole? (The input minus some keys, as a template prints it.)
const subsetOf = (part, whole) => part && whole && typeof part === 'object' && !Array.isArray(part) && Object.keys(part).length > 0 &&
  Object.entries(part).every(([k, v]) => k in whole && same(v, whole[k]));

/**
 * Split a text into labelled segments. `known` is a list of { from, note, value?, text? }: a JSON value matched
 * against embedded JSON chunks (exactly, or as a subset of an object), or a literal text found verbatim. Everything
 * not matched gets `rest`.
 */
export function segmentsOf(text, known, rest) {
  const marks = [];
  for (const chunk of jsonChunks(text)) {
    const hit = known.find((k) => 'value' in k && (same(chunk.value, k.value) || (k.subset && subsetOf(chunk.value, k.value))));
    if (hit) marks.push({ start: chunk.start, end: chunk.end, from: hit.from, note: hit.note });
  }
  for (const k of known.filter((x) => typeof x.text === 'string' && x.text.length >= 3)) {
    let at = text.indexOf(k.text);
    while (at >= 0) {
      if (!marks.some((m) => at < m.end && at + k.text.length > m.start)) marks.push({ start: at, end: at + k.text.length, from: k.from, note: k.note });
      at = text.indexOf(k.text, at + k.text.length);
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const out = [];
  let last = 0;
  for (const m of marks) {
    if (m.start < last) continue;
    if (m.start > last) out.push({ text: text.slice(last, m.start), ...rest });
    out.push({ text: text.slice(m.start, m.end), from: m.from, note: m.note });
    last = m.end;
  }
  if (last < text.length) out.push({ text: text.slice(last), ...rest });
  return out;
}

// Where in a value a string sits, as a dotted path ("builder"), or null.
function pathOfString(value, needle, path = []) {
  if (value === needle) return path.join('.') || '(the whole output)';
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { const p = pathOfString(v, needle, [...path, k]); if (p) return p; }
  }
  return null;
}

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
    if (text) { spec = JSON.parse(text); wf = { ...wf, source: "the engine checkout's workflows/ folder", path: p, sha256: sha256(text) }; }
  }
  if (!spec) throw new Error(`cannot find the workflow ${wfName} for ${item}`);
  if (pin && wf.sha256 && wf.sha256 !== pin[2]) wf.note = `The journal pins ${pin[2].slice(0, 12)}, and this file hashes to ${wf.sha256.slice(0, 12)}: the run used other bytes.`;
  if (!pin && wf.source !== 'file given') wf.note = 'The journal names the workflow without pinning its bytes, so this is the file as it is in the engine checkout now; it may have changed since the run.';
  if (wfName) spec = { ...spec, id: wfName };
  const graph = graphOf(spec);

  // Replay on the engine checkout, to recover the context after every step (the journal keeps only a hash of it).
  const eng = await loadEngine(engine);
  const replay = { ok: eng.ok, error: eng.ok ? null : eng.error, mismatches: [], failedAt: null };
  let machine = null;
  if (eng.ok) {
    try { machine = eng.spec.machineOf(spec); } catch (error) { replay.ok = false; replay.error = `machineOf failed: ${error.message}`; }
  }
  const sessionsDirs = [join(journal, 'sessions'), join(journal, '..', 'sessions')].filter((d) => existsSync(d) && statSync(d).isDirectory());
  const sessionRows = sessionsDirs.flatMap((d) => readdirSync(d).filter((n) => n.endsWith('.jsonl')).flatMap((n) => readRows(join(d, n))));
  const itemDir = join(itemsDir, safe(item));
  const runsDir = join(itemDir, 'runs');
  const runNames = existsSync(runsDir) ? readdirSync(runsDir) : [];
  const cardsDir = join(itemDir, 'cards');

  const steps = [];
  let snap = null, prevContext = {}, prevLeaves = [];
  const occurrences = {};
  const modelRuns = [];
  for (const row of transitions) {
    const p = row.payload ?? {};
    const applied = p.outcome === 'applied';
    const event = p.event ?? {};
    let value = null, context = null, replayHash = null;
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
    const edge = !applied || p.seq === 0 || event.type === 'xstate.init' ? null : matchEdge(graph, prevLeaves, event, toLeaves);
    const candidates = applied && edge ? candidatesOf({ graph, spec, eng, fromLeaves: prevLeaves, event, taken: edge, context: prevContext })
      : !applied ? listenersOf({ graph, spec, eng, fromLeaves: prevLeaves, event, context: prevContext }) : [];
    const thenCandidates = applied && edge?.then ? candidatesOf({ graph, spec, eng, fromLeaves: [edge.to], event, taken: edge.then, context: context ?? prevContext, join: true }) : [];
    const changed = context ? [...new Set([...Object.keys(prevContext), ...Object.keys(context)])].filter((k) => !same(prevContext[k], context[k])) : [];
    const writes = [...(edge?.actions ?? []), ...(edge?.then?.actions ?? [])].flatMap((a) => (a.type === 'set' ? Object.entries(a.params ?? {}).map(([path, src]) => ({ path: `context.${path}`, source: src })) : a.type === 'inc' ? [{ path: `context.${a.params}`, source: '+1' }] : []));
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
      const def = findInvoke(spec, toLeaves, invokeId);
      const folder = runNames.find((n) => n === safe(name));
      const runPath = folder ? join(runsDir, folder) : null;
      const brief = runPath ? readText(join(runPath, 'brief.md')) : null;
      const runJson = runPath ? readJson(join(runPath, 'run.json')) : null;
      let input = runJson?.input ?? null, inputFrom = runJson ? 'run.json (recorded when the run started)' : null;
      if (!input && def?.input && context) {
        try { input = eng.spec.mapPaths(def.input, { context }); inputFrom = 'recomputed by replaying the journal (the host does not store it)'; } catch { /* leave null */ }
      }
      const a = { effect: e.effect, type: 'run', state: def?.state ?? null, actor: e.actor ?? def?.src ?? invokeId, invoke: invokeId, inputMap: def?.input ?? null, input, inputFrom, outcome: done?.payload?.outcome ?? null, model: brief != null };
      if (!a.model) {
        const cardPath = join(cardsDir, `${safe(name)}.json`);
        a.card = readJson(cardPath);
        a.hostNote = runPath ? 'It has a run folder but no brief.md, so no prompt was written for it.' : null;
      } else {
        occurrences[a.actor] = (occurrences[a.actor] ?? 0) + 1;
        a.occurrence = occurrences[a.actor];
        a.layers = layersOf({ a, step: p.seq, runPath, runJson, brief, rows, sessionRows, sessionsDirs, kind, def, spec, steps: [...steps, { seq: p.seq, event, context, actors }], context, eng, toLeaves });
        modelRuns.push({ key: `${a.actor} #${a.occurrence}`, step: p.seq, effect: a.effect });
      }
      actors.push(a);
    }
    steps.push({
      seq: p.seq, at: row.at, outcome: p.outcome ?? null, reason: p.reason ?? null, event, eventType: event.type ?? null,
      index: steps.length, from: prevLeaves, to: toLeaves, value, words: eventWords(event.type),
      label: applied ? labelOf(p.seq, event, edge, toLeaves) : ignoredLabel(eventWords(event.type), prevLeaves, candidates),
      atNote: steps.length && row.at && steps.at(-1).at && row.at < steps.at(-1).at ? (kind === 'scripted' ? 'This time comes from the event itself (the test fixture), not the clock, so it is earlier than the step before.' : 'This time is earlier than the step before: the journal stamps the row with the time inside the event.') : null, edge: edge ? { id: edge.id, ids: [edge.id, ...(edge.then ? [edge.then.id] : [])], from: edge.from, to: edge.to, kind: edge.kind, guard: edge.guard, description: edge.description, then: edge.then ? { id: edge.then.id, from: edge.then.from, to: edge.then.to, kind: edge.then.kind, guard: edge.then.guard, description: edge.then.description } : null } : null,
      writes, candidates, thenCandidates, context, changed, hash: p.hash ?? null, replayHash, hashOk: p.hash && replayHash ? p.hash === replayHash : null,
      source: p.source ?? row.source ?? null, actors, rows: related
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
    const o = outcomeOf({ trace: L.l5.trace, rows: L.l7.rows, files: L.l7.files, accepted: !!L.l6.raw, after: L.after, state, scripted: kind === 'scripted', agentId: L.agentId });
    L.outcome = o;
    L.l5.story = o.story;
    L.l2.resumes = o.resumes;
    L.l2.resumeNote = resumeNote(o.resumes, L.l5.trace);
    if (!L.l6.raw) {
      L.l6.missing = o.sentence;
      L.l6.short = o.short;
      L.l7.empty = L.l7.rows.length ? null : `No accept or refuse row for this run. ${o.sentence}`;
      if (!L.l5.trace.length) {
        L.l5.reason = (kind === 'scripted' ? 'None recorded: this is a scripted scenario, so no model ran and no tools were called. ' : (L.l5.reason ?? '') + ' ') + o.sentence;
      }
    }
  }
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
    final: steps.filter((s) => s.outcome === 'applied').at(-1)?.value ?? null, endNote, rowCount: rows.length, steps, modelRuns
  };
}

// The invoke definition a run started from: an invoke with this id on an active state or one of its ancestors.
function findInvoke(spec, leaves, invokeId) {
  const nodeAt = (id) => id.split('.').reduce((s, k) => s?.states?.[k], spec);
  for (const leaf of leaves) for (const id of ancestorsOf(leaf)) {
    const hit = invokesOf(nodeAt(id) ?? {}).find((i) => (i.id ?? i.src) === invokeId);
    if (hit) return { ...hit, state: id };
  }
  // Not on an active state (the item moved on in the same step): any invoke with that id.
  const all = [];
  const walk = (s, path) => { for (const [k, c] of Object.entries(s.states ?? {})) { invokesOf(c).forEach((i) => all.push({ ...i, state: [...path, k].join('.') })); walk(c, [...path, k]); } };
  walk(spec, []);
  return all.find((i) => (i.id ?? i.src) === invokeId) ?? null;
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
  const why = edge?.guard ? `, and its guard ${edge.guard} held` : '';
  const where = edge?.stays ? `the item stays in ${to}` : `the item moves to ${to}`;
  return `${cap}${why}; ${where}`;
}

// Who wrote each live-capture row, and what it means in plain words. The capture's own result.stored and brief.stored
// rows are hashes the capture hook keeps of the agent's final message and prompt: not the harness accepting anything.
const TRACE_BY = { 'tool.call': 'agent', 'agent.finish': 'agent', 'agent.spawn': 'platform' };
const TRACE_WHAT = {
  'agent.spawn': 'agent started (SubagentStart)',
  'agent.finish': 'agent finished',
  'result.stored': "capture saved the agent's final message (a hash, not a harness accept)",
  'brief.stored': "capture saved the agent's prompt (a hash)"
};
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const isReturnTool = (tool) => /(^|[_\s])return$/i.test(String(tool ?? ''));
const hms = (at) => String(at ?? '').slice(11, 19);

/**
 * What a reader must know when an agent took in messages after its first one: the text of those messages is never
 * recorded, so brief.md is the first message, not everything the agent was told. Null when it was never resumed.
 */
export function resumeNote(resumes = [], trace = []) {
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
    text: `This agent was resumed ${times(n)} after it finished ${returnedFirst ? '(it had already returned)' : 'without returning'}. ${how} So brief.md is the first message it was given, not everything it was told.` +
      (carries ? ' Its time and token counts carry on across the resume, which is how the capture shows it was one conversation and not a fresh start.' : '')
  };
}

/**
 * What became of one model run's return, in words, from the live capture (layer 5), the host rows (layer 7) and the
 * run folder: { status, sentence, short, finishes }. status: 'accepted' | 'refused' | 'no-return' | 'failed' |
 * 'left' | 'waiting'. Never says "still running" when the capture shows the agent finished, and never "never returned"
 * when the host refused a return.
 */
export function outcomeOf({ trace = [], rows = [], files = [], accepted = false, after = null, state = null, scripted = false, agentId = null }) {
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
        : spawn ? `At ${hms(spawn.at)} the parent session resumed this same agent (same agent id${carryWords}) with a new message. That message is not recorded: only brief.md and context.md are. It then`
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

// The seven layers of one model run.
function layersOf({ a, step, runPath, runJson, brief, rows, sessionRows, sessionsDirs, kind, def, spec, steps, context, eng, toLeaves }) {
  const agent = readJson(join(runPath, 'agent.json'));
  const result = readJson(join(runPath, 'result.json'));
  const added = readText(join(runPath, 'context.md'));
  const agentId = agent?.agentId ?? null;
  const runId = runJson?.run ?? a.effect;
  const input = runJson?.input ?? a.input ?? {};
  const actorsSrc = eng.actorsSource ?? null;
  const scripted = kind === 'scripted';

  // Layer 2: who wrote the prompt.
  const briefPath = typeof def?.input?.brief === 'string' ? def.input.brief : null;
  const literals = Object.entries(def?.input ?? {}).filter(([, v]) => v && typeof v === 'object' && 'value' in v && typeof v.value === 'string')
    .map(([k, v]) => ({ key: k, text: v.value }));
  let provenance;
  if (brief == null) provenance = { kind: 'missing', summary: 'brief.md is missing from the run folder.' };
  else if (typeof input?.brief === 'string' && input.brief && input.brief === brief) {
    // Passed through: find the step that put this text into the context, and the run whose result it was.
    let producer = null;
    if (briefPath?.startsWith('context.')) {
      const inner = briefPath.slice(8);
      const k = steps.findIndex((s) => s.context && get(s.context, inner) === brief);
      if (k >= 0) {
        const s = steps[k];
        const ev = s.event ?? {};
        const field = pathOfString(ev.output ?? ev, brief);
        const by = ev.type?.startsWith('xstate.done.actor.') ? ev.type.slice(18) : null;
        const run = by ? [...steps.slice(0, k)].reverse().flatMap((x) => x.actors).find((x) => x.invoke === by) : null;
        producer = { step: s.seq, event: ev.type, invoke: by, actor: run?.actor ?? by, run: run?.effect ?? null, model: !!run?.model, field };
      }
    }
    const who = producer?.model ? `the ${producer.actor} agent` : producer?.event === 'xstate.init' ? 'whoever started the item (its start input)' : producer ? `the ${producer.actor ?? producer.event} step` : 'an earlier step';
    provenance = {
      kind: 'passthrough', inputPath: briefPath, producer, scripted,
      summary: `Written by ${who}${producer?.run ? ` (run ${producer.run})` : ''}, not by the harness${producer?.field ? `: it is the ${producer.field} field of what that step returned, which reached the item at step ${producer.step}` : ''}. The workflow maps ${briefPath ?? 'a context value'} into this actor's input.brief, and the host passes it through unchanged.` +
        (scripted && producer?.model ? ' In this scenario that "agent" is a test fixture: the text was typed into the test, not written by a model.' : '')
    };
  } else {
    const fromTemplate = sourceOf(actorsSrc, 'writtenBrief');
    const used = literals.filter((l) => l.text.length >= 3 && brief.includes(l.text));
    const where = `state ${def?.state ?? '?'}, invoke ${a.invoke}`;
    const seen = fromTemplate ? 'the engine\'s template writtenBrief() (packages/engine/src/actors.js)' : 'what is presumably the engine\'s fill-in template (its code could not be read from this checkout, so this is inferred from the run folder)';
    provenance = used.length ? {
      kind: 'template+workflow', scripted, literals: used.map((l) => l.key), state: def?.state ?? null, invoke: a.invoke,
      share: Math.round(100 * used.reduce((n, l) => n + l.text.length, 0) / Math.max(1, brief.length)),
      summary: `The instructions in this prompt were written by the workflow author, in the workflow JSON (${where}, ${used.map((l) => `input.${l.key}`).join(', ')}). The input had no brief text, so ${seen} wrapped those instructions; the rest is the actor input as JSON.`
    } : {
      kind: 'template', scripted, literals: [],
      summary: `No person or agent wrote this prompt for this step: the input had no brief text, so the host filled ${seen} with the actor input. The only step-specific words are the actor name and its input as JSON; the workflow JSON gives this actor no instructions of its own.`
    };
    provenance.templateSource = fromTemplate;
    if (!fromTemplate) provenance.templateNote = 'writtenBrief() was not found in this engine\'s actors.js, so the template code cannot be shown.';
  }
  const inputMinus = { ...input };
  const promptKnown = [
    ...literals.map((l) => ({ text: l.text, from: 'workflow', note: `literal "${l.key}" in the workflow JSON` })),
    { value: input, subset: true, from: 'input', note: 'the actor input as JSON, computed from the context by the invoke input map' }
  ];
  const promptSegments = brief == null ? [] : provenance.kind === 'passthrough'
    ? [{ text: brief, from: 'passthrough', note: provenance.summary }]
    : segmentsOf(brief, promptKnown, { from: 'template', note: 'template text in the engine code (writtenBrief)' });

  // Layer 3: added context.
  const schema = runJson?.schema ?? spec.meta?.actors?.[a.actor] ?? null;
  const defs = runJson?.defs ?? spec.meta?.schemas ?? null;
  const ctxKnown = [
    { value: schema, from: 'workflow', note: `the output schema, from the workflow JSON (meta.actors.${a.actor})` },
    ...(defs && Object.keys(defs).length ? [{ value: defs, from: 'workflow', note: 'shared schema definitions, from the workflow JSON (meta.schemas)' }] : []),
    { value: inputMinus, subset: true, from: 'input', note: 'the actor input as JSON' },
    ...[runJson?.run, runJson?.worktree, runJson?.branch].filter(Boolean).map((t) => ({ text: t, from: 'run', note: 'a value of this run, set by the host' }))
  ];
  // The schema the agent was shown: a schema-like JSON object in context.md. When it differs from the schema the host
  // stores (run.json), the difference is named, and the agent-facing one is marked as the workflow's, transformed.
  const schemaLike = (v) => v && typeof v === 'object' && !Array.isArray(v) && (v.properties || Array.isArray(v.required)) && (v.type === 'object' || v.properties);
  const shown = added == null ? null : (jsonChunks(added).find((c) => schemaLike(c.value) && !same(c.value, defs))?.value ?? null);
  const agentSchema = shown ?? null;
  const schemaDiff = agentSchema && schema && !same(agentSchema, schema) ? schemaDifference(schema, agentSchema) : null;
  if (agentSchema && schemaDiff) ctxKnown.unshift({ value: agentSchema, from: 'workflow', note: `the output schema from the workflow JSON (meta.actors.${a.actor}), changed by the engine before it was shown: ${schemaDiff.text}` });
  const contextSegments = added == null ? [] : segmentsOf(added, ctxKnown, { from: 'template', note: 'fixed text in the engine code (contextOf and the helpers it calls)' });

  // Layer 6: what the host stored, and which of its fields the host wrote itself (the agent was told not to set them).
  const stored6 = result && typeof result === 'object' && 'result' in result ? result.result : result;
  const hostWritten = hostFieldsOf(stored6, added, schemaDiff, eng.sources);
  // Layer 7 extras: other files the host left in the run folder (a send-back, a failure).
  const KNOWN = new Set(['brief.md', 'context.md', 'run.json', 'result.json', 'agent.json', 'spawn.json']);
  const extraFiles = runPath && existsSync(runPath) ? readdirSync(runPath).filter((n) => !KNOWN.has(n)).sort().map((n) => ({ name: n, value: readJson(join(runPath, n)) ?? readText(join(runPath, n)) })) : [];

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
  // Hash checks: the prompt the model received is the bytes in brief.md.
  const briefHash = brief != null ? sha256(brief) : null;
  const checks = [];
  const stored = rows.find((r) => r.kind === 'brief.stored' && r.payload?.run === runId && r.payload?.contextHash);
  if (stored && briefHash) checks.push({ what: 'brief.md matches the hash the host journaled when it wrote the brief', ok: stored.payload.hash === briefHash });
  if (stored && added != null) checks.push({ what: 'context.md matches the hash the host journaled', ok: stored.payload.contextHash === sha256(added) });
  const live = agentId && sessionRows.find((r) => r.kind === 'brief.stored' && (r.agent === agentId || r.payload?.agentId === agentId));
  if (live && briefHash) checks.push({ what: 'the prompt the live capture saw the agent start with hashes to brief.md', ok: live.payload.hash === briefHash });

  // Layer 7: the host's answer to the return.
  const verdicts = rows.filter((r) => r.payload?.run === runId && ['result.stored', 'refusal', 'result.refused', 'result.accepted'].includes(r.kind) || (r.kind === 'brief.stored' && r.payload?.run === runId && r.payload?.role && !r.payload?.contextHash))
    .map((r) => ({ at: r.at, kind: r.kind, verdict: r.kind === 'refusal' || /refus/.test(r.kind) ? 'refused' : r.kind === 'result.stored' || r.kind === 'result.accepted' ? 'accepted' : 'info', payload: r.payload }));

  return {
    agentId, model: finish?.model ?? null, ms: finish?.ms ?? null, tokens: finish?.tokens ?? null, worktree: runJson?.worktree ?? null, runId, folder: runPath,
    l1: { note: scripted ? 'No model ran in this scenario, so there was no system prompt.' : 'Not recorded. The agent is a Claude Code subagent, so it also got Claude Code\'s own system prompt, its tool list and the CLAUDE.md files of its worktree. The harness writes none of that down.' },
    l2: { text: brief, bytes: brief == null ? 0 : Buffer.byteLength(brief), sha256: briefHash, provenance, segments: promptSegments, checks: checks.filter((c) => !/context\.md/.test(c.what)) },
    l3: { text: added, segments: contextSegments, templateSource: withHelpers(actorsSrc, 'contextOf'), checks: checks.filter((c) => /context\.md/.test(c.what)) },
    l4: { schema: agentSchema ?? schema, hostSchema: schemaDiff ? schema : null, diff: schemaDiff, defs, shownInContext: !!agentSchema, from: schemaDiff ? `workflow file (meta.actors.${a.actor}), with the fields the host writes removed by the engine` : `workflow file (its list of actor output shapes, meta.actors.${a.actor})` },
    l5: { trace, hooks, reason: traceReason, bound: !!agentId },
    l6: { result: stored6 ?? null, raw: result, hostWritten },
    l7: { rows: verdicts, files: extraFiles }
  };
}

// What the host-validated schema has that the agent-facing one lacks (top-level properties and required keys).
function schemaDifference(hostSchema, agentSchema) {
  const hp = Object.keys(hostSchema?.properties ?? {}), ap = Object.keys(agentSchema?.properties ?? {});
  const hr = hostSchema?.required ?? [], ar = agentSchema?.required ?? [];
  const removed = hp.filter((k) => !ap.includes(k));
  const added = ap.filter((k) => !hp.includes(k));
  const notRequired = hr.filter((k) => !ar.includes(k) && !removed.includes(k));
  const parts = [];
  if (removed.length) parts.push(`${removed.map((k) => `"${k}"`).join(', ')} removed`);
  if (added.length) parts.push(`${added.map((k) => `"${k}"`).join(', ')} added`);
  if (notRequired.length) parts.push(`${notRequired.map((k) => `"${k}"`).join(', ')} no longer required`);
  return { removed, added, notRequired, text: parts.join('; ') || 'other changes inside the schema' };
}

const STOP = new Set(['a', 'an', 'the', 'on', 'or', 'and', 'any', 'in', 'to', 'of', 'field', 'fields', 'reference', 'references', 'it', 'its', 'your', 'result']);
/**
 * Fields of a stored result that the host wrote, not the agent: top-level keys the agent-facing schema removed, and keys
 * the added context tells the agent never to set ("Never set key, gates or green", "Don't include an \"attested\" field").
 * Returns [{ path, why }].
 */
export function hostFieldsOf(result, contextText, schemaDiff, engineSources) {
  if (!result || typeof result !== 'object') return [];
  const out = [];
  const add = (path, why) => { if (!out.some((x) => x.path === path)) out.push({ path, why }); };
  for (const k of schemaDiff?.removed ?? []) if (k in result) add(k, `The host validates its stored result against a schema with "${k}", but the schema the agent was shown has no "${k}": the host adds it after accepting the return.`);
  const rules = [];
  for (const m of String(contextText ?? '').matchAll(/(?:^|[.!?]\s+|\n)([^.!?\n]*?\b(?:never set|do not set|don't set|don't include|do not include|must not set|must not include)\b([^.:!?\n]*)[^.!?\n]*[.!?]?)/gi)) {
    const quoted = [...m[2].matchAll(/"([A-Za-z_][\w-]*)"/g)].map((x) => x[1]);
    const words = quoted.length ? quoted : m[2].split(/[\s,/]+/).map((w) => w.replace(/[^\w-]/g, '')).filter((w) => w.length >= 2 && !STOP.has(w.toLowerCase()));
    rules.push({ names: words, sentence: m[1].trim() });
  }
  const walk = (v, path) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      const p = Array.isArray(v) ? `${path}[${k}]` : path ? `${path}.${k}` : k;
      const rule = !Array.isArray(v) && rules.find((r) => r.names.includes(k));
      const stamp = rule && !path ? stampOf(engineSources, k) : null;
      if (rule && stamp) add(p, `The added context tells the agent: "${rule.sentence}" And the engine code stamps it on every accepted result before it writes result.json (${stamp.file} line ${stamp.line}: ${stamp.text}). So the host wrote this field, not the agent.`);
      else if (rule) add(p, `The added context tells the agent: "${rule.sentence}" So this field was very likely written by the host after it accepted the return (inferred from that rule: the host does not record who wrote each field).`);
      walk(x, p);
    }
  };
  walk(result, '');
  return out;
}

/**
 * Where the engine's own code adds a top-level field to a result it accepts: an object literal that spreads the
 * result and sets the key (`{ ...result, attested: ... }`). Returns { file, line, text } or null.
 */
export function stampOf(engineSources, key) {
  for (const [file, text] of Object.entries(engineSources ?? {})) {
    const lines = String(text).split('\n');
    const k = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const i = lines.findIndex((l) => new RegExp(`\\.\\.\\.\\s*\\w+\\s*,\\s*${k}\\s*:`).test(l));
    if (i >= 0) return { file: `packages/engine/src/${file}`, line: i + 1, text: lines[i].trim().slice(0, 140) };
  }
  return null;
}

/** Every item of a journal root as a bundle. */
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
