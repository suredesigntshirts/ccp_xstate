// Expect: wf-intake/chart, wf-intake/frozen, wf-intake/independent
// The intake workflow through the real host with stub agents: intake.json loads with stages shape and challenge, every
// route holds (a PASS starts one quick-fix child, a FAIL reruns shape at most twice, then a card), the PASS challenge's
// issue is the child's start and brief input unchanged, the challenge prompt holds only the request and the issue, and
// accept() refuses challenge lines that skip, add, reorder or contradict the issue's expect lines.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../../packages/engine/src/host.js';
import { actors, accept, bind, spawn, loadRun, runDir } from '../../../packages/engine/src/actors.js';
import { handlers, pump } from '../../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SESSION = 'owner';
const RELEASE = '0.2.0';
const ITEM = 'in-1';
const REQUEST = { url: 'https://github.com/o/tally/issues/9', text: 'tally prints totals with float noise (0.30000000000000004). Round totals to two decimals.' };

/** A shaped issue, as shape returns it (no url). `n` makes versions differ. */
const ISSUE = (n = 1, extra = {}) => ({
  title: `Round printed totals (v${n})`,
  problem: 'tally sum 0.1 0.2 prints 0.30000000000000004.',
  reason: 'Totals are read by people.',
  outcome: 'Printed totals have at most two decimals.',
  expect: [`tally sum 0.1 0.2 prints 0.3 (v${n})`, 'npm test passes'],
  proofs: [
    { line: `tally sum 0.1 0.2 prints 0.3 (v${n})`, proof: 'run', how: 'node bin/tally.js sum 0.1 0.2' },
    { line: 'npm test passes', proof: 'ci', how: 'the test check' }
  ],
  non_goals: ['no change to the library'],
  assumptions: ['two decimals means rounding half up'],
  ...extra
});
/** A challenge verdict covering `issue.expect`: result PASS, or FAIL on the first line. */
const VERDICT = (issue, result = 'PASS', tag = '') => ({
  result,
  lines: issue.expect.map((line, i) => ({
    line,
    result: result === 'FAIL' && i === 0 ? 'FAIL' : 'PASS',
    evidence: result === 'FAIL' && i === 0 ? `a build rounding only sum meets it ${tag}` : `tried a wrong build ${tag}`
  })),
  wrong_build: `rounding only the sum command ${tag}`
});

const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];
const tmp = (name) => mkdtempSync(join(tmpdir(), `vwi-${name}-`));
function repoWithCommit() {
  const repo = tmp('repo');
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  execFileSync('git', ['-C', repo, ...ID, 'commit', '-q', '--allow-empty', '-m', 'base']);
  return repo;
}

/**
 * A world over the real engine. Intake's shape and challenge are real agent runs (run folders, prompts); ask is a
 * stub that puts a card up and stays open (`tap` answers it). The quick-fix child's brief/build/verify are real
 * open runs when `childReal`, else stubs that finish at once with the queued outputs; its ask (the merge card) is
 * answered approve at once and merge returns a sha.
 */
