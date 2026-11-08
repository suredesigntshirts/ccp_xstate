// Expect: fix-return-tool-answer/stamped-accepted, fix-return-tool-answer/still-refuses, fix-return-tool-answer/key-order
// The return-tool server answers accepted to exactly the result the hook accepted (in any key order), stored stamped, and not accepted to anything else. Through the real hook script and the real return-tool server over stdio, with a stub GitHub.
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createHash } from 'node:crypto';


const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const TOOL = 'mcp__plugin_ccp-harness_harness__return';
const PR_URL = 'https://github.com/o/r/pull/1';
const ISSUE = {
  url: 'https://github.com/o/r/issues/9',
  title: 'Add clamp',
  expect: ['clamp is exported from math.js', 'clamp throws a RangeError when lo > hi']
};

/** A stub GitHub: PR o/r#1 at `state.head`, branch fix-1 in o/r, no files, one completed green suite. */
async function stubGitHub() {
  const state = { head: null, calls: [] };
  const server = createServer((req, res) => {
    const reply = (s, j) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    const p = req.url.split('?')[0];
    state.calls.push(`${req.method} ${p}`);
    if (/\/check-suites$/.test(p)) return reply(200, { total_count: 1, check_suites: [{ status: 'completed', conclusion: 'success' }] });
    const m = p.match(/^\/repos\/o\/r\/pulls\/1(\/files)?$/);
    if (!m) return reply(404, { message: 'Not Found' });
    if (m[1]) return reply(200, []);
    return reply(200, { number: 1, merged: false, state: 'open', head: { sha: state.head, ref: 'fix-1', repo: { full_name: 'o/r' } }, base: { ref: 'main' } });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { state, api: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => server.close(ok)) };
}

/** The real hook script of `repo`, with `input` on stdin; resolves its hookSpecificOutput (or null). Async, so the
 * in-process stub GitHub can answer it. */
function hook(repo, env, input) {
  return new Promise((ok, fail) => {
    const child = execFile(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'actors.mjs')], { env, encoding: 'utf8' }, (error, stdout) => {
      if (error) return fail(error);
      const out = stdout.trim();
      ok(out ? JSON.parse(out).hookSpecificOutput ?? JSON.parse(out) : null);
    });
    child.stdin.end(JSON.stringify({ session_id: 'sess', ...input }));
  });
}

