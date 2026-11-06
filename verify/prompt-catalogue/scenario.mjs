// Verifier's scenario for plan item prompt-catalogue, written from the item's Expect lines and the hook's header; the
// builder's tests are not used. scenario(repo) drives quick-fix items of any checkout through its real
// packages/engine/bin/host.js and its plugin's hook scripts (actors.mjs, return-tool.mjs as child processes, with
// CCP_HARNESS_DIR at a temp harness folder) and returns every text a model would get, in order, with temp paths and
// shas normalised, plus the journal rows. The same steps run at the base commit and at the PR head (same-text), and
// the head's rows are checked against the catalogue (recorded).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi) & keep <b> as is.', expect: ['clamp is exported', 'clamp throws when lo > hi'] };
const BRIEF = { builder: 'build it', verifier: 'verify it independently' };

export async function scenario(repo) {
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
      briefs[`${item}/${r}`] = { brief: norm(readFileSync(join(root, 'items', item, 'runs', r, 'brief.md'), 'utf8')), context: norm(readFileSync(join(root, 'items', item, 'runs', r, 'context.md'), 'utf8')) };
    }
  }
  return { out, rows, briefs, base, runs: { a, b, c, d, e, f }, norm };
}

// Run directly: print the normalised texts as JSON, for the base commit's fixture.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await scenario(process.argv[2]);
  process.stdout.write(`${JSON.stringify({ out: s.out, briefs: s.briefs }, null, 1)}\n`);
}
