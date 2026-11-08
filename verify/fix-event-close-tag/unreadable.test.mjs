// Expect: fix-event-close-tag/unreadable-journalled
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wakeOf, checkData, item, githubTransitions } from './wake-lib.mjs';

const full = JSON.stringify(checkData('t'));
const cut = `<wake reason="external-event" current-time="2026-10-30T17:02:44Z">\n  <event source="github" kind="check_run.completed" from="system" trust="relay">\n    ${full.slice(0, 40)}\n</wake>\n`;
const cases = {
  'cut off before the wake ends': cut,
  'a body that does not parse': wakeOf([{ kind: 'check_run.completed', body: `{"check":"test", conclusion: failure` }]),
  'a JSON array body': wakeOf([{ kind: 'check_run.completed', body: JSON.stringify([checkData('t')]) }])
};

for (const [name, text] of Object.entries(cases)) {
  test(`an event with ${name} journals one refused unreadable row, leaves the state, and again is a duplicate`, async () => {
    const { wake, rows } = await item();
    const r0 = rows();
    const before = r0.at(-1).state;
    const r1 = wake(text);
    const first = githubTransitions(rows(), r0);
    assert.equal(first.length, 1, JSON.stringify(first.map((x) => x.payload)));
    assert.equal(first[0].payload.outcome, 'refused');
    assert.match(first[0].payload.reason, /unreadable/);
    assert.equal(first[0].payload.event.type, 'github.check_run.completed');
    // The host first finishes effects left open (the approval card it put up), so effect rows may be added; no other
    // transition is.
    const ids = new Set(r0.map((r) => r.id));
    assert.deepEqual(rows().filter((r) => !ids.has(r.id) && r.kind === 'engine.transition').map((r) => r.payload.outcome), ['refused']);
    assert.equal(first[0].state, before);
    assert.equal(r1.state, JSON.parse(before));
    const r1rows = rows();
    const r2 = wake(text);
    const again = githubTransitions(rows(), r1rows);
    assert.equal(again.length, 1);
    assert.equal(again[0].payload.outcome, 'duplicate');
    assert.equal(r2.state, JSON.parse(before));
  });
}
