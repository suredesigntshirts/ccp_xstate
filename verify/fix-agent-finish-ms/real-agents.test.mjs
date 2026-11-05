// Expect real-agents (fix-agent-finish-ms): rows a real headless Claude Code session journalled with the PR's plugin
// loaded (claude -p --plugin-dir plugins/harness, prompt in evidence/real/prompt.txt). Run 2 had reads allowed; run 1's
// agents had their reads denied and finished anyway. Both runs: one foreground ccp-harness:probe-reader, one foreground
// general-purpose and one background general-purpose agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEAD, HERE, finishOf } from './lib.mjs';

const REAL = join(HERE, 'evidence', 'real');
const journal = (n) => readFileSync(join(REAL, `journal-run${n}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const t = (r) => Date.parse(r.at);

// Pairs each Agent tool.call with the agent that started just before it (the call's PostToolUse comes after the spawn).
function agents(rows) {
  const out = [];
  for (const spawn of rows.filter((r) => r.kind === 'agent.spawn')) {
    const finish = rows.find((r) => r.kind === 'agent.finish' && r.payload.agentId === spawn.payload.agentId);
    const call = rows.find((r) => r.kind === 'tool.call' && r.payload.tool === 'Agent' && t(r) >= t(spawn) && !r.agent);
    out.push({ spawn, finish, call });
  }
  return out;
}

for (const n of [1, 2]) {
  test(`real-agents run ${n}: three agents finish, each ms within 1000 of finish.at - spawn.at, foreground ones of the Agent call`, () => {
    const list = agents(journal(n));
    assert.equal(list.length, 3);
    assert.deepEqual(list.map((a) => a.spawn.payload.type), ['ccp-harness:probe-reader', 'general-purpose', 'general-purpose']);
    for (const [i, { spawn, finish, call }] of list.entries()) {
      assert.ok(finish, `agent ${spawn.payload.agentId} finished`);
      const ms = finish.payload.ms;
      assert.ok(Number.isFinite(ms) && ms > 0);
      assert.ok(Math.abs(ms - (t(finish) - t(spawn))) <= 1000, `${spawn.payload.agentId}: ms ${ms} vs ${t(finish) - t(spawn)}`);
      if (i < 2) assert.ok(Math.abs(ms - call.payload.ms) <= 1000, `${spawn.payload.agentId}: ms ${ms} vs Agent call ${call.payload.ms}`);
      else assert.ok(call.payload.ms < 1000, 'the background agent\'s Agent call returned at once');
    }
  });
}

test('real-agents: the real transcripts hold attachment rows, and the head\'s hook over their timelines gives the journalled ms', () => {
  for (const { spawn, finish } of agents(journal(2))) {
    const id = spawn.payload.agentId;
    const timeline = readFileSync(join(REAL, `agent-${id}.timeline.jsonl`), 'utf8');
    const rows = timeline.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(rows[0].type, 'user');
    assert.ok(rows.filter((r) => r.type === 'attachment').length >= 10);
    assert.equal(finishOf(HEAD, timeline, id).payload.ms, finish.payload.ms);
  }
});
