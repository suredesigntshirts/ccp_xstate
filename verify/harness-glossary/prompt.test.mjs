// prompt-unchanged: for the same workflow, item and input, the engine at the head writes prompt.md byte-identical to
// the brief.md main wrote (evidence/main/, recorded by record.mjs at main in the same fixed temp layout), with the same
// hash in its prompt.stored row as main's brief.stored row; no brief.md is written; the plugin's Agent hook hands out
// those bytes; and a run folder holding only main's brief.md still starts with its bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE, REPO, actorHook, copyRun, prepared, rawRows, spawnVia, world } from './lib.mjs';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const MAIN = JSON.parse(readFileSync(join(EVIDENCE, 'main', 'answers.json'), 'utf8')).prepared;
const MAIN_RUN = join(EVIDENCE, 'main', 'run');

test('prompt-unchanged: prompt.md at the head is main\'s brief.md, byte for byte, with the same hash', (t) => {
  // record.mjs used the layout name record-prompt; the same name gives the same paths, so the bytes can be compared.
  const head = prepared(REPO, 'record-prompt');
  t.diagnostic(`main files ${MAIN.files.join(',')}; head files ${head.files.join(',')}`);
  assert.equal(head.run, MAIN.run);
  assert.equal(MAIN.file, 'brief.md');
  assert.equal(head.file, 'prompt.md');
  assert.ok(!head.files.includes('brief.md'), 'no brief.md at the head');
  assert.equal(head.text, MAIN.text);
  assert.equal(head.text, readFileSync(join(MAIN_RUN, 'brief.md'), 'utf8'));
  assert.equal(head.stored.length, 1);
  assert.equal(MAIN.stored.length, 1);
  assert.equal(MAIN.stored[0].kind, 'brief.stored');
  assert.equal(head.stored[0].kind, 'prompt.stored');
  assert.equal(head.stored[0].payload.hash, MAIN.stored[0].payload.hash);
  assert.equal(head.stored[0].payload.hash, sha(head.text));
  assert.deepEqual(head.stored[0].payload, MAIN.stored[0].payload, 'the same payload as main\'s prompt row');
  t.diagnostic(`hash ${head.stored[0].payload.hash}, ${head.text.length} chars`);
  const run = JSON.parse(readFileSync(join(head.dir, 'run.json'), 'utf8'));
  assert.equal(run.promptHash, head.stored[0].payload.hash);
  assert.ok(!('briefHash' in run));
});

test('prompt-unchanged: the Agent hook at the head hands out prompt.md, and binds with its promptHash', () => {
  const head = prepared(REPO, 'spawn-head');
  const given = spawnVia(REPO, head.w, head.run);
  assert.equal(given, head.text);
  // SubagentStart binds the agent; its agent.spawn row carries the prompt's hash as promptHash.
  actorHook(REPO, head.w, { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-1', agent_type: 'general-purpose' });
  const spawnRow = rawRows(join(head.w.root, 'items', 'hg-1.jsonl')).find((r) => r.kind === 'agent.spawn');
  assert.ok(spawnRow, 'bound');
  assert.equal(spawnRow.payload.promptHash, sha(head.text));
  assert.ok(!('briefHash' in spawnRow.payload));
});

test('prompt-unchanged: a run folder prepared by main (brief.md only) still starts with its bytes at the head', (t) => {
  const w = world('main-folder');
  const dir = copyRun(MAIN_RUN, w, MAIN.run);
  assert.ok(existsSync(join(dir, 'brief.md')) && !existsSync(join(dir, 'prompt.md')));
  const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));
  assert.ok('briefHash' in run && !('promptHash' in run), 'main\'s run.json');
  const given = spawnVia(REPO, w, MAIN.run);
  t.diagnostic(`given ${typeof given === 'string' ? `${given.length} chars` : JSON.stringify(given)}`);
  assert.equal(given, readFileSync(join(MAIN_RUN, 'brief.md'), 'utf8'));
  assert.ok(!existsSync(join(dir, 'prompt.md')), 'the old folder is not rewritten');
  actorHook(REPO, w, { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-old', agent_type: 'general-purpose' });
  const spawnRow = rawRows(join(w.root, 'items', 'hg-1.jsonl')).find((r) => r.kind === 'agent.spawn');
  assert.equal(spawnRow?.payload.promptHash, run.briefHash, 'the bound agent reports the hash of the prompt it was handed');
});
