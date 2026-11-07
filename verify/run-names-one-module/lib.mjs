// Verifier's helpers for plan item run-names-one-module. A quick-fix item `it-1` is started with this checkout's
// engine, then its brief run is driven through a plugin's real actor hook (actors.mjs, hook input on stdin) and its
// return tool's real server (return-tool.mjs over stdio). The plugin is either plugins/harness in this checkout or a
// copy laid out as infra/cloud-environment/setup.sh installs it (installed()).
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const TOOL = 'mcp__plugin_ccp-harness_harness__return';
const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', expect: ['clamp is exported from math.js'] };
const DATED = { ...process.env, GIT_AUTHOR_DATE: '2026-11-07T12:00:00Z', GIT_COMMITTER_DATE: '2026-11-07T12:00:00Z', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/** The plugin's actor hook at `scripts`, with `input` on stdin: its parsed stdout, or null when it printed nothing. */
export function hook(scripts, env, input) {
  return new Promise((ok, fail) => {
    const child = execFile(process.execPath, [join(scripts, 'actors.mjs')], { env, encoding: 'utf8' }, (error, stdout) => {
      if (error) return fail(error);
      const out = stdout.trim();
      ok(out ? JSON.parse(out).hookSpecificOutput ?? JSON.parse(out) : null);
    });
    child.stdin.end(JSON.stringify({ session_id: 'sess', ...input }));
  });
}

/** One tools/call to the return-tool server at `scripts` over stdio: its result, or { exit, stderr } if it died first. */
export function call(scripts, env, args) {
  return new Promise((ok, fail) => {
    const child = spawn(process.execPath, [join(scripts, 'return-tool.mjs')], { env });
    let buf = '', err = '';
    const timer = setTimeout(() => { child.kill(); fail(new Error(`no answer; stderr: ${err}`)); }, 15000);
    child.stdout.on('data', (d) => {
      buf += d;
      const reply = buf.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.id === 2);
      if (reply) { clearTimeout(timer); child.kill(); ok(reply.result); }
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) => { clearTimeout(timer); ok({ exit: code, stderr: err }); });
    child.on('error', fail);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'return', arguments: args } })}\n`);
  });
}
export const textOf = (answer) => (answer?.content ?? []).map((c) => c.text).join('');

/**
 * A harness folder with item it-1 started by this checkout's engine and its brief run it-1:0.brief prepared; then the
 * brief agent started and bound through the hook at `scripts`. CCP_REPO points nowhere, so the plugin can only load
 * the engine from beside itself (lib/engine/src installed, or packages/engine/src in the repo).
 */
export async function briefBound(scripts) {
  const E = (f) => import(pathToFileURL(join(REPO, 'packages', 'engine', 'src', f)).href);
  const { restore, offer, loadWorkflow } = await E('index.js');
  const { handlers } = await E('effects/index.js');
  const { actors } = await E('actors.js');
  const dir = mkdtempSync(join(tmpdir(), 'verify-rn-'));
  const root = join(dir, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(dir, 'install.json'), '{}');
  const clone = join(dir, 'clone');
  execFileSync('git', ['init', '-q', '-b', 'main', clone], { env: DATED });
  writeFileSync(join(clone, 'math.js'), 'export const add = (a, b) => a + b;\n');
  execFileSync('git', ['-C', clone, 'add', '-A'], { env: DATED });
  execFileSync('git', ['-C', clone, '-c', 'commit.gpgsign=false', '-c', 'user.email=v@v', '-c', 'user.name=v', 'commit', '-qm', 'one'], { env: DATED });
  const host = restore({ root, item: 'it-1', spec: loadWorkflow('quick-fix', { root }), session: 'sess', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 'sess' } }],
    handlers({ actors: actors({ host, repo: clone, worktrees: join(dir, 'wt') }) }));
  const env = { PATH: process.env.PATH, CCP_HARNESS_DIR: dir, CCP_REPO: join(dir, 'no-repo'), CLAUDE_CODE_REMOTE_SESSION_ID: '', HOME: dir };
  const run = 'it-1:0.brief';
  const swap = await hook(scripts, env, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'tu-brief', tool_input: { prompt: `ccp-run ${run}`, description: run } });
  assert.ok(swap?.updatedInput?.prompt, 'the hook swapped in the brief');
  mkdirSync(join(dir, 'tx', 'sess', 'subagents'), { recursive: true });
  writeFileSync(join(dir, 'tx', 'sess', 'subagents', 'agent-ag-brief.meta.json'), JSON.stringify({ toolUseId: 'tu-brief' }));
  const start = await hook(scripts, env, { hook_event_name: 'SubagentStart', agent_id: 'ag-brief', agent_type: 'general-purpose', transcript_path: join(dir, 'tx', 'sess.jsonl') });
  assert.match(start.additionalContext, /^Run it-1:0\.brief, worktree /);
  return {
    dir, root, env, run,
    send: (result) => hook(scripts, env, { hook_event_name: 'PreToolUse', agent_id: 'ag-brief', tool_name: TOOL, tool_use_id: 'tu-brief-ret', tool_input: { run, result } }),
    ask: (result, r = run) => call(scripts, env, { run: r, result })
  };
}

/** The plugin as setup.sh installs it from this checkout's HEAD: plugins/harness, lib/journal, lib/engine/src, lib/engine/messages.md. */
export function installed() {
  const work = mkdtempSync(join(tmpdir(), 'verify-rn-inst-'));
  const out = join(work, 'out');
  execFileSync('sh', ['-c', `git -C "$1" archive HEAD plugins/harness packages/journal packages/engine/src packages/engine/messages.md ':(exclude)plugins/harness/test' ':(exclude)packages/journal/test' | tar -x -C "$2"
mkdir -p "$2/out/lib/engine"
cp -a "$2/plugins/harness/." "$2/out/"
cp -a "$2/packages/journal" "$2/out/lib/journal"
cp -a "$2/packages/engine/src" "$2/out/lib/engine/src"
cp -a "$2/packages/engine/messages.md" "$2/out/lib/engine/messages.md"
rm -rf "$2/plugins" "$2/packages"`, 'sh', REPO, work]);
  return { work, out, scripts: join(out, 'scripts') };
}
