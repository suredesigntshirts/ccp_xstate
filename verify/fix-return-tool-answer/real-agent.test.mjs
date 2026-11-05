// Expect real-agent, from the verifier's own run (evidence/real-agent/): headless `claude -p --plugin-dir
// plugins/harness` (Claude Code 2.1.318) at the PR's head, a fresh HOME, CCP_HARNESS_DIR with install.json, GitHub as
// gh.mjs (PR o/r#1 whose head is the build worktree's HEAD at each request). Item rta1 was started with bin/host.js
// start (quick-fix), its brief run accepted by brief.mjs with the builder task, and the main session told to start
// `ccp-run rta1:1.build`. build-agent.jsonl is the build agent's transcript, rta1.jsonl the item's journal,
// rta1-build-result.json the run's result.json, main-session-calls.json the main session's calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE } from './lib.mjs';

const EV = join(HERE, 'evidence', 'real-agent');
const lines = (f) => readFileSync(join(EV, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('real-agent: a real build agent returned a PR ref, the hook accepted it, the tool answered accepted, once', () => {
  const uses = new Map();
  const returns = [];
  for (const x of lines('build-agent.jsonl')) for (const b of Array.isArray(x.message?.content) ? x.message.content : []) {
    if (b.type === 'tool_use' && /harness__return$/.test(b.name)) uses.set(b.id, b.input);
    if (b.type === 'tool_result' && uses.has(b.tool_use_id)) {
      const text = typeof b.content === 'string' ? b.content : b.content.map((c) => c.text ?? '').join('');
      returns.push({ id: b.tool_use_id, input: uses.get(b.tool_use_id), text, isError: b.is_error });
    }
  }
  assert.equal(uses.size, 1, 'one return call, no retry');
  assert.equal(returns.length, 1);
  const [r] = returns;
  assert.equal(r.input.run, 'rta1:1.build');
  assert.equal(r.input.result.pr.url, 'https://github.com/o/r/pull/1');
  assert.match(r.input.result.pr.at, /^[0-9a-f]{40}$/);
  assert.match(r.text, /^accepted: run rta1:1\.build's result is stored \([0-9a-f]{12}\)\. You are done\.$/);
  assert.notEqual(r.isError, true);

  const stored = JSON.parse(readFileSync(join(EV, 'rta1-build-result.json'), 'utf8'));
  assert.equal(stored.toolUseId, r.id, 'result.json is from that same call');
  assert.equal(stored.result.pr.at, r.input.result.pr.at);
  assert.equal(stored.result.pr.key, 'o/r#1', 'stamped');
  assert.equal(stored.result.pr.branch, 'fix-1');
  assert.ok(stored.result.pr.checkout);
  assert.ok(r.text.includes(stored.hash.slice(0, 12)));
  assert.equal(typeof stored.sent, 'string');

  const rows = lines('rta1.jsonl').filter((x) => x.payload?.run === 'rta1:1.build' && /refusal|result\.stored/.test(x.kind));
  assert.deepEqual(rows.map((x) => x.kind), ['result.stored'], 'one result.stored and no refusal (no already-returned)');
  assert.equal(rows[0].payload.toolUseId, r.id);
  const main = JSON.parse(readFileSync(join(EV, 'main-session-calls.json'), 'utf8'));
  assert.deepEqual(main.toolCalls.map((c) => c.name), ['Agent']);
  assert.equal(main.toolCalls[0].input.prompt, 'ccp-run rta1:1.build');
});