function world({ childReal = false } = {}) {
  const root = tmp('root');
  const repo = repoWithCommit();
  const worktrees = join(root, 'wt');
  const log = [];
  let cards = 0;
  let taps = 0;
  const stub = (name, fn) => ({ start: async (effect) => { log.push(effect); return fn(effect); } });
  const childStubs = {
    brief: stub('brief', () => ({ output: { builder: 'build it', verifier: 'verify it' } })),
    build: stub('build', () => ({ output: { pr: { url: 'https://github.com/o/tally/pull/3', at: 'a'.repeat(40), key: 'o/tally#3', green: true } } })),
    verify: stub('verify', (e) => ({ output: {
      result: 'PASS', pr: { url: 'https://github.com/o/tally/pull/3', at: 'a'.repeat(40) }, issue: e.input.issue,
      lines: e.input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: 'stub' }))
    } })),
    ask: stub('ask', () => ({ output: { choice: 'approve', by: 'stand-in' } })),
    merge: stub('merge', () => ({ output: { sha: 'd'.repeat(40) } }))
  };
  const intakeAsk = { ask: stub('ask', (e) => ({ ref: `card-${++cards}` })) };
  const w = {
    root, repo, worktrees, log,
    handlersFor: (host) => {
      const isChild = String(host.spec.id).startsWith('quick-fix@');
      const own = isChild
        ? (childReal ? { ...actors({ host, repo, worktrees }), ask: childStubs.ask, merge: childStubs.merge } : childStubs)
        : { ...actors({ host, repo, worktrees }), ...intakeAsk };
      return handlers({ github: null, host, workflows: ['quick-fix'], handlersFor: w.handlersFor, actors: own });
    },
    host: (item = ITEM) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (input = { request: REQUEST }, item = ITEM) => {
      const host = restore({ root, item, spec: loadWorkflow('intake', { root }), session: SESSION, release: RELEASE });
      const results = await offer(host, [{ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
      return results;
    },
    drive: (top = ITEM) => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor }),
    rows: (item = ITEM) => readFile(itemFile(root, item)).rows,
    state: (item = ITEM) => w.host(item).snapshot.value,
    status: (item = ITEM) => w.host(item).snapshot.status,
    openRun: (actor, item = ITEM) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** The open run of `actor` returns `result` through the real spawn/bind/accept; then the item is driven. */
    agent: async (actor, result, { item = ITEM, drive = true } = {}) => {
      const run = w.openRun(actor, item);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const value = typeof result === 'function' ? result(loadRun(root, run.id)) : result;
      const got = await accept({ root, caller: id, run: run.id, result: value, toolUseId: `tu_${id}_ret`, github: null });
      if (drive) await w.drive();
      return { run, got };
    },
    /** Answer the open card of `item` with `output` (a tap), then drive. */
    tap: async (output, item = ITEM) => {
      const host = w.host(item);
      const run = pending(host).runs.find((r) => r.actor === 'ask');
      if (!run) throw new Error(`no open card on ${item}`);
      const res = await offer(host, [{ event: { type: 'xstate.done.actor.ask', output }, run: run.id, source: { system: 'hearth', ref: `tap ${run.id} ${++taps}` } }], w.handlersFor(host));
      await w.drive();
      return res;
    },
    /** Runs of `actor` prepared on `item`, in order, as run.json. */
    runs: (actor, item = ITEM) => w.rows(item)
      .filter((r) => r.kind === 'prompt.stored' && r.payload.actor === actor && r.payload.role === actor)
      .map((r) => loadRun(root, r.payload.run)),
    /** Child items started by `item` (effects of the quick-fix actor). */
    children: (item = ITEM) => w.rows(item)
      .filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'quick-fix' && r.payload.phase === 'start')
      .map((r) => r.payload.effect)
  };
  return w;
}

const read = (path) => readFileSync(path, 'utf8');

const pass = (run) => VERDICT(run.input.issue, 'PASS');
const fail = (tag) => (run) => VERDICT(run.input.issue, 'FAIL', tag);

test('intake.json loads through the engine load check (checkStages), with stages shape and challenge', () => {
  const spec = loadWorkflow('intake', { root: tmp('load') });
  assert.match(spec.id, /^intake@[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(spec.states).sort(), ['challenging', 'done', 'dropped', 'fixing', 'shaping', 'stuck']);
  assert.equal(spec.states.fixing.invoke.src, 'quick-fix');
  // the stage files are composed in: their rules reach the loaded spec
  assert.match(JSON.stringify(spec.meta.actors.shape), /You are the issue writer/);
  assert.match(JSON.stringify(spec.meta.actors.challenge), /You are the challenger/);
});

test('a start without request.url or request.text is refused', async () => {
  for (const input of [{}, { request: { text: 'x' } }, { request: { url: 'u' } }]) {
    const w = world();
    const res = await w.start(input);
    assert.notEqual(res[0].outcome, 'applied', JSON.stringify(input));
  }
});

test('shape then a PASS challenge starts one quick-fix child whose issue is shape\'s issue with url = request.url', async () => {
  const w = world();
  await w.start();
  assert.equal(w.state(), 'shaping');
  // shape writes no url, or a wrong one: the host sets it from the request either way
  await w.agent('shape', { issue: ISSUE(1, { url: 'https://example.com/wrong' }) });
  assert.equal(w.state(), 'challenging');
  await w.agent('challenge', pass);
  const kids = w.children();
  assert.equal(kids.length, 1, 'one child');
  const init = w.rows(kids[0]).find((r) => r.kind === 'engine.transition' && r.payload.seq === 0);
  assert.equal(init.payload.outcome, 'applied');
  assert.match(init.payload.workflow, /^quick-fix@/);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(1), url: REQUEST.url });
  // the child runs (stubs) to its end; the parent is not offered a second start
  assert.equal(w.status(kids[0]), 'done');
  await w.drive();
  assert.equal(w.children().length, 1, 'still one child after another drive');
});

