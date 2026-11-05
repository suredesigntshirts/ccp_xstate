// Helpers for the fix-reminder-wake verifier. Written from plan/cases/work-item.md (C-waiting-does-not-stall),
// plan/decisions/2026-11-04-reminder-wake.md and bin/host.js's usage; the builder's tests are not read.
// Every step goes through the real bin/host.js: start and wake with stub agents returned through spawn/bind/accept
// (as the actor hooks do), a local GitHub at CCP_GITHUB_API, card to record the merge card, show for the due time.
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn, bind, accept, loadRun } from '../../packages/engine/src/actors.js';
import { github } from '../../packages/engine/src/effects/github.js';
import { readFile } from '../../packages/journal/src/index.js';

const CLI = new URL('../../packages/engine/bin/host.js', import.meta.url).pathname;
const CLOCK = new URL('./clock.mjs', import.meta.url).href;
export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x works'] };
export const CARD = 'cmsg_verifier_card_1';
export const SESSION = 'owner-session';
export const shift = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

/** The decision's captured ReadNotifications result, with the notification's fields replaced as given. */
export function captured(fields = {}) {
  const n = {
    notification_id: '8b82ee87-f95a-4dea-9e6a-b179193ab4d6',
    origin: 'trigger_fire',
    queued_at: '2026-11-04T23:10:35Z',
    content: 'checkBack capture probe for fix-reminder-wake: item probe-1 timer probe-1:3.xstate.after.checkBack (this is a shape capture, nothing to do but record it)\n<system-reminder>This task fired at Wed 2026-11-04 23:10:35 UTC. Treat this as the current date and time — the conversation may have been idle since the last message. Fired by routine "Capture reminder shape" (trigger_id: trig_01P2BTg4riV2ELJRB7xEVbyb).</system-reminder>\n<system-reminder>\nThread state: the user last wrote 5h 2m ago. Claude has sent 1 reply since then.\n</system-reminder>',
    arrived_at: '2026-11-04T23:10:35.720Z'
  };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) delete n[k]; else n[k] = v;
  return { notifications: [n], remaining: 0, read_at: '2026-11-04T23:10:37.043Z' };
}
export const hookOf = (tool_response, session = SESSION) =>
  ({ session_id: session, hook_event_name: 'PostToolUse', tool_name: 'ReadNotifications', tool_input: {}, tool_response });

/** A quick-fix item at awaitingMerge with its card recorded, all through bin/host.js. */
export async function toCard(item = 'r-1') {
  const base = mkdtempSync(join(tmpdir(), 'verify-frw-'));
  const root = join(base, 'journal');
  const repo = join(base, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  writeFileSync(join(repo, 'README.md'), 'x\n');
  execFileSync('git', ['-C', repo, 'add', '-A']);
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one']);
  const pr = { head: null };
  const suites = {};
  const server = createServer((req, res) => {
    const reply = (s, j) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    const path = req.url.split('?')[0];
    const cs = path.match(/^\/repos\/o\/r\/commits\/([0-9a-f]+)\/check-suites$/);
    if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
    if (path === '/repos/o/r/pulls/1' && pr.head) return reply(200, { number: 1, merged: false, merge_commit_sha: null, head: { sha: pr.head, ref: 'b' }, base: { ref: 'main' } });
    if (path === '/repos/o/r/pulls/1/files') return reply(200, []);
    return reply(404, { message: 'Not Found' });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const api = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env, CCP_GITHUB_API: api };
  const common = ['--item', item, '--workflow', 'quick-fix', '--root', root, '--repo', repo, '--worktrees', join(base, 'wt')];
  const cli = (args, { stdin = null, offset = 0 } = {}) => new Promise((ok, no) => {
    const pre = offset ? ['--import', CLOCK] : [];
    const c = execFile('node', [...pre, CLI, ...args, ...common], { env: { ...env, VFRW_CLOCK_OFFSET_MS: String(offset) } },
      (e, stdout, stderr) => (e ? no(new Error(stderr || e.message)) : ok(JSON.parse(stdout))));
    c.stdin.end(stdin ?? '');
  });
  const wake = (hook, offset = 0) => cli(['wake'], { stdin: JSON.stringify(hook), offset });
  const client = github({ api, env: {} });
  const agentDo = async (runId, result) => {
    spawn({ root, prompt: `ccp-run ${runId}`, toolUseId: `t-${runId}`, session: SESSION });
    bind({ root, agentId: `ag-${runId}`, toolUseId: `t-${runId}` });
    const r = await accept({ root, caller: `ag-${runId}`, run: runId, result, github: client, session: SESSION });
    if (!r.accepted) throw new Error(`${runId}: ${JSON.stringify(r)}`);
    return wake({ session_id: SESSION, hook_event_name: 'UserPromptSubmit', prompt: '' });
  };
  let out = await cli(['start', '--session', SESSION, '--input', JSON.stringify({ issue: ISSUE })]);
  out = await agentDo(out.waiting[0].run, { builder: 'b.md', verifier: 'v.md' });
  const buildRun = out.waiting[0].run;
  const wt = loadRun(root, buildRun).worktree;
  execFileSync('git', ['-C', wt, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'build']);
  const head = execFileSync('git', ['-C', wt, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  pr.head = head;
  suites[head] = [{ status: 'completed', conclusion: 'success' }];
  out = await agentDo(buildRun, { pr: { url: 'https://github.com/o/r/pull/1', at: head } });
  execFileSync('git', ['-C', loadRun(root, out.waiting[0].run).worktree, 'checkout', '-q', '--detach', head]);
  out = await agentDo(out.waiting[0].run, { result: 'PASS', pr: { url: 'https://github.com/o/r/pull/1', at: head }, issue: ISSUE, lines: [{ line: 'x works', result: 'PASS', evidence: 'stub' }] });
  if (out.state !== 'awaitingMerge') throw new Error(`expected awaitingMerge, got ${out.state}`);
  const ask = out.waiting?.find?.((w) => w.actor === 'ask')?.run ?? `${item}:3.ask`;
  await cli(['card', '--effect', ask, '--ref', CARD]);
  const show = await cli(['show']);
  const timers = show.pending.timers;
  if (timers.length !== 1) throw new Error(`expected one timer, got ${JSON.stringify(timers)}`);
  const close = () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); });
  const rows = () => readFile(join(root, 'items', `${item}.jsonl`)).rows;
  return { root, item, head, ask, timer: timers[0], wake, show: () => cli(['show']), rows, close };
}
