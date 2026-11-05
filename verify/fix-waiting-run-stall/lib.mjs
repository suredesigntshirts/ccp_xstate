// Verifier's helpers for plan item fix-waiting-run-stall, written from the item's Expect lines,
// plan/decisions/2026-11-05-waiting-run-stall.md and the hook's header; the builder's tests are not used.
// Items are started through the real packages/engine/bin/host.js as a session id; the plugin's actors.mjs runs as a
// child process with CCP_HARNESS_DIR at a temp harness folder (install.json + journal/), fed hook inputs on stdin.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.VFWRS_REPO || join(HERE, '..', '..');
const HOST = () => join(REPO, 'packages/engine/bin/host.js');
const HOOK = () => join(REPO, 'plugins/harness/scripts/actors.mjs');
export const DERIVE = () => join(REPO, 'packages/journal/bin/derive.js');
export const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported'] };

export const engine = async () => import(pathToFileURL(join(REPO, 'packages/engine/src/actors.js')).href);
const journalLib = async () => import(pathToFileURL(join(REPO, 'packages/journal/src/index.js')).href);

/** A harness folder (install.json, journal/), a git repo, and quick-fix items started by `owner` through bin/host.js. */
export function project({ items = ['a-1'], owner = 'S', cloud = null } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'verify-fwrs-'));
  const harness = join(base, 'harness');
  const root = join(harness, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(harness, 'install.json'), '{}');
  const repo = join(base, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  writeFileSync(join(repo, 'README.md'), 'x\n');
  execFileSync('git', ['-C', repo, 'add', '-A']);
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one']);
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, CCP_HARNESS_DIR: harness, CLAUDE_CODE_REMOTE_SESSION_ID: cloud ?? '', CCP_GITHUB_API: 'http://127.0.0.1:9' };
  const p = { base, harness, root, repo, env, owner };
  const common = (item) => ['--item', item, '--workflow', 'quick-fix', '--root', root];
  p.host = (cmd, item, extra = []) => JSON.parse(execFileSync(process.execPath, [HOST(), cmd, ...common(item), ...extra], { env, encoding: 'utf8', input: '' }));
  p.start = (item, session = owner) => p.host('start', item, ['--session', session, '--input', JSON.stringify({ issue: ISSUE }), '--repo', repo, '--worktrees', join(base, 'wt')]);
  p.show = (item) => p.host('show', item);
  p.started = Object.fromEntries(items.map((item) => [item, p.start(item)]));
  /** actors.mjs with `input` on stdin: its parsed stdout, or null with none. */
  p.hook = (input, extraEnv = {}) => {
    const out = execFileSync(process.execPath, [HOOK()], { input: JSON.stringify(input), env: { ...env, ...extraEnv }, encoding: 'utf8' }).trim();
    return out ? JSON.parse(out) : null;
  };
  p.stop = (session = owner, extra = {}, extraEnv = {}) => p.hook({ session_id: session, hook_event_name: 'Stop', stop_hook_active: false, ...extra }, extraEnv);
  p.agent = (prompt, session = owner, id = `tu-${Math.random().toString(36).slice(2)}`) => p.hook({ session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt, description: 'x', subagent_type: 'general-purpose' } });
  p.rows = async (item) => (await journalLib()).readFile(join(root, 'items', `${item}.jsonl`)).rows;
  p.refusals = async (item, rule) => (await p.rows(item)).filter((r) => r.kind === 'refusal' && (!rule || r.payload?.rule === rule));
  p.runDir = (run) => { const [item, rest] = run.split(':'); return join(root, 'items', item, 'runs', rest); };
  p.failed = (run) => { const f = join(p.runDir(run), 'failed.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
  p.files = (run) => readdirSync(p.runDir(run)).sort();
  return p;
}

/** The waiting brief run of an item started by project(). */
export const briefRun = (p, item) => p.started[item].waiting[0].run;
