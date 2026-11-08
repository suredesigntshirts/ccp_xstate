// Expect: retire-pinned-legacy/records-readable, retire-pinned-legacy/retired-not-run
// Items pinned to a workflow this release's load check refuses: every committed item journal's pin loads and replays,
// only the adopt trial's pin is retired, and an item on a retired pin is replayed and never advanced, through the real
// loadWorkflow, restore, applyEvent, persist, runEffects, offer and deliver.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

const imp = (p) => import(pathToFileURL(join(REPO, p)).href);
async function engine() {
  const [index, host, actors, prompts] = await Promise.all([
    imp('packages/engine/src/index.js'), imp('packages/engine/src/host.js'),
    imp('packages/engine/src/actors.js'), imp('packages/engine/src/prompts.js')
  ]);
  return { index, host, actors, prompts };
}

const rows = (file) => {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};
const applied = (file) => rows(file).filter((r) => r.kind === 'engine.transition' && r.payload?.outcome === 'applied');
const effectRows = (file) => rows(file).filter((r) => r.kind === 'engine.effect');
const pinOf = (file) => applied(file).find((r) => r.payload.seq === 0)?.payload?.workflow ?? null;

const tempDir = (tag) => mkdtempSync(join(tmpdir(), `rpl-${tag}-`));

/** The adopt trial's journal root copied to a temp folder; with `beforeSeq`, its item file cut before that applied seq. */
function adoptCopy(beforeSeq = null) {
  const root = tempDir('adopt');
  cpSync(ADOPT, root, { recursive: true });
  if (beforeSeq != null) {
    const file = join(root, 'items', 'trial.jsonl');
    const all = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const cut = all.findIndex((l) => {
      const r = JSON.parse(l);
      return r.kind === 'engine.transition' && r.payload?.outcome === 'applied' && r.payload.seq === beforeSeq;
    });
    writeFileSync(file, `${all.slice(0, cut).join('\n')}\n`);
  }
  return root;
}

/** The repo's quick-fix, composed as the engine pins it, passed through change(spec); written as a blob under root. */
async function pinCopy(root, change) {
  const { prompts } = await engine();
  const { spec } = prompts.readWorkflow('quick-fix', { dir: join(REPO, 'workflows') });
  const copy = structuredClone(spec);
  change(copy);
  const bytes = prompts.pinBytes(copy);
  const hash = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'blobs'), { recursive: true });
  writeFileSync(join(root, 'blobs', hash), bytes);
  return `quick-fix@${hash}`;
}

/** The adopt trial's start input: a quick-fix issue. */
const startInput = () => applied(join(ADOPT, 'items', 'trial.jsonl'))[0].payload.event.input;

/**
 * Starts `item` on `pin` as an earlier release did: its seq-0 row written by a host given the spec unmarked (a plain
 * copy, as a release whose check took it), with that release on the row.
 */
async function startAsEarlier(root, item, pin, release) {
    const loaded = index.loadWorkflow(pin, { root });
  const plain = JSON.parse(JSON.stringify(loaded));
  const h = H.restore({ root, item, spec: plain, session: 'earlier', release });
  const r = H.applyEvent(h, { event: { type: 'xstate.init', input: startInput() }, source: { system: 'test', ref: `start ${item}` } });
  if (r.outcome !== 'applied') throw new Error(`start refused: ${r.row.payload.reason}`);
  H.persist(h, r.row);
  return h;
}

/** Effect handlers that record every call and carry out nothing. */
function recorder() {
  const calls = [];
  const handler = (type) => ({ start: (effect) => { calls.push([type, 'start', effect.id]); return {}; }, find: (effect) => { calls.push([type, 'find', effect.id]); return null; } });
  return { calls, handlers: Object.fromEntries(['run', 'stop', 'timer', 'cancel'].map((t) => [t, handler(t)])) };
}

const { index, host: H, actors } = await engine();
const files = execFileSync('git', ['-C', REPO, 'ls-files', '*/items/*.jsonl'], { encoding: 'utf8' }).split('\n')
  .filter((f) => /\/items\/[^/]+\.jsonl$/.test(f));

test('every committed pin loads and every pinned journal replays; only the adopt trial\'s pin is retired', () => {
  const retired = [];
  let replayed = 0;
  const pins = new Set();
  for (const f of files) {
    const abs = join(REPO, f);
    const pin = pinOf(abs);
    if (!/@[0-9a-f]{64}$/.test(pin ?? '')) continue;
    const root = dirname(dirname(abs));
    const item = f.split('/').at(-1).replace(/\.jsonl$/, '');
    const spec = index.loadWorkflow(pin, { root });
    assert.equal(spec.id, pin);
    pins.add(pin);
    if (index.retiredOf(spec)) retired.push([f, pin, index.retiredOf(spec)]);
    const host = H.restore({ root, item, spec, session: 'verify', release: '9.9.9' });
    assert.equal(host.seq, applied(abs).length, f);
    replayed++;
  }
  console.log(`files ${files.length}, replayed ${replayed}, distinct pins ${pins.size}, retired ${retired.length}`);
  assert.ok(replayed >= 200);
  assert.deepEqual(retired.map(([f]) => f), ['tournaments/2026-11-04-stage-contract/trials/adopt/journal/items/trial.jsonl']);
  assert.match(retired[0][2], /state awaitingGates asks the person \(invoke ask\) and sets no timer/);
});

const fileOf = (root, item) => join(root, 'items', `${item}.jsonl`);
const bytes = (f) => readFileSync(f, 'utf8');

