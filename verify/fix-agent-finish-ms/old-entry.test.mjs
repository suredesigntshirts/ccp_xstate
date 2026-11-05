// Expect old-entry (fix-agent-finish-ms): through the real capture hook, a subagent transcript of real shape with an
// attachment row and a user row stamped 2026-10-30T10:13:50.430Z gives the run's own ms; main gave about 5.9 days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEAD, HERE, OLD, finishOf, oldEntryTranscript } from './lib.mjs';

const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8'));
const DAY = 24 * 3600 * 1000;

test('old-entry: ms is the brief to the last message, within 10 ms, despite rows stamped days before', () => {
  const t = oldEntryTranscript();
  assert.ok(t.rows.some((r) => r.type === 'attachment' && r.timestamp === OLD));
  assert.ok(t.rows.some((r) => r.type === 'user' && r.timestamp === OLD));
  const row = finishOf(HEAD, t.rows, t.agentId);
  assert.equal(t.expected, 4944); // the real run's span, 07:21:22.508Z to 07:21:27.452Z
  assert.ok(Math.abs(row.payload.ms - t.expected) <= 10, `ms ${row.payload.ms}, expected ${t.expected}`);
  assert.equal(row.payload.agentId, t.agentId);
});

test('old-entry: main, on the same inputs through its own hook, gave about 5.9 days (evidence/main-scenarios.json)', () => {
  const [row] = main.oldEntry.rows.filter((r) => r.kind === 'agent.finish');
  assert.ok(row.payload.ms > 5.8 * DAY && row.payload.ms < 6 * DAY, `main ms ${row.payload.ms}`);
});
