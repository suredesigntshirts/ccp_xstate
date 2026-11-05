// Expect real-session, over committed evidence of one headless claude -p session (2.1.318) with the PR head's plugin
// loaded inline (--plugin-dir plugins/harness at 0d52d7a, --session-id s1, CLAUDE_CODE_REMOTE_SESSION_ID unset, fresh
// HOME). Before it ran, bin/host.js started quick-fix r1 --session s1 and r2 --session other, each with its brief run
// prepared. evidence/real-session/: s1-extract.jsonl (init, the UserPromptSubmit/PostToolUse:Agent/Stop hook outputs
// and the main session's tool calls, cut from the stream-json; the full stream holds the account email), both item
// files, each run folder's file list, and the two session ids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE } from './lib.mjs';

const E = join(HERE, 'evidence', 'real-session');
const jsonl = (f) => readFileSync(join(E, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ids = JSON.parse(readFileSync(join(E, 'sessions.json'), 'utf8'));
const ev = jsonl('s1-extract.jsonl');
const contexts = ev.filter((e) => e.type === 'hook_response' && /^(UserPromptSubmit|PostToolUse:Agent)/.test(e.hook_name) && /actor runs prepared and waiting/.test(e.output));

test('real-session: the session is s1 with the PR\'s plugin loaded inline', () => {
  assert.equal(ev[0].session_id, ids.s1);
  assert.notEqual(ids.s1, ids.other);
  assert.deepEqual(ev[0].plugins, [{ name: 'ccp-harness', source: 'ccp-harness@inline' }]);
  assert.equal(ev[0].agent_tool_listed_as, 'Task'); // init lists the Agent tool by its old name; the calls below are named Agent
});

test('real-session: every waiting-runs line names only s1\'s item r1, never r2', () => {
  assert.ok(contexts.length >= 2, 'a wake line and a line after an Agent call');
  assert.match(contexts[0].hook_name, /^UserPromptSubmit/);
  assert.match(contexts[0].output, /- brief for r1:0\.brief: Agent tool with prompt exactly \\"ccp-run r1:0\.brief\\"/);
  assert.ok(contexts.some((c) => /^PostToolUse:Agent/.test(c.hook_name) && /ccp-run r1:1\.build/.test(c.output)));
  for (const c of contexts) assert.doesNotMatch(c.output, /r2:/);
});

test('real-session: the session started only its own runs; agent.spawn rows for r1, none for r2', () => {
  const agents = ev.filter((e) => e.type === 'tool_use' && e.name === 'Agent').map((e) => e.input.prompt);
  assert.deepEqual(agents, ['ccp-run r1:0.brief', 'ccp-run r1:1.build']);
  const r1 = jsonl('r1.jsonl').filter((r) => r.kind === 'agent.spawn').map((r) => [r.payload.run, r.session]);
  assert.deepEqual(r1, [['r1:0.brief', ids.s1], ['r1:1.build', ids.s1]]);
  const r2 = jsonl('r2.jsonl');
  assert.ok(r2.every((r) => r.session === ids.other));
  assert.equal(r2.filter((r) => r.kind === 'agent.spawn').length, 0);
});

test('real-session: r2\'s run stays waiting with no spawn.json', () => {
  const files = Object.fromEntries(readFileSync(join(E, 'run-files.txt'), 'utf8').trim().split('\n').map((l) => l.split(': ')).map(([k, v]) => [k, v.trim().split(' ')]));
  assert.deepEqual(files['r2/runs/0.brief'], ['brief.md', 'context.md', 'run.json', 'stage.json']);
  assert.ok(files['r1/runs/0.brief'].includes('spawn.json'));
  const r2 = jsonl('r2.jsonl');
  assert.ok(r2.some((r) => r.kind === 'brief.stored' && r.payload.run === 'r2:0.brief'));
});