/** Every way the host could advance the item, each checked to change nothing. */
async function assertNotRun({ root, item, session, release, message, event, run = null }) {
  const file = fileOf(root, item);
  const pin = pinOf(file);
  const spec = index.loadWorkflow(pin, { root });
  const why = index.retiredOf(spec);
  assert.ok(why, `${pin} loads retired`);
  assert.match(why, message);
  const host = H.restore({ root, item, spec, session, release: '9.9.9' });
  const before = { applied: applied(file).length, effects: effectRows(file).length, state: JSON.stringify(host.snapshot?.value) };

  const r = H.applyEvent(host, { event, run, source: { system: 'verify', ref: `offer ${item}` } });
  assert.equal(r.outcome, 'refused');
  assert.deepEqual(r.effects, []);
  const reason = r.row.payload.reason;
  for (const part of [item, pin, why, release]) assert.ok(reason.includes(part), `reason names ${part}: ${reason}`);
  H.persist(host, r.row);
  assert.equal(applied(file).length, before.applied, 'no applied row');
  assert.equal(JSON.stringify(host.snapshot?.value), before.state, 'the host did not move');

  const rec = recorder();
  const out = await H.runEffects(host, rec.handlers);
  assert.deepEqual(rec.calls, [], 'no handler called');
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.follow, []);
  assert.equal(effectRows(file).length, before.effects, 'no effect row');
  return { reason, why };
}

test('the adopt trial (done on 0.2.0) replays and is never advanced', async () => {
  const root = adoptCopy();
  const { reason } = await assertNotRun({
    root, item: 'trial', session: 'owner', release: '0.2.0', message: /state awaitingGates asks the person \(invoke ask\) and sets no timer/,
    event: { type: 'github.pull_request.closed' }
  });
  assert.match(reason, /finish it on release 0\.2\.0/);
});

test('a returned result from a committed adopt run, delivered, applies nothing (the same cut journal applies it at a runnable pin)', async () => {
  // Cut before seq 4, the verify run is open and its run folder holds its returned result.json.
  const root = adoptCopy(4);
  const file = fileOf(root, 'trial');
  const before = applied(file).length;
  const effects = effectRows(file).length;
  const host = H.restore({ root, item: 'trial', spec: index.loadWorkflow(pinOf(file), { root }), session: 'owner', release: '9.9.9' });
  assert.equal(host.runs.size, 1, 'the verify run is open');
  assert.equal(actors.resultsOf(host).length, 1, 'and its result is there to deliver');
  const got = await actors.deliver({ root, run: 'trial:3.verify' });
  assert.equal(got.error, undefined, JSON.stringify(got));
  assert.deepEqual(got.results.map((r) => r.outcome), ['refused']);
  assert.match(got.results[0].reason, /no longer runs/);
  assert.equal(applied(file).length, before, 'no applied row');
  assert.equal(effectRows(file).length, effects, 'no effect row');
  assert.deepEqual(got.waiting, []);
});

const preContract = (s) => { s.meta.actors.build = { prompt: 'old', task: 'Build the fix' }; delete s.meta.marks?.build; };
const noTimer = (s) => { delete s.states.awaitingGates.after; };

for (const [name, change, message] of [
  ['a pre-contract quick-fix copy', preContract, /actor build, invoked at \/states\/building\/invoke, is not a stage \(it lacks rules and inputs\), a host effect \(merge, ask, post\) or a workflow$/],
  ['a quick-fix copy whose awaitingGates has no after', noTimer, /state awaitingGates asks the person \(invoke ask\) and sets no timer/]
]) {
  test(`${name}, started on an earlier release, is never advanced; a current item in the same root advances`, async () => {
    const root = tempDir('pin');
    const pin = await pinCopy(root, change);
    await startAsEarlier(root, 'old', pin, '0.1.20');
    assert.equal(pinOf(fileOf(root, 'old')), pin);
    assert.equal(applied(fileOf(root, 'old')).length, 1);
    const run = applied(fileOf(root, 'old'))[0].payload;
    await assertNotRun({
      root, item: 'old', session: 'earlier', release: '0.1.20', message,
      event: { type: 'xstate.done.actor.brief', output: { builder: 'b', verifier: 'v' } }, run: `old:0.brief`
    });
    assert.ok(run);

    // A current quick-fix item, same root, same release: it starts and its first run is carried out.
    const spec = index.loadWorkflow('quick-fix', { root });
    assert.equal(index.retiredOf(spec), null);
    const host = H.restore({ root, item: 'new', spec, session: 'now', release: '9.9.9' });
    const rec = recorder();
    const results = await H.offer(host, [{ event: { type: 'xstate.init', input: startInput() }, source: { system: 'verify', ref: 'start new' } }], rec.handlers);
    assert.deepEqual(results.map((r) => r.outcome), ['applied']);
    assert.equal(host.snapshot.value, 'briefing');
    assert.deepEqual(rec.calls.map(([t, p]) => `${t} ${p}`), ['run start']);
    assert.ok(effectRows(fileOf(root, 'new')).length > 0);
  });
}

test('an item not yet started on a retired pin is refused its start, and none is written to its file', async () => {
  const root = tempDir('unstarted');
  const pin = await pinCopy(root, noTimer);
  const spec = index.loadWorkflow(pin, { root });
  const host = H.restore({ root, item: 'fresh', spec, session: 's', release: '9.9.9' });
  const r = H.applyEvent(host, { event: { type: 'xstate.init', input: startInput() }, source: { system: 'verify', ref: 'start fresh' } });
  assert.equal(r.outcome, 'refused');
  assert.match(r.row.payload.reason, /fresh is pinned to quick-fix@[0-9a-f]{64}, which this release no longer runs/);
  H.persist(host, r.row);
  assert.deepEqual(rows(fileOf(root, 'fresh')), []);
});