/** One tools/call to the real return-tool server of `repo` over stdio, after initialize: its result. */
function callServer(repo, env, args) {
  return new Promise((ok, fail) => {
    const child = spawn(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'return-tool.mjs')], { env });
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const reply = buf.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.id === 2);
      if (reply) { child.kill(); ok(reply.result); }
    });
    child.on('error', fail);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'return', arguments: args } })}\n`);
  });
}
const textOf = (answer) => answer.content.map((c) => c.text).join('');

// Fixed commit dates and no user or system git config (a container may sign commits), so the same steps give the
// same shas here and in CI.
const DATED = { ...process.env, GIT_AUTHOR_DATE: '2026-11-05T12:00:00Z', GIT_COMMITTER_DATE: '2026-11-05T12:00:00Z', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: DATED, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * A harness folder (install.json, journal) with item `it-1` of workflows/quick-fix.json started by `repo`'s engine,
 * its brief run started, bound and returned through the hook, and its build run started and bound to agent `ag-b`.
 * Returns what the build agent needs: its run, worktree, and a commit() that makes a new HEAD there.
 */
async function atBuild(repo, gh) {
  const E = (f) => import(pathToFileURL(join(repo, 'packages', 'engine', 'src', f)).href);
  const { restore, offer, loadWorkflow } = await E('index.js');
  const { handlers } = await E('effects/index.js');
  const { actors } = await E('actors.js');
  const dir = mkdtempSync(join(tmpdir(), 'verify-rta-'));
  const root = join(dir, 'journal');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(dir, 'install.json'), '{}');
  const clone = join(dir, 'clone');
  execFileSync('git', ['init', '-q', '-b', 'main', clone], { env: DATED });
  writeFileSync(join(clone, 'math.js'), 'export const add = (a, b) => a + b;\n');
  git(clone, 'add', '-A');
  git(clone, '-c', 'user.email=v@v', '-c', 'user.name=v', 'commit', '-qm', 'one');
  const host = restore({ root, item: 'it-1', spec: loadWorkflow('quick-fix', { root }), session: 'sess', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 'sess' } }],
    handlers({ actors: actors({ host, repo: clone, worktrees: join(dir, 'wt') }) }));
  const env = { PATH: process.env.PATH, CCP_HARNESS_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: '', CCP_GITHUB_API: gh.api, HOME: dir };
  const transcript = join(dir, 'tx', 'sess.jsonl');
  mkdirSync(join(dir, 'tx', 'sess', 'subagents'), { recursive: true });
  const startAgent = async (run, agent, toolUseId) => {
    const swap = await hook(repo, env, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: toolUseId, tool_input: { prompt: `ccp-run ${run}`, description: run } });
    assert.ok(swap?.updatedInput?.prompt, `the hook swapped in ${run}'s brief`);
    writeFileSync(join(dir, 'tx', 'sess', 'subagents', `agent-${agent}.meta.json`), JSON.stringify({ toolUseId }));
    const start = await hook(repo, env, { hook_event_name: 'SubagentStart', agent_id: agent, agent_type: 'general-purpose', transcript_path: transcript });
    assert.match(start.additionalContext, new RegExp(`^Run ${run.replace('.', '\\.')}, worktree `));
  };
  await startAgent('it-1:0.brief', 'ag-brief', 'tu-brief');
  assert.equal(await hook(repo, env, { hook_event_name: 'PreToolUse', agent_id: 'ag-brief', tool_name: TOOL, tool_use_id: 'tu-brief-ret', tool_input: { run: 'it-1:0.brief', result: { builder: 'Add clamp to math.js and open a PR.', verifier: 'Check clamp.' } } }), null, 'brief accepted');
  const run = 'it-1:1.build';
  await startAgent(run, 'ag-b', 'tu-build');
  const runJson = JSON.parse(readFileSync(join(root, 'items', 'it-1', 'runs', '1.build', 'run.json'), 'utf8'));
  const worktree = runJson.worktree;
  assert.ok(existsSync(worktree), 'the build run has its worktree');
  let n = 0;
  const commit = () => {
    writeFileSync(join(worktree, 'math.js'), `export const add = (a, b) => a + b;\nexport const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x)); // ${++n}\n`);
    git(worktree, 'add', '-A');
    git(worktree, '-c', 'user.email=v@v', '-c', 'user.name=v', 'commit', '-qm', `clamp ${n}`);
    return git(worktree, 'rev-parse', 'HEAD');
  };
  return { dir, root, env, run, worktree, commit, hook: (input) => hook(repo, env, input), call: (args) => callServer(repo, env, args),
    resultJson: (name = '1.build') => JSON.parse(readFileSync(join(root, 'items', 'it-1', 'runs', name, 'result.json'), 'utf8')),
    rows: () => readFileSync(join(root, 'items', 'it-1.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) };
}

/** The build agent returns `result` through the hook; resolves the hook's answer (null = let through). */
const ret = (p, result, toolUseId = 'tu-build-ret') =>
  p.hook({ hook_event_name: 'PreToolUse', agent_id: 'ag-b', tool_name: TOOL, tool_use_id: toolUseId, tool_input: { run: p.run, result } });

/** The full stamped-accepted scenario at `repo`: hook accepts a PR-ref build result, the server answers the same args. */
async function stampedScenario(repo) {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(repo, gh);
    const head = p.commit();
    gh.state.head = head;
    const result = { pr: { url: PR_URL, at: head }, notes: 'clamp added' };
    const hookAnswer = await ret(p, result);
    const stored = p.resultJson();
    const answer = await p.call({ run: p.run, result });
    return { p, gh, head, result, hookAnswer, stored, answer };
  } finally { await gh.close(); }
}

/** After an accepted build, the item's verify run started and bound to `ag-v`, its worktree checked out at the PR head.
 * Resolves { run, input, verdict() }: verdict() is a full PASS verify result built from the run's input. */
async function toVerify(p) {
  const { readdirSync } = await import('node:fs');
  const name = readdirSync(join(p.root, 'items', 'it-1', 'runs')).find((n) => n.endsWith('.verify'));
  assert.ok(name, 'the accepted build moved the item on to a verify run');
  const run = `it-1:${name}`;
  const swap = await p.hook({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'tu-verify', tool_input: { prompt: `ccp-run ${run}`, description: run } });
  assert.ok(swap?.updatedInput?.prompt);
  writeFileSync(join(p.dir, 'tx', 'sess', 'subagents', 'agent-ag-v.meta.json'), JSON.stringify({ toolUseId: 'tu-verify' }));
  await p.hook({ hook_event_name: 'SubagentStart', agent_id: 'ag-v', agent_type: 'general-purpose', transcript_path: join(p.dir, 'tx', 'sess.jsonl') });
  const runJson = JSON.parse(readFileSync(join(p.root, 'items', 'it-1', 'runs', name, 'run.json'), 'utf8'));
  const input = runJson.input;
  git(runJson.worktree, 'checkout', '-q', '--detach', input.target.at);
  const verdict = () => ({
    result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: { url: input.issue.url, expect: [...input.issue.expect] },
    lines: input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: `ran node -e at target.at: ${line}` }))
  });
  const send = (result, toolUseId = 'tu-verify-ret') =>
    p.hook({ hook_event_name: 'PreToolUse', agent_id: 'ag-v', tool_name: TOOL, tool_use_id: toolUseId, tool_input: { run, result } });
  return { run, name, input, verdict, send, resultJson: () => p.resultJson(name) };
}

