// Verifier's helpers for plan item fix-waiting-lines-owner, written from the item's Expect lines, its Verifier brief
// and plan/decisions/2026-11-05-waiting-lines-owner.md; the builder's tests are not read or used.
// Items are started through a checkout's real packages/engine/bin/host.js as a session; the checkout's
// plugins/harness/scripts/actors.mjs runs as a child process with CCP_HARNESS_DIR at a temp harness folder
// (install.json + journal/), fed a hook input on stdin. Every helper takes the checkout, so the same steps run at the
// PR head and at main.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported'] };
export const cloudUrl = (cse) => `https://claude.ai/code/${cse.replace(/^cse_/, 'session_')}`;

export const engineOf = (repo) => import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
const journalOf = (repo) => import(pathToFileURL(join(repo, 'packages/journal/src/index.js')).href);

/** A harness folder and a git repo under a fresh temp folder; `start(item, session)` starts quick-fix through host.js. */
export function project(repo) {
  const base = mkdtempSync(join(tmpdir(), 'verify-fwlo-'));
  const harness = join(base, 'harness');
  const root = join(harness, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(harness, 'install.json'), '{}');
  const git = join(base, 'repo');
  execFileSync('git', ['init', '-q', git]);
  writeFileSync(join(git, 'README.md'), 'x\n');
  execFileSync('git', ['-C', git, 'add', '-A']);
  execFileSync('git', ['-C', git, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'one'], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, CCP_HARNESS_DIR: harness, CLAUDE_CODE_REMOTE_SESSION_ID: '', CCP_GITHUB_API: 'http://127.0.0.1:9' };
  const p = { repo, base, harness, root, env };
  p.host = (cmd, item, extra = []) => JSON.parse(execFileSync(process.execPath, [join(repo, 'packages/engine/bin/host.js'), cmd, '--item', item, '--workflow', 'quick-fix', '--root', root, ...extra], { env, encoding: 'utf8', input: '' }));
  p.start = (item, session) => p.host('start', item, ['--session', session, '--input', JSON.stringify({ issue: ISSUE }), '--repo', git, '--worktrees', join(base, 'wt')]);
  /** actors.mjs with `input` on stdin; `cse` sets CLAUDE_CODE_REMOTE_SESSION_ID. Parsed stdout, or null with none. */
  p.hook = (input, cse = '') => {
    const out = execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/actors.mjs')], { input: JSON.stringify(input), env: { ...env, CLAUDE_CODE_REMOTE_SESSION_ID: cse }, encoding: 'utf8' }).trim();
    return out ? JSON.parse(out) : null;
  };
  p.wake = (session, cse = '') => p.hook({ session_id: session, hook_event_name: 'UserPromptSubmit', prompt: 'a wake' }, cse);
  p.afterAgent = (session, cse = '') => p.hook({ session_id: session, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'tu-post', tool_input: { prompt: 'x', description: 'x' }, tool_response: {} }, cse);
  p.stop = (session, again = false, cse = '') => p.hook({ session_id: session, hook_event_name: 'Stop', stop_hook_active: again }, cse);
  p.agent = (prompt, session, id, cse = '') => p.hook({ session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt, description: 'x', subagent_type: 'general-purpose' } }, cse);
  p.runDir = (run) => { const [item, rest] = run.split(':'); return join(root, 'items', item, 'runs', rest); };
  p.files = (run) => readdirSync(p.runDir(run)).sort();
  p.json = (run, f) => { const x = join(p.runDir(run), f); return existsSync(x) ? JSON.parse(readFileSync(x, 'utf8')) : null; };
  p.rows = async (item) => (await journalOf(repo)).readFile(join(root, 'items', `${item}.jsonl`)).rows;
  return p;
}

const VOLATILE = new Set(['at', 'ts', 'time', 'ms', 'started', 'ended', 'seq', 'hash', 'prev', 'id']);
/** A value with temp paths replaced by <base> and clock or chain fields dropped, so runs at two checkouts compare. */
export function norm(v, base) {
  if (typeof v === 'string') return v.split(base).join('<base>').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>');
  if (Array.isArray(v)) return v.map((x) => norm(x, base));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k) && !/hash$/i.test(k)).map(([k, x]) => [k, norm(x, base)]));
  return v;
}
