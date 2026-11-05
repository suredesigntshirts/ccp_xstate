// Verifier tests for plan item probe-plugin-agents. They read two sets of evidence from real claude sessions in a cloud
// container, each with the plugin installed by infra/cloud-environment/setup.sh into a fresh HOME and no --plugin-dir:
// the builder's (plan/research/probe-plugin-agents/) and the verifier's own rerun at the PR head (evidence/ here).
// Each set has run1 (listed, tools, model, system prompt), run2 (prompt swap and SubagentStart binding with
// probe-reader, which cannot return) and run3 (probe-returner, whose tools name the return tool).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const sets = {
  builder: join(repo, 'plan', 'research', 'probe-plugin-agents'),
  verifier: join(here, 'evidence')
};
const MARKER = 'QUILLMARROW';
const AGENT = 'ccp-harness:probe-reader';
const RETURN_TOOL = 'mcp__plugin_ccp-harness_harness__return';

const lines = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** { init, result } from the builder's session.json or the verifier's stream-json session.jsonl. */
function session(dir) {
  const json = join(dir, 'session.json');
  if (existsSync(json)) return JSON.parse(readFileSync(json, 'utf8'));
  const rows = lines(join(dir, 'session.jsonl'));
  return {
    init: rows.find((r) => r.type === 'system' && r.subtype === 'init'),
    result: rows.filter((r) => r.type === 'result').at(-1)
  };
}

/** The one subagent of a run: its transcript rows and meta.json. */
function subagent(dir) {
  const name = readdirSync(dir).find((f) => /^agent-.*\.jsonl$/.test(f));
  return {
    rows: lines(join(dir, name)),
    meta: JSON.parse(readFileSync(join(dir, name.replace(/\.jsonl$/, '.meta.json')), 'utf8'))
  };
}

const text = (content) =>
  typeof content === 'string' ? content : content.map((c) => c.text ?? '').join('');
const assistants = (rows) => rows.filter((r) => r.type === 'assistant');
const toolCalls = (rows) =>
  assistants(rows).flatMap((r) => r.message.content.filter((c) => c.type === 'tool_use').map((c) => c.name));
const handback = (rows) =>
  assistants(rows).flatMap((r) => r.message.content.filter((c) => c.type === 'tool_use' && c.name === 'SubagentHandback'))
    .map((c) => c.input.message).join('\n') +
  assistants(rows).map((r) => text(r.message.content)).join('\n');

for (const [who, root] of Object.entries(sets)) {
  test(`${who}: listed: the plugin loads from the skills dir and the Agent tool starts ${AGENT}`, () => {
    const { init } = session(join(root, 'run1'));
    assert.ok(init.agents.includes(AGENT), 'init.agents lists the plugin agent');
    const plugin = init.plugins.find((p) => p.name === 'ccp-harness');
    assert.equal(plugin.source, 'ccp-harness@skills-dir');
    assert.match(plugin.path, /\/\.claude\/skills\/ccp-harness$/);
    const { meta } = subagent(join(root, 'run1'));
    assert.equal(meta.agentType, AGENT);
    assert.equal(meta.isBuiltIn, false);
  });

  test(`${who}: holds: only Read and Glob are called, every turn is haiku, and the marker comes from the agent body`, () => {
    const { rows } = subagent(join(root, 'run1'));
    const calls = toolCalls(rows);
    assert.ok(calls.includes('Read'));
    assert.deepEqual(calls.filter((n) => !['Read', 'Glob', 'SubagentHandback'].includes(n)), []);
    const models = new Set(assistants(rows).map((r) => r.message.model));
    assert.deepEqual([...models], ['claude-haiku-5-5']);
    const prompt = readFileSync(join(root, 'run1', 'prompt.txt'), 'utf8');
    assert.ok(!prompt.includes(MARKER), 'the task prompt does not give the marker');
    assert.ok(!text(rows.find((r) => r.type === 'user').message.content).includes(MARKER));
    assert.match(handback(rows), new RegExp(`^${MARKER}`, 'm'));
    assert.match(handback(rows), /no (file-?writ\w*|Write) tool/i);
    const usage = session(join(root, 'run1')).result.modelUsage;
    assert.ok(usage['claude-haiku-5-5'], 'the session bills haiku for the agent');
  });

  test(`${who}: harness-works: the swap hands the agent its brief byte for byte, and SubagentStart binds it`, () => {
    const dir = join(root, 'run2');
    const { rows, meta } = subagent(dir);
    assert.equal(meta.agentType, AGENT);
    const brief = readFileSync(join(dir, 'run-folder', 'brief.md'), 'utf8');
    const first = text(rows.find((r) => r.type === 'user').message.content);
    assert.equal(first, brief, 'the first user message is the run brief');
    const item = lines(join(dir, 'item.jsonl'));
    const spawn = item.find((r) => r.kind === 'agent.spawn');
    assert.equal(spawn.payload.type, AGENT);
    assert.equal(spawn.payload.via, 'start');
    assert.equal(spawn.payload.briefHash, sha(brief));
    const spawnFile = JSON.parse(readFileSync(join(dir, 'run-folder', 'spawn.json'), 'utf8'));
    assert.equal(spawnFile.session, session(dir).init.session_id, 'spawn.json names the session that ran the call');
    const agentFile = JSON.parse(readFileSync(join(dir, 'run-folder', 'agent.json'), 'utf8'));
    assert.equal(agentFile.agentId, spawn.payload.agentId);
    assert.equal(agentFile.via, 'start');
    // probe-reader has no return tool, so the run is sent back once and then fails.
    assert.deepEqual(item.filter((r) => r.kind === 'refusal').map((r) => r.payload.rule), ['sent-back', 'no-return']);
  });

  test(`${who}: beyond Expect: an agent whose tools name the return tool completes the loop`, () => {
    const dir = join(root, 'run3');
    const role = readFileSync(join(dir, 'probe-returner.md'), 'utf8');
    assert.match(role, new RegExp(`^tools: .*${RETURN_TOOL}`, 'm'));
    const item = lines(join(dir, 'item.jsonl'));
    assert.equal(item.find((r) => r.kind === 'agent.spawn').payload.type, 'ccp-harness:probe-returner');
    assert.ok(item.some((r) => r.kind === 'result.stored'));
    assert.deepEqual(item.filter((r) => r.kind === 'refusal'), []);
    assert.ok(toolCalls(subagent(dir).rows).includes(RETURN_TOOL));
    assert.ok(existsSync(join(dir, 'run-folder', 'result.json')));
  });
}

test('verifier: the install was the PR head, with the agent file in it', () => {
  const release = JSON.parse(readFileSync(join(sets.verifier, 'installed-release.json'), 'utf8'));
  assert.equal(release.commit, '52036075ec9081c126681f03b3e4c9ffc18824c4');
  assert.equal(release.tag, null, 'no release ships the agent yet: this is the build commit');
  assert.ok(release.files.includes('agents/probe-reader.md'));
});
