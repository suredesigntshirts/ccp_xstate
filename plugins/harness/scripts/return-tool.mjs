#!/usr/bin/env node
// The return tool: the harness's MCP server, `harness`, with one tool, `return`. An invoked
// actor hands back its result with it: { run, result }. The checks are not here. The PreToolUse hook (actors.mjs)
// runs them before the call reaches this server, refuses a call that fails one, and stores the result of one that
// passes. So this server only answers whether that happened: it says accepted when the run's stored result is this
// result, and refuses anything else, such as a call made while the hook was not running. The host stamps PR refs
// before storing (key, branch, checkout, gates, green), so the match is against `sent`, the hash of the result as the
// agent sent it; a result.json that has no sent is matched by `hash`, the stamped result's.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { journalDir, messages, names } from './host.mjs';

// Its words are entries of the message catalogue.
const { render } = await messages();
// How a run id names its folder and how a result is hashed are the engine's names.js, which imports only node: built-ins.
const { resultHash, runDir, sha256 } = await names();

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

// Whether the hook stored exactly this result for this run.
function answer({ run, result } = {}) {
  const dir = runDir(journalDir(), run);
  let stored = null;
  if (dir) {
    try {
      stored = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
    } catch {}
  }
  const same = stored && (typeof stored.sent === 'string' ? stored.sent === resultHash(result) : stored.hash === sha256(JSON.stringify(result)));
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