test('the child\'s end ends intake done with the child\'s output', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { issue: ISSUE(1) });
  await w.agent('challenge', pass);
  const [kid] = w.children();
  const child = w.host(kid);
  assert.equal(child.snapshot.status, 'done');
  assert.equal(child.snapshot.value, 'done');
  const parent = w.host();
  assert.equal(parent.snapshot.value, 'done');
  assert.equal(parent.snapshot.status, 'done');
  assert.deepEqual(parent.snapshot.output.fix, child.snapshot.output);
  assert.equal(child.snapshot.output.merge.sha, 'd'.repeat(40));
  assert.deepEqual(parent.snapshot.output.issue, { ...ISSUE(1), url: REQUEST.url });
  assert.equal(parent.snapshot.output.challenge.result, 'PASS');
});

test('a FAIL reruns shape with that challenge as input, at most twice; the third FAIL puts a card up', async () => {
  const w = world();
  await w.start();
  for (let n = 1; n <= 3; n++) {
    assert.equal(w.state(), 'shaping', `round ${n}`);
    await w.agent('shape', { issue: ISSUE(n) });
    assert.equal(w.state(), 'challenging');
    await w.agent('challenge', fail(`round ${n}`));
  }
  assert.equal(w.state(), 'stuck');
  const shapes = w.runs('shape');
  const challenges = w.runs('challenge');
  assert.equal(shapes.length, 3);
  assert.equal(challenges.length, 3);
  assert.equal(shapes[0].input.challenge, null);
  // each revision's input is the challenge that failed the version before, exactly as returned
  for (const i of [1, 2]) {
    assert.deepEqual(shapes[i].input.challenge, VERDICT({ expect: ISSUE(i).expect }, 'FAIL', `round ${i}`));
    assert.deepEqual(shapes[i].input.request, REQUEST);
  }
  const cards = w.log.filter((e) => e.actor === 'ask');
  assert.equal(cards.length, 1, 'one card');
  assert.deepEqual(cards[0].input.choices, ['revise', 'build as is', 'drop']);
  assert.deepEqual(cards[0].input.challenge, VERDICT({ expect: ISSUE(3).expect }, 'FAIL', 'round 3'));
  assert.equal(w.children().length, 0, 'no child before the card is answered');
});

test('a FAIL then a PASS goes on to the child (a revision that holds is frozen)', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { issue: ISSUE(1) });
  await w.agent('challenge', fail('r1'));
  await w.agent('shape', { issue: ISSUE(2) });
  await w.agent('challenge', pass);
  assert.equal(w.children().length, 1);
  const init = w.rows(w.children()[0]).find((r) => r.payload.seq === 0);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(2), url: REQUEST.url });
});

async function toCard() {
  const w = world();
  await w.start();
  for (let n = 1; n <= 3; n++) {
    await w.agent('shape', { issue: ISSUE(n) });
    await w.agent('challenge', fail(`round ${n}`));
  }
  assert.equal(w.state(), 'stuck');
  return w;
}

test('card: revise with words reruns shape with the answer (one more round)', async () => {
  const w = await toCard();
  const answer = { choice: 'revise', by: 'person', why: 'round half to even, and cover the avg command too' };
  await w.tap(answer);
  assert.equal(w.state(), 'shaping');
  const shapes = w.runs('shape');
  assert.equal(shapes.length, 4);
  assert.deepEqual(shapes[3].input.answer, answer);
  // one more round: a FAIL now goes straight back to the card, a PASS to the child
  await w.agent('shape', { issue: ISSUE(4) });
  await w.agent('challenge', fail('round 4'));
  assert.equal(w.state(), 'stuck', 'after the revise round, a FAIL is the card again');
  await w.tap({ choice: 'revise', by: 'person', why: 'try again' });
  await w.agent('shape', { issue: ISSUE(5) });
  await w.agent('challenge', pass);
  assert.equal(w.children().length, 1);
});

test('card: revise with no words is not taken', async () => {
  const w = await toCard();
  const res = await w.tap({ choice: 'revise', by: 'person' });
  assert.notEqual(res[0].outcome, 'applied');
  assert.equal(w.state(), 'stuck');
  assert.equal(w.runs('shape').length, 3);
});

