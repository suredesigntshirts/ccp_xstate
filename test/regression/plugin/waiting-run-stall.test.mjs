// Expect: fix-waiting-run-stall/block, fix-waiting-run-stall/cannot-start, fix-waiting-run-stall/cap, fix-waiting-run-stall/measure
// A run waiting for its agent: the owner's Stop is blocked twice with the exact call, the third fails the run, ccp-cannot-start is the thread's own exit, and derive.js stalls counts it. Items start through the real host.js and the plugin's actors.mjs runs as Claude Code runs it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const HOST = () => join(REPO, 'packages/engine/bin/host.js');
const HOOK = () => join(REPO, 'plugins/harness/scripts/actors.mjs');
const DERIVE = () => join(REPO, 'packages/journal/bin/derive.js');
const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported'] };

const engine = async () => import(pathToFileURL(join(REPO, 'packages/engine/src/actors.js')).href);
const journalLib = async () => import(pathToFileURL(join(REPO, 'packages/journal/src/index.js')).href);

/** A harness folder (install.json, journal/), a git repo, and quick-fix items started by `owner` through bin/host.js. */
function project({ items = ['a-1'], owner = 'S', cloud = null } = {}) {
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
const briefRun = (p, item) => p.started[item].waiting[0].run;

test('block: the owner S is blocked with item, state, run, actor, ccp-run, Block 1 of 2 and the exit; one stall row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.equal(p.show('a-1').state, 'briefing');
  const out = p.stop('S');
  assert.equal(out.decision, 'block');
  for (const part of ['a-1', 'briefing', run, 'brief', `"ccp-run ${run}"`, 'Block 1 of 2.', `ccp-cannot-start ${run}`]) assert.ok(out.reason.includes(part), `reason holds ${part}: ${out.reason}`);
  const rows = await p.refusals('a-1', 'stall');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.count, 1);
  assert.equal(rows[0].payload.cap, 2);
  assert.equal(rows[0].payload.run, run);
  assert.equal(rows[0].payload.outcome, 'blocked');
  writeFileSync(join(p.base, 'block-reason.txt'), out.reason);
});

test('block: a Stop from T (not the owner) gives no output and no row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  assert.equal(p.stop('T'), null);
  assert.equal(p.stop('T', { stop_hook_active: true }), null);
  assert.equal((await p.refusals('a-1')).length, 0);
  assert.equal(p.files(briefRun(p, 'a-1')).includes('failed.json'), false);
});

test('block: after the run\'s Agent call (spawn.json) the Stop gives no output and no row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  const pre = p.agent(`ccp-run ${run}`, 'S');
  assert.ok(!pre || pre.hookSpecificOutput?.permissionDecision !== 'deny', JSON.stringify(pre));
  assert.ok(p.files(run).includes('spawn.json'));
  for (let i = 0; i < 4; i++) assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1')).length, 0);
  assert.equal((await engine()).waiting(p.root, 'a-1').length, 0);
});

test('block: the cloud form (CLAUDE_CODE_REMOTE_SESSION_ID set, run.session the URL) blocks too', async () => {
  const url = 'https://claude.ai/code/session_verifyCloud1';
  const p = project({ items: ['c-1'], owner: url, cloud: 'cse_verifyCloud1' });
  const run = briefRun(p, 'c-1');
  const rec = JSON.parse((await import('node:fs')).readFileSync(join(p.runDir(run), 'run.json'), 'utf8'));
  assert.equal(rec.session, url);
  const out = p.stop('3f0c-local-uuid');
  assert.equal(out?.decision, 'block');
  assert.ok(out.reason.includes('Block 1 of 2.'));
  assert.equal((await p.refusals('c-1', 'stall')).length, 1);
  // Without the cloud variable the same hook session id owns nothing.
  assert.equal(p.stop('3f0c-local-uuid', {}, { CLAUDE_CODE_REMOTE_SESSION_ID: '' }), null);
});

const denyOf = (out) => { assert.equal(out?.hookSpecificOutput?.permissionDecision, 'deny', JSON.stringify(out)); return out.hookSpecificOutput.permissionDecisionReason; };