test('stamped-accepted: the hook accepts a PR-ref build result and the server answers accepted', async () => {
  const s = await stampedScenario(REPO);
  assert.equal(s.hookAnswer, null, 'the hook let the return through (no deny)');
  const pr = s.stored.result.pr;
  assert.equal(pr.key, 'o/r#1');
  assert.equal(pr.branch, 'fix-1');
  assert.equal(pr.checkout, `git fetch origin pull/1/head && git checkout --detach ${s.head}`);
  assert.equal(pr.green, true);
  assert.notDeepEqual(s.stored.result, s.result, 'what is stored is the stamped result, not what was sent');
  assert.equal(s.answer.isError, undefined);
  assert.match(textOf(s.answer), /^accepted: run it-1:1\.build's result is stored \([0-9a-f]{12}\)\. You are done\.$/);
  assert.ok(textOf(s.answer).includes(s.stored.hash.slice(0, 12)));
  const rows = s.p.rows().filter((r) => r.payload?.run === 'it-1:1.build' && /refusal|result\.stored/.test(r.kind));
  assert.deepEqual(rows.map((r) => r.kind), ['result.stored']);
});


const refused = (a, why) => {
  assert.equal(a.isError, true, why);
  assert.match(textOf(a), /^not accepted: no harness check passed this result for run /, why);
};
const accepted = (a, why) => {
  assert.equal(a.isError, undefined, why);
  assert.match(textOf(a), /^accepted: /, why);
};

test('still-refuses: one changed value, the stamped key added, the stamped result, a run with no result.json', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    const head = p.commit();
    gh.state.head = head;
    const good = { pr: { url: PR_URL, at: head }, notes: 'clamp added' };
    assert.equal(await ret(p, good), null);
    const call = (result, run = p.run) => p.call({ run, result });
    accepted(await call(good), 'the accepted result');
    refused(await call({ ...good, pr: { ...good.pr, at: 'e'.repeat(40) } }), 'pr.at changed');
    refused(await call({ ...good, pr: { ...good.pr, at: head.toUpperCase() } }), 'pr.at in capitals');
    refused(await call({ ...good, pr: { ...good.pr, url: 'https://github.com/o/r/pull/2' } }), 'pr.url changed');
    refused(await call({ ...good, notes: 'clamp added.' }), 'notes changed');
    refused(await call({ pr: good.pr }), 'notes left out');
    refused(await call({ ...good, pr: { ...good.pr, key: 'o/r#1' } }), 'the stamped key added by the agent');
    refused(await call(p.resultJson().result), 'the stamped result itself');
    refused(await call(good, 'it-1:1.verify'), 'another run name');

    const v = await toVerify(p);
    const verdict = v.verdict();
    refused(await call(verdict, v.run), 'the verify run before any return: no result.json');
    assert.equal(await v.send(verdict), null);
    accepted(await call(verdict, v.run), 'the accepted verify result');
    const lines = structuredClone(verdict.lines);
    lines[1].evidence += ' (again)';
    refused(await call({ ...verdict, lines }, v.run), 'a lines entry evidence changed');
    const l2 = structuredClone(verdict.lines);
    l2[0].result = 'FAIL';
    refused(await call({ ...verdict, lines: l2 }, v.run), 'a lines entry result changed');
    refused(await call({ ...verdict, lines: [...verdict.lines].reverse() }, v.run), 'lines reordered (an array, so order counts)');
    refused(await call({ ...verdict, pr: { ...verdict.pr, at: head.slice(0, 39) + 'x' } }, v.run), 'verify pr.at changed');
    refused(await call({ ...verdict, issue: { ...verdict.issue, title: 'Add clamp' } }, v.run), 'issue title added');
    refused(await call(verdict, p.run), 'the verify result under the build run');
  } finally { await gh.close(); }
});

