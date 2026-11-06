#!/usr/bin/env node
// The return tool (plan item engine-actors): the harness's MCP server, `harness`, with one tool, `return`. An invoked
// actor hands back its result with it: { run, result }. The checks are not here. The PreToolUse hook (actors.mjs)
// runs them before the call reaches this server, refuses a call that fails one, and stores the result of one that
// passes. So this server only answers whether that happened: it says accepted when the run's stored result is this
// result, and refuses anything else, such as a call made while the hook was not running. The host stamps PR refs
// before storing (key, branch, checkout, gates, green), so the match is against `sent`, the hash of the result as the
// agent sent it; only a result.json stored before sent existed is matched by `hash`, the stamped result's
// (fix-return-tool-answer).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { journalDir, messages } from './host.mjs';

// Its words are entries of the message catalogue (plan item prompt-catalogue).
const { render } = await messages();

const TOOL = {
  name: 'return',
  description: render('return-tool-description'),
  inputSchema: {
    type: 'object',
    required: ['run', 'result'],
    properties: {
      run: { type: 'string', description: render('return-tool-run') },
      result: { type: 'object', description: render('return-tool-result') }
    }
  }
};

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
// As the engine's sentHash (packages/engine/src/actors.js): object keys sorted at every depth.
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const sentHash = (result) => sha256(JSON.stringify(sorted(result ?? null)));
const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

// Whether the hook stored exactly this result for this run.
function answer({ run, result } = {}) {
  const m = String(run ?? '').match(/^(.+):(\d+\.[\w-]+)$/);
  let stored = null;
  if (m) {
    try {
      stored = JSON.parse(readFileSync(join(journalDir(), 'items', safe(m[1]), 'runs', safe(m[2]), 'result.json'), 'utf8'));
    } catch {}
  }
  const same = stored && (typeof stored.sent === 'string' ? stored.sent === sentHash(result) : stored.hash === sha256(JSON.stringify(result)));
  if (same) {
    return { content: [{ type: 'text', text: render('return-accepted', { run: String(run), hash: String(stored.hash.slice(0, 12)) }) }] };
  }
  return { isError: true, content: [{ type: 'text', text: render('return-not-accepted', { run: String(run) }) }] };
}

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);

createInterface({ input: process.stdin }).on('line', (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  if (m.id === undefined) return; // a notification
  if (m.method === 'initialize') {
    return send({ id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'harness', version: '1' } } });
  }
  if (m.method === 'tools/list') return send({ id: m.id, result: { tools: [TOOL] } });
  if (m.method === 'tools/call') {
    if (m.params?.name !== TOOL.name) return send({ id: m.id, error: { code: -32602, message: `no tool ${m.params?.name}` } });
    return send({ id: m.id, result: answer(m.params.arguments) });
  }
  if (m.method === 'ping') return send({ id: m.id, result: {} });
  send({ id: m.id, error: { code: -32601, message: `no method ${m.method}` } });
});
