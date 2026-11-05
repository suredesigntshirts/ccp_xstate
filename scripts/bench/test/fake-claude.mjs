#!/usr/bin/env node
// A stand-in for `claude -p` in the bench's tests (BENCH_CLAUDE points here). No model runs.
// Judge mode (--json-schema given): answers met: false when the prompt holds FAKE_UNMET, else met: true.
// Stage mode: records the prompt it was given under $FAKE_OUT, returns $FAKE_RESULT (JSON) through the MCP server named
// in --mcp-config, as a stage agent calls the harness return tool, writes a transcript whose system prompt carries an
// attribution trailer, and prints stream-json rows as claude does.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const prompt = readFileSync(0, 'utf8');
const out = process.env.FAKE_OUT;
if (out) mkdirSync(out, { recursive: true });
const usage = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 };

if (args.includes('--json-schema')) {
  if (out) appendFileSync(join(out, 'judge-calls.jsonl'), `${JSON.stringify({ prompt })}\n`);
  const met = !prompt.includes('FAKE_UNMET');
  process.stdout.write(`${JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { met, why: met ? 'fake: met' : 'fake: FAKE_UNMET found' }, usage, modelUsage: { 'fake-judge': {} } })}\n`);
  process.exit(0);
}

const session = `fake-${process.pid}`;
if (out) writeFileSync(join(out, 'prompt.txt'), prompt);
const run = prompt.match(/\{ "run": "([^"]+)"/)?.[1];
const mcp = JSON.parse(readFileSync(opt('--mcp-config'), 'utf8')).mcpServers.harness;
const server = spawn(mcp.command, mcp.args, { env: { ...process.env, ...mcp.env }, stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
const replies = [];
server.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { replies.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
const ask = (id, method, params) => new Promise((ok) => {
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  const t = setInterval(() => { const r = replies.find((x) => x.id === id); if (r) { clearInterval(t); ok(r); } }, 10);
});
await ask(1, 'initialize', { protocolVersion: '2025-06-18' });
const results = JSON.parse(process.env.FAKE_RESULT ?? '[]');
const answers = [];
for (const [i, result] of [results].flat().entries()) answers.push(await ask(2 + i, 'tools/call', { name: 'return', arguments: { run, result } }));
server.kill();

const slug = resolve(process.cwd()).replace(/[^A-Za-z0-9]/g, '-');
const dir = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects', slug);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${session}.jsonl`), [
  { type: 'attachment', attachment: { type: 'environment' }, rendered: [{ content: 'env' }] },
  { type: 'attachment', attachment: { type: 'prompt_snapshot', systemPrompt: ['You are a fake.', 'Co-Authored-By: Fake <f@example.com>'] } }
].map((r) => JSON.stringify(r)).join('\n') + '\n');

const rows = [
  { type: 'system', subtype: 'init', session_id: session, model: 'fake-model', claude_code_version: 'fake' },
  { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__harness__return', input: { run } }] } },
  { type: 'user', message: { content: answers.map((a) => ({ type: 'tool_result', is_error: !!a.result?.isError, content: a.result?.content })) } },
  { type: 'result', subtype: 'success', is_error: false, num_turns: 2, duration_api_ms: 5, total_cost_usd: 0, usage, terminal_reason: 'completed' }
];
process.stdout.write(rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
