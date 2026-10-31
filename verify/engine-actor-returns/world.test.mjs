// World line `real`, as observed on scratch item ar2 (issue #31): the committed evidence shows the hook's block was
// delivered but the actor ended by SubagentHandback, was never re-prompted, and the item did not leave the state.
// This test pins that observation; the line is NOT MET.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const E = join(dirname(fileURLToPath(import.meta.url)), 'evidence');
const rows = readFileSync(join(E, 'item-ar2.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tail = JSON.parse(readFileSync(join(E, 'ar2-agent-tail.json'), 'utf8'));

test('real (observed, NOT MET): block delivered after SubagentHandback; no no-return refusal, no error transition', () => {
  assert.equal(tail[0].content[0].tool, 'SubagentHandback');
  assert.equal(tail.at(-1).content.type, 'hook_blocking_error');
  assert.match(tail.at(-1).content.blockingError.blockingError, /ar2:0\.brief/);
  assert.equal(rows.filter((r) => r.payload?.rule === 'no-return').length, 0);
  assert.deepEqual(rows.filter((r) => r.kind === 'engine.transition').map((r) => r.payload.event.type), ['xstate.init']);
});
