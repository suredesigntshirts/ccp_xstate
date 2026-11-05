// Expect lines-owned: through the real hook script, each session's UserPromptSubmit and PostToolUse-of-Agent lines
// name only the waiting runs of items it owns; a session owning nothing gets no output; the cloud URL form owns its
// runs; on main (evidence/main-scenarios.json, scenarios.mjs run on 3be0740) the same input names every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { lines } from './scenarios.mjs';

const HEADER = 'ccp-harness: actor runs prepared and waiting for their agent:';
const line = (item) => `- brief for ${item}:0.brief: Agent tool with prompt exactly "ccp-run ${item}:0.brief"`;
const text = (...items) => [HEADER, ...items.map(line)].join('\n');
const want = (event, ...items) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text(...items) } });
const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8'));

const got = lines(REPO);

for (const [asker, items] of [['A', ['a-1']], ['B', ['b-1']], ['U', ['u-1']], ['A+cloud', ['a-1', 'u-1']]]) {
  test(`lines-owned: ${asker} is named only its own runs (${items.join(', ')}) after a wake and after an Agent call`, () => {
    assert.deepEqual(got[asker].wake, want('UserPromptSubmit', ...items));
    assert.deepEqual(got[asker].afterAgent, want('PostToolUse', ...items));
  });
}

test('lines-owned: a session owning no item gets no output', () => {
  assert.equal(got.C.wake, null);
  assert.equal(got.C.afterAgent, null);
});

test('lines-owned: on main the same inputs name every session\'s runs, and the line text is main\'s', () => {
  for (const asker of ['A', 'B', 'C', 'U', 'A+cloud']) {
    assert.deepEqual(main.lines[asker].wake, want('UserPromptSubmit', 'a-1', 'b-1', 'u-1'), asker);
    assert.deepEqual(main.lines[asker].afterAgent, want('PostToolUse', 'a-1', 'b-1', 'u-1'), asker);
  }
  assert.notDeepEqual(got, main.lines);
});
