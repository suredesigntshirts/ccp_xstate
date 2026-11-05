// Expect real-session, over the committed evidence of two headless claude -p sessions (2.1.318) with the PR's
// plugin loaded inline (--plugin-dir plugins/harness, --session-id = the item's owner). s1 plain; s2 with
// --disallowedTools Agent. evidence/real-session/: main-session stream-json events, item files, r3's failed.json,
// host.js show of r3, and derive.js stalls over the whole journal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE } from './lib.mjs';

const E = join(HERE, 'evidence', 'real-session');
const lines = (f) => readFileSync(join(E, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const json = (f) => JSON.parse(readFileSync(join(E, f), 'utf8'));
const ids = json('sessions.json');
const stopBlocks = (ev) => ev.filter((m) => m.type === 'system' && m.subtype === 'hook_response' && /^Stop/.test(m.hook_name ?? '') && /"decision":"block"/.test(m.output ?? m.stdout ?? ''));
const toolUses = (ev) => ev.filter((m) => m.type === 'assistant').flatMap((m) => m.message.content.filter((c) => c.type === 'tool_use'));

test('real-session s1: the stop is blocked, then the model calls Agent with ccp-run; stall row then agent.spawn', () => {
  const ev = lines('s1-main.jsonl');
  const init = ev.find((m) => m.subtype === 'init');
  assert.equal(init.session_id, ids.s1);
  assert.ok(init.plugins.some((p) => p.name === 'ccp-harness' && p.source === 'ccp-harness@inline'));
  const i = ev.indexOf(stopBlocks(ev)[0]);
  assert.ok(i > 0, 'a Stop hook answered block');
  const after = toolUses(ev.slice(i));
  assert.equal(after[0].name, 'Agent');
  assert.equal(after[0].input.prompt, 'ccp-run r1:0.brief');
  const rows = lines('r1.jsonl');
  const stall = rows.findIndex((r) => r.kind === 'refusal' && r.payload.rule === 'stall' && r.payload.run === 'r1:0.brief');
  const spawn = rows.findIndex((r) => r.kind === 'agent.spawn' && r.payload.run === 'r1:0.brief');
  assert.ok(stall >= 0 && spawn > stall, 'stall row, then the run\'s agent.spawn row');
  assert.equal(rows[stall].payload.count, 1);
  assert.equal(rows[stall].payload.hookSession, ids.s1);
  // The model did not call Agent before the block: its first answer was the bare "ok".
  assert.equal(toolUses(ev.slice(0, i)).length, 0);
});

test('real-session s2 (no Agent tool): two blocks, then the run fails at the cap and the item is in replanning', () => {
  const ev = lines('s2-main.jsonl');
  const init = ev.find((m) => m.subtype === 'init');
  assert.equal(init.session_id, ids.s2);
  assert.equal(init.tools.includes('Agent'), false);
  assert.equal(stopBlocks(ev).length, 2);
  assert.equal(toolUses(ev).filter((t) => t.name === 'Agent').length, 0);
  const rows = lines('r3.jsonl').filter((r) => r.kind === 'refusal');
  assert.deepEqual(rows.map((r) => [r.payload.rule, r.payload.count ?? null]), [['stall', 1], ['stall', 2], ['stall-cap', null]]);
  assert.match(json('r3-failed.json').why, /^stalled:/);
  assert.equal(json('r3-show.json').state, 'replanning');
});

test('real-session: derive.js stalls over that journal shows both blocked, one started after a block, one failed at the cap', () => {
  const v = json('stalls.json');
  assert.equal(v.blocked, 2);
  assert.equal(v.startedAfterBlock, 1);
  assert.equal(v.failedAtCap, 1);
  const by = Object.fromEntries(v.runs.map((e) => [e.run, e]));
  assert.deepEqual([by['r1:0.brief'].blocks, by['r1:0.brief'].startedAfterBlock], [1, true]);
  assert.deepEqual([by['r3:0.brief'].blocks, by['r3:0.brief'].failed], [2, 'stall-cap']);
});
