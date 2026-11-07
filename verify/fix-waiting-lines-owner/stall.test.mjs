// Expect stall-unchanged: stall() and cannotStart() return and journal what main does, and the Stop hook's output and
// rows are main's, for the same roots and inputs (scenarios.mjs stalls(); main's in evidence/main-scenarios.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { stalls } from './scenarios.mjs';

// prompt-catalogue: a refusal row also carries payload.message, the catalogue entry and slots its reason was rendered
// from. The row is main's once that is checked to render the reason and set aside (plan item prompt-catalogue lets a
// done verifier test compare the rendered entry instead of the literal).
const { render } = await import(new URL('../../packages/engine/src/messages.js', import.meta.url));
const asMain = (rows) => (!Array.isArray(rows) ? Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, asMain(v)])) : rows.map((r) => {
  if (r?.payload?.message === undefined) return r;
  const { message, ...payload } = r.payload;
  assert.equal(render(message.entry, message.slots), payload.reason, `${payload.rule} row: its entry renders its reason`);
  return { ...r, payload };
}));

// Main's rows as journal v2 reads them (upcast), the format the head writes. The evidence drops hashes as run-to-run
// noise, so a prompt row (in v1 a brief.stored whose role is its own actor) is told apart here by its role.
const { upcast } = await import(new URL('../../packages/journal/src/index.js', import.meta.url));
const v2 = (x) => {
  if (Array.isArray(x)) return x.map(v2);
  if (!x || typeof x !== 'object') return x;
  if (Number.isInteger(x.v) && typeof x.kind === 'string') {
    const u = upcast(x);
    return u.kind === 'brief.stored' && u.payload?.run && u.payload.role === u.payload.actor ? { ...u, kind: 'prompt.stored' } : u;
  }
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v2(v)]));
};
// A run's prompt file is prompt.md at the head, brief.md on main; the lists are sorted by name.
const renamedFiles = (x) => (Array.isArray(x) ? (x.every((f) => typeof f === 'string') ? x.map((f) => f.replace(/(^|\/)brief\.md$/, '$1prompt.md')).sort() : x.map(renamedFiles))
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, renamedFiles(v)])) : x);

const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8')).stalls;
const got = await stalls(REPO);

test('stall-unchanged: stall() and cannotStart() return main\'s answers', () => {
  assert.deepEqual(got.engine, main.engine);
  assert.equal(got.engine['stall C'], null);
  assert.deepEqual(got.engine['stall A 3'], { block: null, failed: ['a-1:0.brief'] });
  assert.match(got.engine['cannotStart wrong session'].deny, /^wrong-session: /);
});

test('stall-unchanged: the rows and run files they leave are main\'s', () => {
  assert.deepEqual(asMain(got.engineRows), v2(main.engineRows));
  assert.deepEqual(got.engineFiles, renamedFiles(main.engineFiles));
});

test('stall-unchanged: the Stop hook (and cannot-start through the hook) answers and journals as main does', () => {
  assert.deepEqual(got.hook, main.hook);
  assert.deepEqual(asMain(got.hookRows), v2(main.hookRows));
  assert.deepEqual(got.hookFiles, renamedFiles(main.hookFiles));
  assert.equal(got.hook['Stop C'], null);
  assert.equal(got.hook['Stop A 1'].decision, 'block');
  assert.equal(got.hook['Stop U 1'].decision, 'block');
});
