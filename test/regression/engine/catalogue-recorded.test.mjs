// Expect: prompt-catalogue/recorded
// A scripted run through the real bin/host.js and the plugin's hook scripts that hits refusals, send-backs and a stall:
// each refusal row carries its catalogue entry and slot values, rendering them gives the row's reason, the hook output
// says the same, and stage.json names the entry of every piece rendered from the catalogue.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { entries, render } from '../../../packages/engine/src/messages.js';

const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi) & keep <b> as is.', expect: ['clamp is exported', 'clamp throws when lo > hi'] };
const BRIEF = { builder: 'build it', verifier: 'verify it independently' };

async function scenario(repo) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'verify-pc-')));
  const harness = join(base, 'harness');
  const root = join(harness, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(harness, 'install.json'), '{}');
  const gitRepo = join(base, 'repo');
  execFileSync('git', ['init', '-q', gitRepo]);
  writeFileSync(join(gitRepo, 'README.md'), 'x\n');
  execFileSync('git', ['-C', gitRepo, 'add', '-A']);
  execFileSync('git', ['-C', gitRepo, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'one'], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, CCP_HARNESS_DIR: harness, CLAUDE_CODE_REMOTE_SESSION_ID: '', CCP_GITHUB_API: 'http://127.0.0.1:9', CCP_REPO: repo };
  const HOST = join(repo, 'packages/engine/bin/host.js');
  const HOOK = join(repo, 'plugins/harness/scripts/actors.mjs');
  const TOOL = join(repo, 'plugins/harness/scripts/return-tool.mjs');
  const norm = (s) => String(s).replaceAll(base, '<BASE>').replace(/\b[0-9a-f]{40}\b/g, '<SHA>');
  const host = (cmd, item, extra = []) => JSON.parse(execFileSync(process.execPath, [HOST, cmd, '--item', item, '--workflow', 'quick-fix', '--root', root, ...extra], { env, encoding: 'utf8', input: '' }));
  const start = (item, session = 'S') => host('start', item, ['--session', session, '--input', JSON.stringify({ issue: ISSUE }), '--repo', gitRepo, '--worktrees', join(base, 'wt')]);
  const out = [];
  const hook = (step, input) => {
    const text = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(input), env, encoding: 'utf8' }).trim();
    out.push({ step, out: text ? norm(text) : null });
    return text ? JSON.parse(text) : null;
  };
  const agentCall = (step, prompt, session = 'S', id = `tu-${step}`) => hook(step, { session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt, description: 'x', subagent_type: 'general-purpose' } });
  const ret = (step, agent, run, result, session = 'S') => hook(step, { session_id: session, hook_event_name: 'PreToolUse', tool_name: 'mcp__plugin_ccp-harness_harness__return', tool_use_id: `tu-${step}`, ...(agent ? { agent_id: agent } : {}), tool_input: { run, result } });
  const runOf = (started) => started.waiting[0].run;

  // a-1: the stall path, blocked twice then failed.
  const a = runOf(start('a-1'));
  hook('stop-1', { session_id: 'S', hook_event_name: 'Stop', stop_hook_active: false });
  hook('stop-2', { session_id: 'S', hook_event_name: 'Stop', stop_hook_active: false });
  hook('stop-3', { session_id: 'S', hook_event_name: 'Stop', stop_hook_active: false });
  // b-1: waiting lines, spawn, start, confine, refusals, send-back and no-return.
  const b = runOf(start('b-1'));
  hook('wake-waiting', { session_id: 'S', hook_event_name: 'UserPromptSubmit', prompt: 'hi' });
  agentCall('agent-unknown', 'ccp-run nope-1:1.brief');
  agentCall('spawn-b', `ccp-run ${b}`, 'S', 'tu-b');
  agentCall('spawn-b-again', `ccp-run ${b}`, 'S', 'tu-b2');
  hook('start-b', { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-b', agent_type: 'general-purpose' });
  hook('read-outside', { session_id: 'S', hook_event_name: 'PreToolUse', agent_id: 'ag-b', tool_name: 'Read', tool_use_id: 'tu-r', tool_input: { file_path: '/etc/hosts' } });
  hook('glob-outside', { session_id: 'S', hook_event_name: 'PreToolUse', agent_id: 'ag-b', tool_name: 'Glob', tool_use_id: 'tu-g', tool_input: { pattern: '*', path: '/etc' } });
  ret('return-main', null, b, BRIEF);
  ret('return-other', 'ag-x', b, BRIEF);
  ret('return-unknown', 'ag-b', 'nope-1:1.brief', BRIEF);
  ret('return-schema', 'ag-b', b, { builder: '' });
  ret('return-schema-2', 'ag-b', b, { builder: 1, verifier: 'y' });
  hook('subagent-stop-1', { session_id: 'S', hook_event_name: 'SubagentStop', agent_id: 'ag-b', stop_hook_active: false });
  hook('subagent-stop-2', { session_id: 'S', hook_event_name: 'SubagentStop', agent_id: 'ag-b', stop_hook_active: true });
  ret('return-after-fail', 'ag-b', b, BRIEF);
  agentCall('spawn-failed', `ccp-run ${b}`, 'S', 'tu-b3');
  // c-1: cannot-start variants.
  const c = runOf(start('c-1'));
  agentCall('cannot-no-reason', `ccp-cannot-start ${c}: <why>`);
  agentCall('cannot-other-session', `ccp-cannot-start ${c}: no tools`, 'T');
  agentCall('cannot-unknown', 'ccp-cannot-start nope-1:1.brief: no tools');
  agentCall('cannot', `ccp-cannot-start ${c}: no Agent tool here`);
  agentCall('cannot-again', `ccp-cannot-start ${c}: still none`);
  // d-1: handback without returning, twice.
  const d = runOf(start('d-1'));
  agentCall('spawn-d', `ccp-run ${d}`, 'S', 'tu-d');
  hook('start-d', { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-d', agent_type: 'general-purpose' });
  hook('handback-1', { session_id: 'S', hook_event_name: 'PreToolUse', agent_id: 'ag-d', tool_name: 'SubagentHandback', tool_use_id: 'tu-h1', tool_input: {} });
  hook('handback-2', { session_id: 'S', hook_event_name: 'PreToolUse', agent_id: 'ag-d', tool_name: 'SubagentHandback', tool_use_id: 'tu-h2', tool_input: {} });
  // e-1: a return that is accepted, then the return tool's own answers, then a second return.
  const e = runOf(start('e-1'));
  agentCall('spawn-e', `ccp-run ${e}`, 'S', 'tu-e');
  hook('start-e', { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-e', agent_type: 'general-purpose' });
  ret('return-ok', 'ag-e', e, BRIEF);
  const rpc = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'return', arguments: { run: e, result: BRIEF } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'return', arguments: { run: e, result: { builder: 'other' } } } }
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const tool = execFileSync(process.execPath, [TOOL], { input: rpc, env, encoding: 'utf8' }).trim().split('\n').map((l) => JSON.parse(l));
  out.push({ step: 'tool-list', out: JSON.stringify(tool.find((m) => m.id === 2).result) });
  out.push({ step: 'tool-accepted', out: norm(JSON.stringify(tool.find((m) => m.id === 3).result)) });
  out.push({ step: 'tool-not-accepted', out: norm(JSON.stringify(tool.find((m) => m.id === 4).result)) });
  ret('return-again', 'ag-e', e, BRIEF);
  // f-1: the cap: ten schema refusals in a row.
  const f = runOf(start('f-1'));
  agentCall('spawn-f', `ccp-run ${f}`, 'S', 'tu-f');
  hook('start-f', { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-f', agent_type: 'general-purpose' });
  for (let i = 1; i <= 10; i++) ret(`cap-${i}`, 'ag-f', f, { builder: '', verifier: '' });

  const { readFile } = await import(pathToFileURL(join(repo, 'packages/journal/src/index.js')).href);
  const rows = {};
  for (const file of readdirSync(join(root, 'items')).filter((n) => n.endsWith('.jsonl'))) rows[file.slice(0, -6)] = readFile(join(root, 'items', file)).rows;
  const briefs = {};
  for (const item of ['a-1', 'b-1', 'c-1', 'd-1', 'e-1', 'f-1']) {
    for (const r of readdirSync(join(root, 'items', item, 'runs'))) {
      briefs[`${item}/${r}`] = { brief: norm(readFileSync(join(root, 'items', item, 'runs', r, existsSync(join(root, 'items', item, 'runs', r, 'prompt.md')) ? 'prompt.md' : 'brief.md'), 'utf8')), context: norm(readFileSync(join(root, 'items', item, 'runs', r, 'context.md'), 'utf8')) };
    }
  }
  return { out, rows, briefs, base, runs: { a, b, c, d, e, f }, norm };
}

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const s = await scenario(REPO);
const refusals = Object.values(s.rows).flat().filter((r) => r.kind === 'refusal');

test('recorded: the scripted run journals a refusal, a refusal cap, send-backs, no-returns, a stall, a stall cap and a cannot-start', () => {
  const rules = new Set(refusals.map((r) => r.payload.rule));
  for (const rule of ['schema', 'wrong-caller', 'already-returned', 'already-failed', 'refusal-cap', 'sent-back', 'no-return', 'stall', 'stall-cap', 'cannot-start']) assert.ok(rules.has(rule), `a ${rule} row`);
  assert.ok(refusals.length >= 20, `${refusals.length} rows`);
});

test('recorded: every refusal row carries { entry, slots }, and rendering them gives the row\'s reason byte for byte', () => {
  for (const r of refusals) {
    const m = r.payload.message;
    assert.ok(m && typeof m.entry === 'string' && m.slots && typeof m.slots === 'object', `${r.payload.rule} row has message: ${JSON.stringify(r.payload)}`);
    assert.ok(entries().has(m.entry), m.entry);
    assert.equal(render(m.entry, m.slots), r.payload.reason, `${r.payload.rule} ${m.entry}`);
  }
});

test('recorded: the row text the model got matches the hook output (stall and send-back blocks, deny reasons)', () => {
  const outs = s.out.filter((o) => o.out).map((o) => JSON.parse(o.out));
  const said = outs.map((o) => o.reason ?? o.hookSpecificOutput?.permissionDecisionReason).filter(Boolean).map(s.norm);
  for (const r of refusals.filter((x) => ['stall', 'sent-back'].includes(x.payload.rule))) assert.ok(said.includes(s.norm(r.payload.reason)), `${r.payload.rule} text was said`);
  // textHash is unchanged: the hash of the rule and reason, as before (sent-back and stall hash the text alone).
  for (const r of refusals) {
    const alone = ['sent-back', 'stall'].includes(r.payload.rule);
    const want = createHash('sha256').update(alone ? r.payload.reason : `${r.payload.rule}: ${r.payload.reason}`).digest('hex');
    assert.equal(r.payload.textHash, want, r.payload.rule);
  }
});

test('recorded: stage.json names the entry of each fixed frame piece and of the run context', () => {
  const runsDir = join(s.base, 'harness', 'journal', 'items', 'e-1', 'runs');
  const [run] = readdirSync(runsDir);
  const stage = JSON.parse(readFileSync(join(runsDir, run, 'stage.json'), 'utf8'));
  const pieces = JSON.stringify(stage);
  for (const entry of ['data-rule', 'worktree-rule', 'input-line', 'output-line', 'output-schema', 'return-line', 'run-line']) assert.ok(pieces.includes(`"entry":"${entry}"`), `stage.json names ${entry}`);
});
