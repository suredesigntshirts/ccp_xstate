// Verifier tests for fix-grant-null-repo: null-repo-refused and named-repos-unchanged. Written from the item and the
// engine's src, not the builder's tests. The world is fix-blocked-card-grant's verifier world (real engine, the command
// line's relay as the thread, stub agents, stub GitHub): quick-fix is driven to the blocked card or the merge card, the
// card is put up with `bin/host.js card`, and answered with `bin/host.js answer` and a grants file, as a stand-in would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemFile } from '../../packages/engine/src/host.js';
import { world, blocked, builds, verifies, grant, BRIEFS, REASON } from '../fix-blocked-card-grant/lib.mjs';

const ITEM = 'a';
const bytes = (w) => readFileSync(itemFile(w.root, ITEM), 'utf8');
const standinRows = (w) => w.rows(ITEM).filter((r) => r.source?.system === 'standin');

async function toBlocked(opts) {
  const w = await world(opts);
  await w.start(ITEM);
  await w.agent(ITEM, 'brief', () => BRIEFS);
  await w.agent(ITEM, 'build', blocked());
  assert.equal(w.state(ITEM), 'blocked');
  const card = await w.putCard(ITEM);
  assert.equal(card.input.pr, undefined, 'the blocked card has no pr');
  return { w, card };
}

const NOT_GITHUB_ISSUES = ['https://gitlab.com/o/r/issues/7', 'https://github.com/o/r/pull/7', 'o/r#7'];
const NULL_GRANTS = [['repos [null]', [null]], ['repos [null, "o/r"]', [null, 'o/r']]];

for (const url of NOT_GITHUB_ISSUES) {
  test(`null-repo-refused: issue ${url}, every choice, grants with null in repos are refused; item and journal unchanged`, async () => {
    const { w, card } = await toBlocked({ issueUrl: url });
    try {
      const was = bytes(w);
      const snapWas = JSON.stringify(w.snap(ITEM).context);
      for (const [label, repos] of NULL_GRANTS) {
        for (const choice of ['retry', 'replan', 'drop']) {
          const why = choice === 'replan' ? 'why 1: a real why' : undefined;
          const r = await w.answer(ITEM, { effect: card.effect, choice, why, grants: w.grants([grant({ repos })]) });
          assert.equal(r.status, 2, `${label} ${choice}: exit 2 (stdout ${r.stdout} stderr ${r.stderr})`);
          assert.match(r.stderr, /refused/, `${label} ${choice}`);
          assert.match(r.stderr, /\bvg\b/, `${label} ${choice}: names the grant`);
          assert.match(r.stderr, /\(none\) not granted/, `${label} ${choice}: names the missing repo`);
          assert.match(r.stderr, /card has no pr/, `${label} ${choice}: says the card has no repository`);
          assert.equal(bytes(w), was, `${label} ${choice}: journal unchanged`);
          assert.equal(w.state(ITEM), 'blocked', `${label} ${choice}: still blocked`);
          assert.equal(JSON.stringify(w.snap(ITEM).context), snapWas, `${label} ${choice}: context unchanged`);
        }
      }
      assert.equal(standinRows(w).length, 0);
    } finally { await w.close(); }
  });
}

test('null-repo-refused: several null-listing grants in one file are all refused, each named', async () => {
  const { w, card } = await toBlocked({ issueUrl: 'https://gitlab.com/o/r/issues/7' });
  try {
    const was = bytes(w);
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ id: 'g1', repos: [null] }), grant({ id: 'g2', repos: [null, 'o/r'] })]) });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /g1/);
    assert.match(r.stderr, /g2/);
    assert.equal(bytes(w), was);
  } finally { await w.close(); }
});

test('named-repos-unchanged: grant [null, "o/r"] answers the blocked card of an o/r issue', async () => {
  const { w, card } = await toBlocked({ issueUrl: 'https://github.com/o/r/issues/12' });
  try {
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ repos: [null, 'o/r'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'building');
    assert.equal(w.snap(ITEM).context.failure, `build blocked: ${REASON}`);
    const rows = standinRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].payload.outcome, 'applied');
    assert.deepEqual(rows[0].payload.event.output, { choice: 'retry', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('named-repos-unchanged: grant [null, "o/r"] answers the merge card of a PR in o/r', async () => {
  const w = await world({ issueUrl: 'https://gitlab.com/o/r/issues/7' });
  try {
    await w.start(ITEM);
    await w.agent(ITEM, 'brief', () => BRIEFS);
    await w.agent(ITEM, 'build', builds(w, { repo: 'o/r' }));
    await w.agent(ITEM, 'verify', verifies('PASS'));
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const card = await w.putCard(ITEM);
    assert.match(card.input.pr.url, /github\.com\/o\/r\/pull\/1$/);
    const g = { id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['approve', 'reject'], repos: [null, 'o/r'], until: '2999-01-01T00:00:00Z' };
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: w.grants([g]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), ['o/r#1']);
    assert.equal(standinRows(w).length, 1);
  } finally { await w.close(); }
});
