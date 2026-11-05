// Expect stall-unchanged: stall() and cannotStart() return and journal what main does, and the Stop hook's output and
// rows are main's, for the same roots and inputs (scenarios.mjs stalls(); main's in evidence/main-scenarios.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { stalls } from './scenarios.mjs';

const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8')).stalls;
const got = await stalls(REPO);

test('stall-unchanged: stall() and cannotStart() return main\'s answers', () => {
  assert.deepEqual(got.engine, main.engine);
  assert.equal(got.engine['stall C'], null);
  assert.deepEqual(got.engine['stall A 3'], { block: null, failed: ['a-1:0.brief'] });
  assert.match(got.engine['cannotStart wrong session'].deny, /^wrong-session: /);
});

test('stall-unchanged: the rows and run files they leave are main\'s', () => {
  assert.deepEqual(got.engineRows, main.engineRows);
  assert.deepEqual(got.engineFiles, main.engineFiles);
});

test('stall-unchanged: the Stop hook (and cannot-start through the hook) answers and journals as main does', () => {
  assert.deepEqual(got.hook, main.hook);
  assert.deepEqual(got.hookRows, main.hookRows);
  assert.deepEqual(got.hookFiles, main.hookFiles);
  assert.equal(got.hook['Stop C'], null);
  assert.equal(got.hook['Stop A 1'].decision, 'block');
  assert.equal(got.hook['Stop U 1'].decision, 'block');
});
