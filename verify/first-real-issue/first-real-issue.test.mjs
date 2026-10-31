// Verifier tests for plan item first-real-issue, written by the verifier session (not the builder). Offline: they
// read the evidence committed in verify/first-real-issue/evidence/ (the item's journal, the driver's and agents'
// event logs, the GitHub JSON fetched with `gh api repos/suredesigntshirts/ccp_machine_test/...`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restore, loadWorkflow } from '../../packages/engine/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const E = join(HERE, 'evidence');
const SESSION = 'b61aac02-d158-42c9-bc6a-e013c1448ee0';
const HEAD = '68235591fa507cd0be2f8ce70d3a5114e838e2f9';
const MERGE = 'b74bddb3b7f22287c00594ba1a9561398b675121';
const jsonl = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const json = (f) => JSON.parse(readFileSync(join(E, f), 'utf8'));
const item = jsonl(join(E, 'fri-jsonl-lint.jsonl'));
const session = jsonl(join(E, `${SESSION}.jsonl`));
const pr = json('github-pr-103.json');
const transitions = item.filter((r) => r.kind === 'engine.transition');

test('merged: GitHub shows PR #103 merged at the head the verify run passed, by the owner account', () => {
  assert.equal(pr.merged, true);
  assert.equal(pr.head.sha, HEAD);
  assert.equal(pr.merge_commit_sha, MERGE);
  assert.match(pr.body, /Closes https:\/\/github\.com\/suredesigntshirts\/ccp_machine_test\/issues\/102/);
  const verify = transitions.find((r) => r.payload.event.type === 'xstate.done.actor.verify');
  assert.equal(verify.payload.event.output.result, 'PASS');
  assert.equal(verify.payload.event.output.sha, HEAD);
  const mc = json('github-merge-commit.json');
  assert.deepEqual(mc.parents.map((p) => p.sha).includes(HEAD), true);
  assert.match(mc.commit.message, /stand-in/);
});

test('merged: the host did not make the merge (no merge effect and no merge transition in the journal)', () => {
  assert.equal(item.filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'merge').length, 0);
  assert.equal(transitions.filter((r) => r.payload.event.type === 'xstate.done.actor.merge').length, 0);
  assert.equal(item.filter((r) => r.kind === 'pr.merge').length, 0);
});

test('replay: restore() rebuilds the item from its journal and it ends in awaitingMerge with the expected sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'fri-'));
  mkdirSync(join(root, 'items'));
  copyFileSync(join(E, 'fri-jsonl-lint.jsonl'), join(root, 'items', 'fri-jsonl-lint.jsonl'));
  const host = restore({ root, item: 'fri-jsonl-lint', spec: loadWorkflow('quick-fix'), session: SESSION, release: '0.1.0' });
  assert.equal(host.snapshot.value, 'awaitingMerge');
  assert.equal(host.owner, SESSION);
  assert.equal(host.snapshot.context.pr.headSha, HEAD);
  assert.equal(host.snapshot.context.verdict.sha, HEAD);
  assert.equal(host.snapshot.context.verdict.result, 'PASS');
  assert.equal(host.snapshot.context.builds, 1);
  assert.equal(host.snapshot.context.merge, null);
  // the ask run is the only run left open
  assert.deepEqual([...host.runs.values()].map((r) => r.actor ?? r.src ?? r.id).length, 1);
  assert.deepEqual(transitions.map((r) => r.payload.seq), [0, 1, 2, 3]);
  assert.deepEqual(transitions.map((r) => r.payload.outcome), ['applied', 'applied', 'applied', 'applied']);
  assert.deepEqual(transitions.map((r) => [r.payload.event.type, r.source.system]), [
    ['xstate.init', 'claude-code'], ['xstate.done.actor.brief', 'harness'],
    ['xstate.done.actor.build', 'harness'], ['xstate.done.actor.verify', 'harness']
  ]);
  assert.equal(transitions[0].source.ref, SESSION);
  for (const r of transitions.slice(1)) assert.match(r.source.ref, /^return toolu_/);
});

