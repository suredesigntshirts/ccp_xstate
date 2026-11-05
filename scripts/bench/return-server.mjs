#!/usr/bin/env node
// The bench's return tool: a stdio MCP server named `harness` with one tool, `return`, so a bench session sees the
// tool its prompt names (a name ending in harness__return) and returns exactly as a stage agent does. Each call goes
// to the engine's accept() for the bound run; a refusal is handed back word for word, as the harness hook does, and
// every call is logged to <run folder>/bench-returns.jsonl. Started by run.mjs with BENCH_ROOT, BENCH_RUN and
// BENCH_AGENT set. Zero dependencies: newline-delimited JSON-RPC 2.0, as the MCP stdio transport is.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { acceptResult, runDir } from './lib.mjs';

const { BENCH_ROOT: root, BENCH_RUN: run, BENCH_AGENT: agentId } = process.env;
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const TOOL = {
  name: 'return',
  description: 'Return your result to the harness: { run, result }. Only this call counts. If it refuses, fix what it names and call it again.',
  inputSchema: { type: 'object', properties: { run: { type: 'string' }, result: { type: 'object' } }, required: ['run', 'result'] }
};
let calls = 0;

async function call(args) {
  calls += 1;
  const toolUseId = `bench-return-${calls}`;
  let got;
  if (args?.run !== run) got = { refused: { rule: 'unknown-run', reason: `this session's run is ${run}, not ${args?.run}` } };
  else got = await acceptResult({ root, run, agentId, result: args.result, toolUseId });
  appendFileSync(join(runDir(root, run), 'bench-returns.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), call: calls, got })}\n`);
  if (got.accepted) return { content: [{ type: 'text', text: `accepted: run ${run}, result ${got.accepted.hash}` }] };
  return { isError: true, content: [{ type: 'text', text: `refused (${got.refused?.rule}): ${got.refused?.reason}` }] };
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return; // a notification
  try {
    if (msg.method === 'initialize') {
      send({ id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'harness', version: 'bench' } } });
    } else if (msg.method === 'tools/list') {
      send({ id: msg.id, result: { tools: [TOOL] } });
    } else if (msg.method === 'tools/call') {
      if (msg.params?.name !== 'return') send({ id: msg.id, result: { isError: true, content: [{ type: 'text', text: `no tool ${msg.params?.name}` }] } });
      else send({ id: msg.id, result: await call(msg.params.arguments ?? {}) });
    } else if (msg.method === 'ping') {
      send({ id: msg.id, result: {} });
    } else {
      send({ id: msg.id, error: { code: -32601, message: `no method ${msg.method}` } });
    }
  } catch (error) {
    send({ id: msg.id, error: { code: -32603, message: String(error?.message ?? error) } });
  }
});
