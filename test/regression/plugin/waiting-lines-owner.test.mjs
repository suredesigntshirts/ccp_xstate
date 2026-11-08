// Expect: fix-waiting-lines-owner/lines-owned, fix-waiting-lines-owner/stall-unchanged
// The waiting-run lines name each session only its own items' runs, and stall(), cannotStart() and the Stop hook answer for the owner alone. Items start through the real host.js; the plugin's actors.mjs runs as Claude Code runs it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported'] };
const cloudUrl = (cse) => `https://claude.ai/code/${cse.replace(/^cse_/, 'session_')}`;

const engineOf = (repo) => import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
const journalOf = (repo) => import(pathToFileURL(join(repo, 'packages/journal/src/index.js')).href);

/** A harness folder and a git repo under a fresh temp folder; `start(item, session)` starts quick-fix through host.js. */
function project(repo) {
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
/** A value with temp paths replaced by <base> and clock or chain fields dropped, so runs compare without their clocks and temp paths. */
function norm(v, base) {
  if (typeof v === 'string') return v.split(base).join('<base>').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>');
  if (Array.isArray(v)) return v.map((x) => norm(x, base));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k) && !/hash$/i.test(k)).map(([k, x]) => [k, norm(x, base)]));
  return v;
}

const CSE = 'cse_verifyU';
const ctx = (o) => o?.hookSpecificOutput?.additionalContext ?? null;

/** UserPromptSubmit and PostToolUse-of-Agent output for each asker, on one root holding a-1 (A), b-1 (B), u-1 (U). */
function lines(repo) {
  const p = project(repo);
  p.start('a-1', 'sess-A');
  p.start('b-1', 'sess-B');
  p.start('u-1', cloudUrl(CSE));
  const askers = { A: ['sess-A', ''], B: ['sess-B', ''], C: ['sess-C', ''], U: ['local-U', CSE], 'A+cloud': ['sess-A', CSE] };
  const out = {};
  for (const [name, [id, cse]] of Object.entries(askers)) out[name] = { wake: p.wake(id, cse), afterAgent: p.afterAgent(id, cse) };
  return out;
}

/** stall(), cannotStart() and the Stop hook, each on its own root, with the journal rows they leave. */
async function stalls(repo) {
  const A = await engineOf(repo);
  const out = {};
  // Engine calls direct.
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    const calls = [
      ['stall C', () => A.stall({ root: p.root, sessions: ['sess-C', 'sess-C'], session: 'sess-C' })],
      ['stall A 1', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall A 2', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall A 3', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall B 1', () => A.stall({ root: p.root, sessions: ['sess-B'], session: 'sess-B' })],
      ['stall AB', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-B'], session: 'sess-A' })],
      ['cannotStart no prompt', () => A.cannotStart({ root: p.root, prompt: 'ccp-run b-1:0.brief', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart no reason', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: <why>', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart unknown', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start z-9:0.brief: x', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart wrong session', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: no Agent', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart owner', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: no Agent', sessions: ['sess-B'], session: 'sess-B' })],
      ['cannotStart again', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: again', sessions: ['sess-B'], session: 'sess-B' })],
      ['stall B after', () => A.stall({ root: p.root, sessions: ['sess-B'], session: 'sess-B' })],
    ];
    out.engine = {};
    for (const [k, f] of calls) out.engine[k] = norm(f(), p.base);
    out.engineRows = { 'a-1': norm(await p.rows('a-1'), p.base), 'b-1': norm(await p.rows('b-1'), p.base) };
    out.engineFiles = { 'a-1:0.brief': p.files('a-1:0.brief'), 'b-1:0.brief': p.files('b-1:0.brief'), failedA: norm(p.json('a-1:0.brief', 'failed.json'), p.base), failedB: norm(p.json('b-1:0.brief', 'failed.json'), p.base) };
  }
  // The Stop hook, and cannot-start through the hook.
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    p.start('u-1', cloudUrl(CSE));
    const steps = [
      ['Stop C', () => p.stop('sess-C')],
      ['Stop A 1', () => p.stop('sess-A')],
      ['Stop A 2', () => p.stop('sess-A', true)],
      ['Stop B 1', () => p.stop('sess-B')],
      ['Stop U 1', () => p.stop('local-U', false, CSE)],
      ['Stop A 3', () => p.stop('sess-A', true)],
      ['Stop A 4', () => p.stop('sess-A')],
      ['cannot-start B from A', () => p.agent('ccp-cannot-start b-1:0.brief: none', 'sess-A', 'tu-c1')],
      ['cannot-start B from B', () => p.agent('ccp-cannot-start b-1:0.brief: none', 'sess-B', 'tu-c2')],
      ['Stop B 2', () => p.stop('sess-B', true)],
      ['Stop U 2', () => p.stop('local-U', true, CSE)],
    ];
    out.hook = {};
    for (const [k, f] of steps) out.hook[k] = norm(f(), p.base);
    out.hookRows = Object.fromEntries(await Promise.all(['a-1', 'b-1', 'u-1'].map(async (i) => [i, norm(await p.rows(i), p.base)])));
    out.hookFiles = { a: p.files('a-1:0.brief'), b: p.files('b-1:0.brief'), u: p.files('u-1:0.brief') };
  }
  return out;
}


const HEADER = 'ccp-harness: actor runs prepared and waiting for their agent:';
const line = (item) => `- brief for ${item}:0.brief: Agent tool with prompt exactly "ccp-run ${item}:0.brief"`;
const text = (...items) => [HEADER, ...items.map(line)].join('\n');
const want = (event, ...items) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text(...items) } });

const got = lines(REPO);

for (const [asker, items] of [['A', ['a-1']], ['B', ['b-1']], ['U', ['u-1']], ['A+cloud', ['a-1', 'u-1']]]) {
  test(`lines-owned: ${asker} is named only its own runs (${items.join(', ')}) after a wake and after an Agent call`, () => {
    assert.deepEqual(got[asker].wake, want('UserPromptSubmit', ...items));
    assert.deepEqual(got[asker].afterAgent, want('PostToolUse', ...items));
  });
}

test('lines-owned: a session owning no item gets no output', () => {
  assert.equal(got.C.wake, null);
  assert.equal(got.C.afterAgent, null);
});

const stalled = await stalls(REPO);

test('stall-unchanged: stall() and cannotStart() answer the owner alone', () => {
  assert.equal(stalled.engine['stall C'], null);
  assert.deepEqual(stalled.engine['stall A 3'], { block: null, failed: ['a-1:0.brief'] });
  assert.match(stalled.engine['cannotStart wrong session'].deny, /^wrong-session: /);
});

test('stall-unchanged: the Stop hook blocks the owner, the cloud form included, and no one else', () => {
  assert.equal(stalled.hook['Stop C'], null);
  assert.equal(stalled.hook['Stop A 1'].decision, 'block');
  assert.equal(stalled.hook['Stop U 1'].decision, 'block');
});
