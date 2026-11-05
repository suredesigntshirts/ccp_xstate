// The stall guard (plan item fix-waiting-run-stall), run as Claude Code runs it: actors.mjs with a Stop or an Agent
// PreToolUse input on stdin, in a project that installed the harness, with quick-fix items started as session `s`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN, REPO, temp } from './helpers.mjs';

const HOOK = join(PLUGIN, 'scripts', 'actors.mjs');
const { restore, offer, loadWorkflow } = await import(join(REPO, 'packages', 'engine', 'src', 'index.js'));
const { handlers } = await import(join(REPO, 'packages', 'engine', 'src', 'effects', 'index.js'));
const { actors, runDir, waiting, STALL_CAP } = await import(join(REPO, 'packages', 'engine', 'src', 'actors.js'));
const { readFile } = await import(join(REPO, 'packages', 'journal', 'src', 'index.js'));
const { ISSUE } = await import(join(REPO, 'packages', 'engine', 'test', 'flow.js'));

const URL_S = 'https://claude.ai/code/session_owner';

// A harness folder with the install marker and quick-fix items started by `owner`, each with its brief run prepared.
async function project({ items = ['it-1'], owner = 's' } = {}) {
  const dir = temp('stall');
  const root = join(dir, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(dir, 'install.json'), '{}');
  const clone = join(dir, 'clone');
  execFileSync('git', ['init', '-q', clone]);
  writeFileSync(join(clone, 'f'), 'x');
  execFileSync('git', ['-C', clone, 'add', '-A']);
  execFileSync('git', ['-C', clone, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one']);
  for (const item of items) {
    const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: owner, release: '0.2.0' });
    await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: owner } }],
      handlers({ actors: actors({ host, repo: clone, worktrees: join(dir, 'wt') }) }));
  }
  return { dir, root, env: { PATH: process.env.PATH, CCP_HARNESS_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: '' } };
}

const call = (env, input) => execFileSync(process.execPath, [HOOK], { input: JSON.stringify(input), env, encoding: 'utf8' }).trim();
const stop = (env, session = 's', extra = {}) => {
  const out = call(env, { session_id: session, hook_event_name: 'Stop', stop_hook_active: false, ...extra });
  return out ? JSON.parse(out) : null;
};
const agent = (env, prompt, session = 's', id = 't1') => {
  const out = call(env, { session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt } });
  return out ? JSON.parse(out).hookSpecificOutput : null;
};
const rows = (root, item = 'it-1') => readFile(join(root, 'items', `${item}.jsonl`)).rows;
const rule = (root, r, item) => rows(root, item).filter((x) => x.kind === 'refusal' && x.payload.rule === r);
const state = (root, item = 'it-1') => restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: 's', release: '0.2.0' }).snapshot.value;
const RUN = 'it-1:0.brief';

test('Stop: the owner is blocked with the exact Agent call, the count and the way out; the row has count and cap', async () => {
  const { root, env } = await project();
  const got = stop(env);
  assert.equal(got.decision, 'block');
  for (const part of ['item it-1', 'state "briefing"', `run ${RUN}`, 'brief agent', `"ccp-run ${RUN}"`, `ccp-cannot-start ${RUN}: <why>`, `Block 1 of ${STALL_CAP}.`]) {
    assert.ok(got.reason.includes(part), `the reason names ${part}`);
  }
  const [row] = rule(root, 'stall');
  assert.deepEqual([row.payload.count, row.payload.cap, row.payload.run, row.payload.outcome, row.payload.tool], [1, 2, RUN, 'blocked', 'Stop']);
  assert.equal(row.payload.reason, got.reason, 'journalled word for word');
});

test('Stop: another session, a started run or no harness gives nothing and writes nothing', async () => {
  const { root, env } = await project();
  assert.equal(stop(env, 'T'), null, 'T owns no item');
  assert.equal(rule(root, 'stall').length, 0);
  assert.ok(agent(env, `ccp-run ${RUN}`).updatedInput, 'the Agent call is made');
  assert.equal(stop(env), null, 'a started run does not block');
  assert.equal(stop({ PATH: process.env.PATH, CCP_HARNESS_DIR: temp('stall-off') }), null);
});

