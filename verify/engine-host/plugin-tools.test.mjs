// no-agent-events, part 1: what the harness plugin registers. It registers no MCP server and no tool, so there is
// nothing to call with forged source fields; hooks and one skill are all it has, and none reaches the engine host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const plugin = new URL('../../plugins/harness/', import.meta.url).pathname;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'test' || e.name === 'node_modules' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));

test('plugin.json declares no MCP servers, tools, agents or commands; no .mcp.json exists', () => {
  const manifest = JSON.parse(readFileSync(join(plugin, '.claude-plugin/plugin.json'), 'utf8'));
  for (const key of ['mcpServers', 'tools', 'agents', 'commands', 'lspServers']) assert.equal(manifest[key], undefined, key);
  assert.equal(existsSync(join(plugin, '.mcp.json')), false);
  assert.deepEqual(readdirSync(join(plugin, 'skills')), ['install']);
});

test('no plugin script (outside tests) imports or runs the engine host, so no hook or skill can apply an event', () => {
  const files = walk(plugin).filter((f) => /\.(m?js|json|md)$/.test(f) && !f.includes('/pages/'));
  const hits = files.filter((f) => /packages\/engine|engine\/bin\/host|applyEvent|inputsOfWake/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
