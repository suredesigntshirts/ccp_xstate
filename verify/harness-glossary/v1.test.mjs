// v1-reads: readFile at the head over committed v1 journals reports no bad rows and yields the mapped kinds and
// promptHash; derive.js stalls counts the same as at main; the inspector's export of a committed v1 run shows its
// prompt text equal to its brief.md, with every hash check ok as at main. Main's answers: evidence/main/answers.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE, REPO, V1, rawRows, v1Reads } from './lib.mjs';

const MAIN = JSON.parse(readFileSync(join(EVIDENCE, 'main', 'answers.json'), 'utf8')).v1;
const HEAD = await v1Reads(REPO);

/** What the upcaster should make of each raw v1 row, worked out here from the item's outcome, not from its code. */
function expectedKinds(rel) {
  const kinds = {};
  for (const r of rawRows(join(REPO, rel))) {
    let k = r.kind;
    if (k === 'brief.stored' && r.payload?.contextHash) k = 'prompt.stored';
    else if (k === 'brief.stored' && !r.payload?.run) k = 'agent.prompt';
    else if (k === 'result.stored' && !r.payload?.run) k = 'agent.final';
    kinds[k] = (kinds[k] ?? 0) + 1;
  }
  return kinds;
}

test('v1-reads: every committed v1 journal reads with no bad rows, at v2, in the mapped kinds', (t) => {
  for (const [key, rel] of Object.entries(V1)) {
    const raw = rawRows(join(REPO, rel));
    assert.ok(raw.every((r) => r.v === 1), `${rel} is a v1 journal`);
    const h = HEAD.reads[key];
    t.diagnostic(`${rel}: ${h.rows} rows, bad ${h.bad.length}, kinds ${JSON.stringify(h.kinds)}`);
    assert.deepEqual(h.bad, [], rel);
    assert.equal(h.rows, raw.length, `${rel}: every row read`);
    assert.equal(MAIN.reads[key].rows, raw.length, `${rel}: main read every row too`);
    assert.deepEqual(h.versions, [2]);
    assert.deepEqual(h.kinds, expectedKinds(rel), rel);
    // agent.spawn: briefHash becomes promptHash, value kept.
    const rawSpawns = raw.filter((r) => r.kind === 'agent.spawn');
    assert.deepEqual(h.spawnHashes, rawSpawns.map((r) => ({ promptHash: r.payload.briefHash })), `${rel} spawn hashes`);
  }
  // Each journal holds at least one of the shapes the upcaster maps.
  assert.ok(HEAD.reads.toyItem.kinds['prompt.stored'] === 3 && HEAD.reads.toyItem.kinds['brief.stored'] === 2, 'engine prompt rows mapped, returned briefs kept');
  assert.ok(HEAD.reads.toySession.kinds['agent.prompt'] === 3 && HEAD.reads.toySession.kinds['agent.final'] === 5);
  assert.ok(!('brief.stored' in HEAD.reads.finishRun1.kinds) && !('result.stored' in HEAD.reads.finishRun1.kinds));
  assert.ok(HEAD.reads.bench.spawnHashes[0].promptHash?.length === 64);
});

test('v1-reads: derive.js stalls gives the same prepared and blocked counts as main', (t) => {
  t.diagnostic(`main ${JSON.stringify(MAIN.stalls)}; head ${JSON.stringify(HEAD.stalls)}`);
  assert.deepEqual(HEAD.stalls, MAIN.stalls);
  assert.equal(HEAD.stalls.toyItem.prepared, 3);
  assert.equal(HEAD.stalls.bench.prepared, 1);
});

test('v1-reads: the inspector shows each model run\'s prompt as its brief.md, every check ok as at main', (t) => {
  t.diagnostic(`main ${JSON.stringify(MAIN.export)}`);
  t.diagnostic(`head ${JSON.stringify(HEAD.export)}`);
  assert.ok(HEAD.export.models.length >= 1);
  assert.deepEqual(HEAD.export.models, MAIN.export.models);
  assert.ok(HEAD.export.models.every((m) => m.textEqualsBriefMd));
  assert.ok(HEAD.export.checks.length >= 2 && HEAD.export.checks.every((c) => c.ok === true));
  assert.equal(HEAD.export.checks.length, MAIN.export.checks.length);
  assert.ok(MAIN.export.checks.every((c) => c.ok === true));
  assert.deepEqual(HEAD.export.hashOk, MAIN.export.hashOk);
});