test('Stop: the cloud form of the session name owns the item too', async () => {
  const { env } = await project({ owner: URL_S });
  const got = stop({ ...env, CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_owner' }, 'local-id');
  assert.equal(got?.decision, 'block');
  assert.equal(stop(env, 'local-id'), null, 'without the remote id the local id owns nothing');
});

test('Stop: two blocks whatever stop_hook_active says, then the third stop fails the run and the item steps back', async () => {
  const { root, env } = await project();
  assert.equal(stop(env).decision, 'block');
  const second = stop(env, 's', { stop_hook_active: true });
  assert.equal(second.decision, 'block');
  assert.match(second.reason, /Block 2 of 2\./);
  assert.equal(stop(env, 's', { stop_hook_active: true }), null, 'the third stop is let through');
  const failed = JSON.parse(readFileSync(join(runDir(root, RUN), 'failed.json'), 'utf8'));
  assert.match(failed.why, /^stalled: /);
  assert.equal(rule(root, 'stall-cap').length, 1);
  assert.equal(state(root), 'replanning', 'quick-fix briefing\'s onError');
  assert.deepEqual(waiting(root, 'it-1'), [], 'a failed run is not waiting');
  assert.match(agent(env, `ccp-run ${RUN}`).permissionDecisionReason, /^already-failed: /);
  assert.equal(stop(env), null, 'nothing waits now');
});

test('Stop: with two waiting runs it blocks on one at a time, and one run\'s count is its own', async () => {
  const { root, env } = await project({ items: ['it-1', 'it-2'] });
  assert.match(stop(env).reason, /run it-1:0\.brief/);
  assert.match(stop(env).reason, /run it-1:0\.brief.*Block 2 of 2/s);
  const third = stop(env);
  assert.match(third.reason, /run it-2:0\.brief.*Block 1 of 2/s, 'it-1 failed at this stop; it-2 is blocked on next');
  assert.equal(state(root, 'it-1'), 'replanning');
  assert.equal(state(root, 'it-2'), 'briefing');
  assert.equal(rule(root, 'stall', 'it-2')[0].payload.count, 1);
});

test('cannot-start: the owner fails the run with its reason; others and bad prompts change nothing', async () => {
  const { root, env } = await project();
  assert.match(agent(env, `ccp-cannot-start ${RUN}: no Agent tool here`, 'T').permissionDecisionReason, /^wrong-session: /);
  assert.match(agent(env, `ccp-cannot-start ${RUN}: <why>`).permissionDecisionReason, /^no-reason: /);
  assert.match(agent(env, 'ccp-cannot-start it-9:0.brief: x').permissionDecisionReason, /^unknown-run: /);
  assert.equal(existsSync(join(runDir(root, RUN), 'failed.json')), false);
  const got = agent(env, `ccp-cannot-start ${RUN}: no Agent tool here`);
  assert.equal(got.permissionDecision, 'deny');
  assert.match(got.permissionDecisionReason, /^cannot-start: /);
  assert.equal(JSON.parse(readFileSync(join(runDir(root, RUN), 'failed.json'), 'utf8')).why, 'cannot-start: no Agent tool here');
  assert.equal(rule(root, 'cannot-start').length, 1);
  assert.equal(state(root), 'replanning');
  assert.match(agent(env, `ccp-cannot-start ${RUN}: again`).permissionDecisionReason, /^already-failed: /);
  assert.equal(stop(env), null, 'a later stop does not block on the failed run');
});

test('cannot-start: a started run is refused', async () => {
  const { root, env } = await project();
  agent(env, `ccp-run ${RUN}`);
  assert.match(agent(env, `ccp-cannot-start ${RUN}: changed my mind`, 's', 't2').permissionDecisionReason, /^already-started: /);
  assert.equal(existsSync(join(runDir(root, RUN), 'failed.json')), false);
});
