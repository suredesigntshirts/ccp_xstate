// Verifier's tests for plan item fix-verify-issue-echo. A quick-fix item is started on the real engine (tourney world:
// real spawn, bind, accept() and drive) with an input issue that has url, title, body and expect, driven to
// verifying, and the verify run's result is checked by accept(). Also reads the verify run's brief.md and stage.json
// for the Output wording, and the research workflow's verify issue description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, BRIEFS, builds, suiteWake } from '../../packages/engine/test/tourney/world.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ISSUE = {
  url: 'https://github.com/o/r/issues/42',
  title: 'Add clamp',
  body: 'Please add clamp(x, lo, hi) to math.js.',
  expect: ['clamp is exported from math.js', 'clamp throws a RangeError when lo > hi', 'README documents clamp']
};

async function atVerify(w, id) {
  await w.start(id, 'quick-fix', { issue: ISSUE });
  assert.ok((await w.agent(id, 'brief', () => BRIEFS)).accepted);
  await w.drive(id);
  assert.ok((await w.agent(id, 'build', builds(w, 1))).accepted);
  await w.drive(id);
  if (w.host(id).snapshot.value !== 'verifying') await w.drive(id, suiteWake(w.host(id).snapshot.context.pr.at));
  assert.equal(w.host(id).snapshot.value, 'verifying');
  assert.deepEqual(w.openRun(id, 'verify').input.issue, ISSUE, 'the verify run gets all four keys');
}

const verdict = (w, issueOf) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return {
    result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: issueOf(structuredClone(input.issue)),
    lines: input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: `checked: ${line}` }))
  };
};

test('trimmed-accepted: { url, expect } is accepted and the item moves on', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 't1');
    const got = await w.agent('t1', 'verify', verdict(w, (i) => ({ url: i.url, expect: i.expect })), 'ag-t1-v');
    assert.ok(got.accepted, JSON.stringify(got));
    await w.drive('t1');
    assert.equal(w.host('t1').snapshot.value, 'awaitingMerge');
    assert.equal(w.rows('t1').filter((r) => r.kind === 'refusal').length, 0);
  } finally { await w.close(); }
});

test('trimmed-accepted: in a fresh item, all four keys in another order are accepted', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 't2');
    const got = await w.agent('t2', 'verify', verdict(w, (i) => ({ body: i.body, expect: i.expect, title: i.title, url: i.url })), 'ag-t2-v');
    assert.ok(got.accepted, JSON.stringify(got));
    await w.drive('t2');
    assert.equal(w.host('t2').snapshot.value, 'awaitingMerge');
  } finally { await w.close(); }
});

const TAMPERED = {
  'one expect line with a word changed': (i) => ({ url: i.url, expect: [i.expect[0], 'clamp throws a TypeError when lo > hi', i.expect[2]] }),
  'one expect line dropped': (i) => ({ url: i.url, expect: [i.expect[0], i.expect[2]] }),
  'url changed': (i) => ({ url: 'https://github.com/o/r/issues/43', expect: i.expect }),
  'title differs (full echo)': (i) => ({ ...i, title: 'Add clamp ' }),
  'extra key labels': (i) => ({ url: i.url, expect: i.expect, labels: ['bug'] }),
  // Beyond the brief: an extra entry inside expect, and url left out (schema-required).
  'expect line added': (i) => ({ url: i.url, expect: [...i.expect, 'clamp is fast'] }),
};

test('tamper-refused: each tampered issue is refused as restated, journalled, item stays verifying', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 't3');
    const seen = {};
    for (const [what, issueOf] of Object.entries(TAMPERED)) {
      const got = await w.agent('t3', 'verify', verdict(w, issueOf), 'ag-t3-v');
      assert.equal(got.accepted, undefined, `${what}: ${JSON.stringify(got)}`);
      assert.equal(got.refused?.rule, 'restated', `${what}: ${JSON.stringify(got)}`);
      seen[what] = got.refused.reason;
      await w.drive('t3');
      assert.equal(w.host('t3').snapshot.value, 'verifying', what);
    }
    const rows = w.rows('t3').filter((r) => r.kind === 'refusal' && r.payload.rule === 'restated');
    assert.equal(rows.length, Object.keys(TAMPERED).length, 'every refusal journalled as restated');
    // url omitted: the schema requires it, so it is refused (by schema, not restated).
    const noUrl = await w.agent('t3', 'verify', verdict(w, (i) => ({ expect: i.expect })), 'ag-t3-v');
    assert.ok(noUrl.refused, JSON.stringify(noUrl));
    seen['url omitted'] = `${noUrl.refused.rule}: ${noUrl.refused.reason}`;
    const ok = await w.agent('t3', 'verify', verdict(w, (i) => i), 'ag-t3-v');
    assert.ok(ok.accepted, 'the exact echo still counts after refusals');
    console.log(JSON.stringify(seen, null, 1));
  } finally { await w.close(); }
});

function files(dir, name, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files(p, name, out); else if (e === name) out.push(p);
  }
  return out;
}

test('prompt-agrees: quick-fix verify brief.md and stage.json, and research verify description', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 't4');
    const briefs = files(w.root, 'brief.md').filter((p) => /verify/.test(p));
    assert.ok(briefs.length >= 1, `a verify brief.md under ${w.root}`);
    const brief = readFileSync(briefs[0], 'utf8');
    const output = brief.slice(brief.indexOf('## Output'), brief.indexOf('## Return') > 0 ? brief.indexOf('## Return') : undefined);
    assert.ok(output.length > 20, 'brief has an Output part');
    assert.doesNotMatch(output, /same keys in the same order/);
    assert.doesNotMatch(output, /byte for byte/);
    assert.match(output, /url and expect copied exactly/);
    assert.match(output, /may leave out title, body/);
    const stage = readFileSync(join(dirname(briefs[0]), 'stage.json'), 'utf8');
    assert.doesNotMatch(stage, /same keys in the same order/);
    assert.match(stage, /url and expect copied exactly/);
    assert.match(stage, /may leave out title, body/);
    const research = JSON.parse(readFileSync(join(REPO, 'workflows/research.json'), 'utf8'));
    const desc = JSON.stringify(research).match(/"issue":\{"\$ref":"#issue","description":"([^"]*)"/)?.[1];
    assert.ok(desc, 'research verify issue description');
    assert.doesNotMatch(desc, /same order/);
    assert.match(desc, /url and expect copied exactly/);
    assert.match(desc, /may leave out title, body/);
    console.log(briefs[0]);
    console.log(output);
  } finally { await w.close(); }
});