test('still-refuses: a hand-written result.json with only result and hash is accepted for exactly that result', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    const result = { pr: { url: PR_URL, at: 'a'.repeat(40), key: 'o/r#1' }, notes: 'n' };
    const hash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const dir = join(p.root, 'items', 'it-1', 'runs', '7.build');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ result, hash }));
    accepted(await p.call({ run: 'it-1:7.build', result }), 'exactly that result');
    refused(await p.call({ run: 'it-1:7.build', result: { ...result, notes: 'm' } }), 'one value changed');
    refused(await p.call({ run: 'it-1:7.build', result: { notes: 'n', pr: result.pr } }), 'old files keep the plain hash, so key order counts there');
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ result, hash, sent: 'f'.repeat(64) }));
    refused(await p.call({ run: 'it-1:7.build', result }), 'with sent present, hash is not used');
  } finally { await gh.close(); }
});

// Every object's keys reversed, at every depth; arrays keep their order.
const reversed = (v) => Array.isArray(v) ? v.map(reversed) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reversed(v[k])])) : v;

test('key-order: keys reordered at every depth are still the accepted result', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    gh.state.head = p.commit();
    const good = { pr: { url: PR_URL, at: gh.state.head }, notes: 'clamp added' };
    assert.equal(await ret(p, good), null);
    const r = reversed(good);
    assert.notEqual(JSON.stringify(r), JSON.stringify(good));
    assert.match(textOf(await p.call({ run: p.run, result: r })), /^accepted: /, 'build result, keys reversed');
    assert.match(textOf(await p.call({ run: p.run, result: { notes: good.notes, pr: good.pr } })), /^accepted: /, 'top level only');

    const v = await toVerify(p);
    const verdict = v.verdict();
    assert.equal(await v.send(verdict), null);
    const rv = reversed(verdict);
    assert.notEqual(JSON.stringify(rv.lines[0]), JSON.stringify(verdict.lines[0]), 'the lines entries are reordered too');
    assert.notEqual(JSON.stringify(rv.issue), JSON.stringify(verdict.issue));
    assert.match(textOf(await p.call({ run: v.run, result: rv })), /^accepted: /, 'verify result, keys reversed at every depth');
    const deep = structuredClone(verdict);
    deep.lines = deep.lines.map(({ line, result, evidence }) => ({ evidence, line, result }));
    assert.match(textOf(await p.call({ run: v.run, result: deep })), /^accepted: /, 'only the lines entries reordered');
    // A reorder of the hook's input instead: a fresh build accepted with keys reversed, answered for the first order.
    const gh2 = await stubGitHub();
    try {
      const q = await atBuild(REPO, gh2);
      gh2.state.head = q.commit();
      const g2 = { pr: { url: PR_URL, at: gh2.state.head }, notes: 'x' };
      assert.equal(await ret(q, reversed(g2)), null);
      assert.match(textOf(await q.call({ run: q.run, result: g2 })), /^accepted: /, 'hook got one order, server the other');
    } finally { await gh2.close(); }
  } finally { await gh.close(); }
});