test('card: build as is starts the child with the last issue', async () => {
  const w = await toCard();
  await w.tap({ choice: 'build as is', by: 'stand-in' });
  const kids = w.children();
  assert.equal(kids.length, 1);
  const init = w.rows(kids[0]).find((r) => r.payload.seq === 0);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(3), url: REQUEST.url });
  assert.equal(w.host().snapshot.value, 'done');
});

test('card: drop ends the item dropped, with no child', async () => {
  const w = await toCard();
  await w.tap({ choice: 'drop', by: 'person' });
  const h = w.host();
  assert.equal(h.snapshot.value, 'dropped');
  assert.equal(h.snapshot.status, 'done');
  assert.equal(w.children().length, 0);
});

test('shape\'s blocked answer reaches the card (with its reason); build as is is then not taken (no issue)', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { blocked: { reason: 'this asks two unrelated things' } });
  assert.equal(w.state(), 'stuck');
  assert.equal(w.runs('challenge').length, 0);
  const card = w.log.filter((e) => e.actor === 'ask').at(-1);
  assert.match(String(card.input.failure), /two unrelated things/);
  const res = await w.tap({ choice: 'build as is', by: 'stand-in' });
  assert.notEqual(res[0].outcome, 'applied');
  assert.equal(w.children().length, 0);
  await w.tap({ choice: 'revise', by: 'person', why: 'just do the rounding' });
  assert.equal(w.state(), 'shaping');
  assert.equal(w.runs('shape')[1].input.answer.why, 'just do the rounding');
});

const NEW_FIELDS = ['title', 'problem', 'reason', 'outcome', 'proofs', 'non_goals', 'assumptions'];

for (const route of ['first PASS', 'PASS after a revision']) {
  test(`frozen issue (${route}): challenge input == child start input == child brief input`, async () => {
    const w = world({ childReal: true });
    await w.start();
    if (route !== 'first PASS') {
      await w.agent('shape', { issue: ISSUE(1) });
      await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', 'r1'));
    }
    // fields with unicode, quotes and nesting, so a re-serialisation that changes bytes would show
    const shaped = ISSUE(2, { assumptions: ['“half up”, not banker\'s', 'a\ttab'], non_goals: [] });
    await w.agent('shape', { issue: shaped });
    await w.agent('challenge', (run) => VERDICT(run.input.issue, 'PASS'));

    const passRun = w.runs('challenge').at(-1);
    const passResult = JSON.parse(read(join(runDir(w.root, passRun.run), 'result.json'))).result;
    assert.equal(passResult.result, 'PASS');
    const frozen = passRun.input.issue;
    assert.deepEqual(frozen, { ...shaped, url: REQUEST.url });

    const [kid] = w.children();
    assert.ok(kid, 'a child started');
    const init = w.rows(kid).find((r) => r.kind === 'engine.transition' && r.payload.seq === 0);
    assert.equal(JSON.stringify(init.payload.event.input.issue), JSON.stringify(frozen), 'byte for byte as serialised');
    assert.equal(JSON.stringify(init.payload.event.input), JSON.stringify({ issue: frozen }), 'the start input is only the issue');
    // and the raw journal line carries exactly those bytes
    assert.ok(read(itemFile(w.root, kid)).includes(JSON.stringify(frozen)), 'raw child journal holds the issue bytes');

    // the child's brief run receives it whole
    assert.equal(w.state(kid), 'briefing');
    const brief = w.runs('brief', kid)[0];
    assert.ok(brief, 'the child prepared its brief run');
    assert.equal(JSON.stringify(brief.input.issue), JSON.stringify(frozen));
    for (const f of NEW_FIELDS) assert.deepEqual(brief.input.issue[f], frozen[f], f);
    const prompt = read(join(runDir(w.root, brief.run), 'prompt.md'));
    for (const v of [frozen.title, frozen.problem, frozen.reason, frozen.outcome, frozen.proofs[0].how, ...frozen.assumptions.map((a) => JSON.stringify(a).slice(1, -1))]) {
      assert.ok(prompt.includes(v), `brief prompt carries ${v}`);
    }
  });
}

// Marker strings that only shape's other output, an earlier challenge or the card's answer carry.
const SHAPE_NOTE = 'SHAPE-PRIVATE-REASONING-7c1';
const OLD_EVIDENCE = 'OLD-CHALLENGE-EVIDENCE-4b2';
const ANSWER_WORDS = 'CARD-ANSWER-WORDS-9d0';

