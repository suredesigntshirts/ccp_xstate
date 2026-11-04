// fix-verify-issue-echo: the verify stage restates its input issue. Rule restated compares what the result carries,
// so a verdict that leaves out title and body (the Schema requires only url and expect) is accepted, while any
// carried key that differs from the input is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, BRIEFS, builds, suiteWake } from './world.js';
import { agrees } from '../../src/actors.js';

const FULL = { url: 'https://github.com/o/r/issues/7', title: 'Add multiply', body: 'Please add multiply to math.js.', expect: ['math.js exports multiply', 'README.md documents multiply'] };

async function atVerify(w, id) {
  await w.start(id, 'quick-fix', { issue: FULL });
  assert.ok((await w.agent(id, 'brief', () => BRIEFS)).accepted);
  await w.drive(id);
  assert.ok((await w.agent(id, 'build', builds(w, 1))).accepted);
  await w.drive(id);
  if (w.host(id).snapshot.value !== 'verifying') await w.drive(id, suiteWake(w.host(id).snapshot.context.pr.at));
  assert.equal(w.host(id).snapshot.value, 'verifying');
  assert.deepEqual(w.openRun(id, 'verify').input.issue, FULL);
}

const verdictWith = (w, issue) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return { result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: issue(input.issue), lines: input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: 'ran it' })) };
};

test('echo: a verdict whose issue carries only url and expect is accepted and stored as sent', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 'e1');
    const got = await w.agent('e1', 'verify', verdictWith(w, ({ url, expect }) => ({ url, expect })), 'ag-v');
    assert.ok(got.accepted, JSON.stringify(got.refused));
    await w.drive('e1');
    const h = w.host('e1');
    assert.equal(h.snapshot.value, 'awaitingMerge');
    assert.deepEqual(h.snapshot.context.verdict.issue, { url: FULL.url, expect: FULL.expect });
    assert.deepEqual(h.snapshot.context.issue, FULL, 'the item keeps the full issue');
  } finally {
    await w.close();
  }
});

test('echo: the full issue in another key order is accepted', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 'e2');
    const got = await w.agent('e2', 'verify', verdictWith(w, (i) => ({ expect: i.expect, body: i.body, url: i.url, title: i.title })), 'ag-v');
    assert.ok(got.accepted, JSON.stringify(got.refused));
  } finally {
    await w.close();
  }
});

const TAMPERED = {
  'an expect line changed': (i) => ({ url: i.url, expect: [i.expect[0], 'README.md mentions multiply'] }),
  'an expect line dropped': (i) => ({ url: i.url, expect: [i.expect[0]] }),
  'expect reordered': (i) => ({ url: i.url, expect: [...i.expect].reverse() }),
  'the url changed': (i) => ({ url: 'https://github.com/o/r/issues/8', expect: i.expect }),
  'a different title': (i) => ({ ...i, title: 'Add divide' }),
  'a key the input lacks': (i) => ({ url: i.url, expect: i.expect, labels: ['bug'] })
};

test('echo: a verdict whose issue differs from the input in anything it carries is refused as restated', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 'e3');
    for (const [what, issue] of Object.entries(TAMPERED)) {
      const got = await w.agent('e3', 'verify', verdictWith(w, issue), 'ag-v');
      assert.equal(got.refused?.rule, 'restated', what);
      await w.drive('e3');
      assert.equal(w.host('e3').snapshot.value, 'verifying', what);
      assert.equal(w.host('e3').snapshot.context.verdict, null, what);
    }
    assert.ok((await w.agent('e3', 'verify', verdictWith(w, (i) => i), 'ag-v')).accepted, 'the exact echo still counts');
  } finally {
    await w.close();
  }
});

test('agrees: objects may leave out keys; arrays and values compare exactly', () => {
  assert.ok(agrees({ a: 1 }, { a: 1, b: 2 }));
  assert.ok(agrees({ b: 2, a: { c: 1 } }, { a: { c: 1, d: 2 }, b: 2 }));
  assert.ok(!agrees({ a: 1, z: 0 }, { a: 1 }));
  assert.ok(!agrees({ a: 2 }, { a: 1 }));
  assert.ok(!agrees([1], [1, 2]));
  assert.ok(!agrees([{ a: 1 }], [{ a: 1, b: 2 }]), 'an object inside an array is compared whole');
  assert.ok(agrees([{ b: 2, a: 1 }], [{ a: 1, b: 2 }]));
  assert.ok(!agrees(null, { a: 1 }));
  assert.ok(!agrees({}, null));
  assert.ok(agrees('x', 'x'));
});
