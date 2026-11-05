// Verifier tests for fix-blocked-card-grant: blocked-card-answered, refused-when-not-covered, pr-cards-unchanged (the
// grant half). quick-fix is driven by the real engine with stub agents to blocked or awaitingMerge, the card is put up
// with `bin/host.js card`, and answered with `bin/host.js answer` and a grants file written here, as a stand-in would.
// Written from the item and its decision, not the builder's tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemFile } from '../../packages/engine/src/host.js';
import { world, blocked, builds, verifies, grant, BRIEFS, REASON } from './lib.mjs';

const ITEM = 'a';
const answersOf = (w) => w.rows(ITEM).filter((r) => r.source?.system === 'standin');
const bytes = (w) => readFileSync(itemFile(w.root, ITEM), 'utf8');

async function toBlocked(opts) {
  const w = await world(opts);
  await w.start(ITEM);
  await w.agent(ITEM, 'brief', () => BRIEFS);
  const first = await w.agent(ITEM, 'build', blocked());
  assert.equal(w.state(ITEM), 'blocked');
  const card = await w.putCard(ITEM);
  assert.deepEqual(card.input.choices, ['retry', 'replan', 'drop']);
  assert.equal(card.input.pr, undefined, 'the blocked card has no pr');
  return { w, first, card };
}

function assertAnswerRow(w, card, output) {
  const rows = answersOf(w);
  assert.equal(rows.length, 1, 'one stand-in row');
  const [row] = rows;
  assert.equal(row.kind, 'engine.transition');
  assert.equal(row.payload.outcome, 'applied');
  assert.equal(row.payload.run, card.effect);
  assert.equal(row.source.system, 'standin');
  assert.match(row.source.ref, /\bvg\b/, 'ref names the grant');
  assert.ok(row.source.ref.includes(card.ref), 'ref names the card');
  assert.equal(row.payload.event.type, 'xstate.done.actor.ask');
  assert.deepEqual(row.payload.event.output, output);
}

test('blocked-card-answered: retry under a grant moves to building with the same briefs and the block as failure', async () => {
  const { w, first, card } = await toBlocked();
  try {
    const before = w.snap(ITEM).context;
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ choices: ['retry'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.state, 'building');
    assert.equal(w.state(ITEM), 'building');
    const after = w.snap(ITEM).context;
    assert.deepEqual(after.briefs, before.briefs, 'same briefs');
    assert.equal(after.failure, `build blocked: ${REASON}`, 'failure names the block');
    const rebuilt = w.openRun(ITEM, 'build');
    assert.ok(rebuilt && rebuilt.id !== first.id, 'a new build run is open');
    assert.equal(rebuilt.input.task, first.input.task, 'the same builder brief');
    assert.equal(rebuilt.input.failure, `build blocked: ${REASON}`);
    assertAnswerRow(w, card, { choice: 'retry', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('blocked-card-answered: replan with --why moves to briefing with that why', async () => {
  const { w, card } = await toBlocked();
  try {
    const why = 'why 1: the brief asked for a CI edit the token cannot push; ... why 5: no scope check before build';
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'replan', why, grants: w.grants([grant()]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'briefing');
    assert.equal(w.snap(ITEM).context.why, why);
    assert.ok(w.openRun(ITEM, 'brief'), 'a new brief run');
    assertAnswerRow(w, card, { choice: 'replan', by: 'standin-session', grant: 'vg', why });
  } finally { await w.close(); }
});

test('blocked-card-answered: drop ends the item dropped', async () => {
  const { w, card } = await toBlocked();
  try {
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'drop', grants: w.grants([grant({ choices: ['drop'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'dropped');
    assertAnswerRow(w, card, { choice: 'drop', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('refused-when-not-covered: another repo, a choice not named, an expired grant, and a replan with no why are refused; the item and journal stay', async () => {
  const { w, card } = await toBlocked();
  try {
    const cases = [
      ['another repo', { choice: 'retry', grants: [grant({ repos: ['o/x'] })] }, /o\/r not granted \(read from the issue\)/],
      ['choice not named', { choice: 'retry', grants: [grant({ choices: ['replan', 'drop'] })] }, /does not grant "retry"/],
      ['expired', { choice: 'retry', grants: [grant({ until: new Date(Date.now() - 3600e3).toISOString() })] }, /expired/],
      ['replan without why', { choice: 'replan', grants: [grant()] }, /refused/],
      ['replan with blank why', { choice: 'replan', why: '   ', grants: [grant()] }, /refused/]
    ];
    for (const [name, { choice, why, grants }, msg] of cases) {
      const was = bytes(w);
      const r = await w.answer(ITEM, { effect: card.effect, choice, why, grants: w.grants(grants) });
      assert.equal(r.status, 2, `${name}: exit 2 (${r.stderr})`);
      assert.match(r.stderr, msg, name);
      assert.equal(bytes(w), was, `${name}: journal unchanged`);
      assert.equal(w.state(ITEM), 'blocked', `${name}: still blocked`);
    }
    assert.equal(answersOf(w).length, 0);
    // The refusals did not poison the card: the same grant id, covering, is then taken.
    const ok = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant()]) });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(w.state(ITEM), 'building');
  } finally { await w.close(); }
});

for (const url of ['https://gitlab.com/o/r/issues/7', 'https://github.com/o/r/pull/7', 'https://github.com/o/r', 'o/r#7']) {
  test(`refused-when-not-covered: an issue url that is not a github.com issue URL (${url}) gives no repo`, async () => {
    const { w, card } = await toBlocked({ issueUrl: url });
    try {
      const was = bytes(w);
      const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant()]) });
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, /\(none\) not granted/);
      assert.equal(bytes(w), was);
      assert.equal(w.state(ITEM), 'blocked');
    } finally { await w.close(); }
  });
}

test('pr-cards-unchanged: a merge card is checked against its PR repo (o/s), not the issue repo (o/r)', async () => {
  const w = await world();
  try {
    await w.start(ITEM);
    await w.agent(ITEM, 'brief', () => BRIEFS);
    await w.agent(ITEM, 'build', builds(w, { repo: 'o/s' }));
    await w.agent(ITEM, 'verify', verifies('PASS'));
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const card = await w.putCard(ITEM);
    assert.match(card.input.pr.url, /github\.com\/o\/s\/pull\/1$/);
    const g = (repos) => w.grants([{ id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['approve', 'reject'], repos, until: '2999-01-01T00:00:00Z' }]);
    const was = bytes(w);
    const no = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: g(['o/r']) });
    assert.equal(no.status, 2, no.stderr);
    assert.match(no.stderr, /o\/s not granted \(read from the pr\)/);
    assert.equal(bytes(w), was);
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const yes = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: g(['o/s']) });
    assert.equal(yes.status, 0, yes.stderr);
    assert.equal(w.state(ITEM), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), ['o/s#1']);
    assertAnswerRow(w, card, { choice: 'approve', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});