async function revisedChallengeRun() {
  const w = world();
  await w.start();
  // shape returns its issue plus extra output the schema does not name (notes): the challenge must not see it
  const first = await w.agent('shape', { issue: ISSUE(1), notes: `${SHAPE_NOTE}: I assumed rounding half up` });
  assert.ok(first.got.accepted, JSON.stringify(first.got));
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.agent('shape', { issue: ISSUE(2), notes: SHAPE_NOTE });
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.agent('shape', { issue: ISSUE(3) });
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.tap({ choice: 'revise', by: 'person', why: ANSWER_WORDS });
  await w.agent('shape', { issue: ISSUE(4), notes: SHAPE_NOTE });
  assert.equal(w.state(), 'challenging');
  return { w, run: w.openRun('challenge') };
}

test('the challenge prompt holds the request and the issue, and nothing else of shape\'s, of earlier rounds or of the card', async () => {
  const { w, run } = await revisedChallengeRun();
  const prepared = w.runs('challenge').at(-1);
  assert.equal(prepared.run, run.id);
  assert.deepEqual(Object.keys(prepared.input).sort(), ['issue', 'request', 'task']);
  assert.deepEqual(prepared.input.request, REQUEST);
  assert.deepEqual(prepared.input.issue, { ...ISSUE(4), url: REQUEST.url });
  const prompt = read(join(runDir(w.root, run.id), 'prompt.md'));
  const context = read(join(runDir(w.root, run.id), 'context.md'));
  assert.ok(prompt.includes(REQUEST.text), 'request text in the prompt');
  assert.ok(prompt.includes(REQUEST.url), 'request url in the prompt');
  for (const v of [ISSUE(4).title, ISSUE(4).problem, ISSUE(4).outcome, ...ISSUE(4).expect, ISSUE(4).non_goals[0], ISSUE(4).assumptions[0]]) {
    assert.ok(prompt.includes(v), `issue field in the prompt: ${v}`);
  }
  for (const secret of [SHAPE_NOTE, OLD_EVIDENCE, ANSWER_WORDS, ISSUE(3).title]) {
    assert.ok(!prompt.includes(secret), `prompt leaks ${secret}`);
    assert.ok(!context.includes(secret), `context leaks ${secret}`);
  }
  // the shape run of the same round did get the answer (the marker test is not vacuous)
  const shapePrompt = read(join(runDir(w.root, w.runs('shape').at(-1).run), 'prompt.md'));
  assert.ok(shapePrompt.includes(ANSWER_WORDS) && shapePrompt.includes(OLD_EVIDENCE));
});

test('accept refuses challenge results that skip, add, reorder or contradict lines, or whose result disagrees', async () => {
  const { w, run } = await revisedChallengeRun();
  const issue = { ...ISSUE(4), url: REQUEST.url };
  const good = VERDICT(issue, 'FAIL', 'x');
  const bad = {
    skip: { ...good, lines: good.lines.slice(0, 1) },
    add: { ...good, lines: [...good.lines, { line: 'the avg command rounds too', result: 'PASS', evidence: 'e' }] },
    reorder: { ...good, lines: [...good.lines].reverse() },
    contradict: { ...good, lines: [{ ...good.lines[0], line: good.lines[0].line.replace('0.3', '0.30') }, good.lines[1]] },
    'PASS with a FAIL line': { ...good, result: 'PASS' },
    'FAIL with every line PASS': { ...VERDICT(issue, 'PASS'), result: 'FAIL' },
    'no lines': { ...good, lines: [] },
    'no wrong_build': { result: good.result, lines: good.lines }
  };
  const seen = {};
  for (const [name, result] of Object.entries(bad)) {
    const { got } = await w.agent('challenge', result, { drive: false }).catch((e) => ({ got: { threw: String(e) } }));
    seen[name] = got.refused?.rule ?? JSON.stringify(got);
    assert.ok(got.refused, `${name}: not refused: ${JSON.stringify(got)}`);
  }
  assert.equal(w.state(), 'challenging', 'nothing reached the item');
  // a good result is then accepted, and the item moves (third FAIL after revise: the card)
  const ok = await w.agent('challenge', good);
  assert.ok(ok.got.accepted, JSON.stringify(ok.got));
  assert.equal(w.state(), 'stuck');
  // the refusals are journaled
  const refusals = w.rows().filter((r) => r.kind === 'refusal' && r.payload.run === run.id);
  assert.equal(refusals.length, Object.keys(bad).length);
  console.log(JSON.stringify(seen));
});