const files = () => [join(E, 'transcripts', `${SESSION}.jsonl`), ...readdirSync(join(E, 'transcripts', 'subagents')).filter((f) => f.endsWith('.jsonl')).map((f) => join(E, 'transcripts', 'subagents', f))];
const calls = () => {
  const m = new Map();
  for (const f of files()) for (const r of jsonl(f)) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) if (b.type === 'tool_use') m.set(b.id, b.name);
  return m;
};
const BLOCKED = 'toolu_01AiaoDxhFXWZh5AvzEtegb8';

test('complete: every tool_use in the driver and 3 agent logs has a tool.call row, except one Bash Claude Code refused to run', () => {
  assert.equal(files().length, 4);
  const c = calls();
  const rows = session.filter((r) => r.kind === 'tool.call');
  assert.equal(c.size, 28);
  assert.equal(rows.length, 27);
  for (const [id, name] of c) {
    const row = rows.find((r) => r.source.ref === id);
    if (id === BLOCKED) { assert.equal(row, undefined); continue; }
    assert.ok(row, `no journal row for ${name} ${id}`);
    assert.equal(row.payload.tool, name);
  }
  for (const r of rows) assert.ok(c.has(r.source.ref), `journal row ${r.source.ref} has no call in the logs`);
});

test('complete: the unjournalled call never ran (its result is a tool_use_error from Claude Code)', () => {
  let result;
  for (const f of files()) for (const r of jsonl(f)) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) if (b.type === 'tool_result' && b.tool_use_id === BLOCKED) result = b;
  assert.equal(result.is_error, true);
  assert.match(String(result.content), /tool_use_error>Blocked: sleep 60/);
});

test('asks: no post_message, request_decision or card call in any session; the only declared ask (awaitingMerge) is posted by the thread, not the driver', () => {
  const names = new Set(calls().values());
  assert.deepEqual([...names].sort(), ['Agent', 'Bash', 'SubagentHandback', 'ToolSearch', 'mcp__plugin_ccp-harness_harness__return']);
  for (const n of names) assert.doesNotMatch(n, /post_message|request_decision|post_widget|card|hearthbot|AskUser/i);
  for (const r of session.filter((x) => x.kind === 'tool.call')) assert.doesNotMatch(r.payload.tool, /post_message|request_decision|post_widget|card|hearthbot/i);
  const spec = JSON.parse(readFileSync(join(HERE, '..', '..', 'workflows', 'quick-fix.json'), 'utf8'));
  const asking = Object.entries(spec.states).filter(([, s]) => s.invoke?.src === 'ask').map(([k]) => k).sort();
  assert.deepEqual(asking, ['awaitingMerge', 'replanning']);
  // the run reached awaitingMerge and never replanning: the only declared ask that opened is the merge ask
  assert.equal(item.filter((r) => r.kind === 'agent.spawn').length, 3);
  // the headless driver never started the ask run: no effect row for it. The card came from the owning thread.
  assert.equal(item.filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'ask').length, 0);
  assert.ok(transitions.every((t) => t.state !== '"replanning"'));
});

test('product-ci: the test workflow is green at the PR head and at the merge commit', () => {
  for (const [f, sha] of [['github-checkruns-head.json', HEAD], ['github-checkruns-merge.json', MERGE]]) {
    const runs = json(f).check_runs.filter((c) => c.head_sha === sha);
    assert.ok(runs.length >= 1);
    for (const c of runs) { assert.equal(c.status, 'completed'); assert.equal(c.conclusion, 'success'); }
  }
});

test('product-ci: the diff adds the tool the issue asked for', () => {
  const files = Object.fromEntries(json('github-pr-103-files.json').map((f) => [f.filename, f]));
  for (const p of ['packages/jsonl-lint/bin/jsonl-lint.js', 'packages/jsonl-lint/src/index.js', 'packages/jsonl-lint/package.json', 'packages/jsonl-lint/README.md', 'packages/jsonl-lint/test/cli.test.js', 'packages/jsonl-lint/test/lint.test.js', 'README.md']) assert.ok(files[p], p);
  assert.match(json('github-issue-102.json').title, /jsonl-lint/);
});