test('cannot-start: the owner\'s prompt is denied, fails the run with its why, journals a row, item replanning; no later block', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  denyOf(p.agent(`ccp-cannot-start ${run}: no Agent tool here`, 'S'));
  assert.equal(p.failed(run).why, 'cannot-start: no Agent tool here');
  assert.equal(p.files(run).includes('spawn.json'), false);
  const rows = await p.refusals('a-1', 'cannot-start');
  assert.equal(rows.length, 1);
  assert.equal(p.show('a-1').state, 'replanning');
  assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1', 'stall')).length, 0);
  // Again on the failed run: refused, nothing changes.
  const before = (await p.rows('a-1')).length;
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: again`, 'S')), /^already-failed/);
  assert.equal(p.failed(run).why, 'cannot-start: no Agent tool here');
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 1);
  assert.ok((await p.rows('a-1')).length >= before);
});

test('cannot-start: from another session it is refused wrong-session and changes nothing', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: no Agent tool here`, 'T')), /^wrong-session/);
  assert.equal(p.failed(run), null);
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
  assert.equal(p.show('a-1').state, 'briefing');
  assert.equal(p.stop('S').decision, 'block', 'the run still waits for its owner');
});

test('cannot-start: an unknown run and a started run are refused and change nothing', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.match(denyOf(p.agent('ccp-cannot-start a-1:7.brief: nope', 'S')), /^unknown-run/);
  assert.match(denyOf(p.agent('ccp-cannot-start zz-9:0.brief: nope', 'S')), /^unknown-run/);
  p.agent(`ccp-run ${run}`, 'S');
  assert.ok(p.files(run).includes('spawn.json'));
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: changed my mind`, 'S')), /^already-started/);
  assert.equal(p.failed(run), null);
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
  assert.equal(p.show('a-1').state, 'briefing');
});

test('cannot-start: a run failed at the cap is refused already-failed and keeps its stalled why', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  p.stop('S'); p.stop('S'); assert.equal(p.stop('S'), null);
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: late`, 'S')), /^already-failed/);
  assert.ok(p.failed(run).why.startsWith('stalled:'));
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
});

test('cap: blocks 1 and 2 (stop_hook_active either way), the third fails the run: stalled:, stall-cap row, replanning, not waiting, ccp-run refused already-failed', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  const b1 = p.stop('S', { stop_hook_active: false });
  assert.ok(b1.reason.includes('Block 1 of 2.'));
  const b2 = p.stop('S', { stop_hook_active: true });
  assert.equal(b2.decision, 'block');
  assert.ok(b2.reason.includes('Block 2 of 2.'));
  assert.deepEqual((await p.refusals('a-1', 'stall')).map((r) => r.payload.count), [1, 2]);
  assert.equal(p.failed(run), null);
  const b3 = p.stop('S', { stop_hook_active: true });
  assert.equal(b3, null, 'the third stop is let through');
  const f = p.failed(run);
  assert.ok(f?.why.startsWith('stalled:'), JSON.stringify(f));
  const cap = await p.refusals('a-1', 'stall-cap');
  assert.equal(cap.length, 1);
  assert.equal(cap[0].payload.outcome, 'failed');
  assert.equal(p.show('a-1').state, 'replanning');
  const A = await engine();
  assert.equal(A.waiting(p.root, 'a-1').length, 0);
  const deny = p.agent(`ccp-run ${run}`, 'S');
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(deny.hookSpecificOutput.permissionDecisionReason, /^already-failed/);
  assert.equal(p.files(run).includes('spawn.json'), false);
  // Later stops: nothing waits for S, so no block and no new row.
  assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1', 'stall')).length, 2);
  assert.equal((await p.refusals('a-1', 'stall-cap')).length, 1);
});

test('cap: two waiting runs block one at a time; one run\'s count does not use up the other\'s', async () => {
  const p = project({ items: ['a-1', 'b-1'], owner: 'S' });
  const [ra, rb] = [briefRun(p, 'a-1'), briefRun(p, 'b-1')];
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const out = p.stop('S');
    seen.push(out ? `${out.reason.match(/run (\S+) prepared/)[1]} ${out.reason.match(/Block \d of 2/)[0]}` : null);
  }
  assert.deepEqual(seen, [`${ra} Block 1 of 2`, `${ra} Block 2 of 2`, `${rb} Block 1 of 2`, `${rb} Block 2 of 2`, null, null]);
  assert.ok(p.failed(ra).why.startsWith('stalled:'));
  assert.ok(p.failed(rb).why.startsWith('stalled:'));
  assert.equal(p.show('a-1').state, 'replanning');
  assert.equal(p.show('b-1').state, 'replanning');
  assert.deepEqual((await p.refusals('a-1', 'stall')).map((r) => r.payload.count), [1, 2]);
  assert.deepEqual((await p.refusals('b-1', 'stall')).map((r) => r.payload.count), [1, 2]);
});

test('cap: a run started after one block is not failed later, and the other run still gets its own two', async () => {
  const p = project({ items: ['a-1', 'b-1'], owner: 'S' });
  const [ra, rb] = [briefRun(p, 'a-1'), briefRun(p, 'b-1')];
  assert.ok(p.stop('S').reason.includes(ra));
  p.agent(`ccp-run ${ra}`, 'S');
  const n = p.stop('S');
  assert.ok(n.reason.includes(rb) && n.reason.includes('Block 1 of 2.'));
  assert.equal(p.failed(ra), null);
});

const derive = (journal) => JSON.parse(execFileSync(process.execPath, [DERIVE(), 'stalls', '--journal', journal], { encoding: 'utf8' }));

test('measure: prepared 4, blocked 2, blocks 3, startedAfterBlock 1, failedAtCap 1, cannotStart 1, rate 0.5', async () => {
  const A = await engine();
  const p = project({ items: ['a-1', 'b-1', 'c-1', 'd-1'], owner: 'S' });
  const r = Object.fromEntries(['a-1', 'b-1', 'c-1', 'd-1'].map((i) => [i, briefRun(p, i)]));
  const start = (run) => { p.agent(`ccp-run ${run}`, 'S', `tu-${run}`); A.bind({ root: p.root, agentId: `ag-${run}`, toolUseId: `tu-${run}`, session: 'S' }); };
  start(r['a-1']);
  p.agent(`ccp-cannot-start ${r['d-1']}: no Agent tool in this session`, 'S');
  assert.ok(p.stop('S').reason.includes(r['b-1']));
  start(r['b-1']);
  assert.ok(p.stop('S').reason.includes(`${r['c-1']} prepared`));
  assert.ok(p.stop('S').reason.includes('Block 2 of 2.'));
  assert.equal(p.stop('S'), null);
  const view = derive(p.root);
  const { runs, ...counts } = view;
  assert.deepEqual(counts, { prepared: 4, blocked: 2, blocks: 3, startedAfterBlock: 1, failedAtCap: 1, cannotStart: 1, rate: 0.5 });
  const by = Object.fromEntries(runs.map((e) => [e.run, e]));
  assert.deepEqual([by[r['b-1']].blocks, by[r['b-1']].startedAfterBlock, by[r['b-1']].failed], [1, true, null]);
  assert.deepEqual([by[r['c-1']].blocks, by[r['c-1']].startedAfterBlock, by[r['c-1']].failed], [2, false, 'stall-cap']);
  assert.deepEqual([by[r['d-1']].blocks, by[r['d-1']].failed], [0, 'cannot-start']);
  // Expect: "with a per-run entry for each" of the four runs, the never-blocked one included.
  assert.deepEqual(runs.map((e) => e.run).sort(), Object.values(r).sort(), 'a per-run entry for each of the four runs');
  assert.deepEqual([by[r['a-1']].blocks, by[r['a-1']].failed], [0, null]);
  // One item's file alone gives that item's view.
  const one = derive(join(p.root, 'items', 'c-1.jsonl'));
  assert.deepEqual([one.prepared, one.blocked, one.blocks, one.failedAtCap, one.rate], [1, 1, 2, 1, 1]);
});
