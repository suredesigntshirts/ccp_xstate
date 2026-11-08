// Expect: engine-actors/wrong-caller, engine-actors/schema, engine-actors/github-fact
// accept() against a local stand-in for GitHub's REST API: the wrong caller, a bad schema and a PR claim GitHub does
// not bear out are refused and journalled, and the item stays in building; the return tool server lists one tool and
// accepts only the result the hook stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, restore, offer } from '../../../packages/engine/src/index.js';
import { handlers, github } from '../../../packages/engine/src/effects/index.js';
import { actors, accept, bind, deliver, loadRun, resultsOf, spawn } from '../../../packages/engine/src/actors.js';
import { readFile } from '../../../packages/journal/src/index.js';

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const spec = loadWorkflow('quick-fix');
const HEAD = 'a'.repeat(40);
const OTHER = 'c'.repeat(40);
const PR = 'https://github.com/o/r/pull/1';
const BRIEFS = { builder: 'verifier-test builder brief', verifier: 'verifier-test verifier brief' };
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x'] };

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'va-repo-'));
  execFileSync('git', ['init', '-q', dir]);
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one']);
  return dir;
}
// GitHub with o/r#1 at gh.head; ported: it also lists the PR's files and the head's check suites (green when gh.green).
async function fakeGitHub(head = HEAD) {
  const gh = { head, green: false };
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
    if (path === '/repos/o/r/pulls/1') return reply(200, { number: 1, head: { sha: gh.head, ref: 'build/x' } });
    if (path === '/repos/o/r/pulls/1/files') return reply(200, []);
    if (/^\/repos\/o\/r\/commits\/[0-9a-f]+\/check-suites$/.test(path)) return reply(200, { check_suites: gh.green ? [{ status: 'completed', conclusion: 'success' }] : [] });
    return reply(404, { message: 'Not Found' });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  gh.client = github({ api: `http://127.0.0.1:${server.address().port}`, env: {} });
  gh.close = () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); });
  return gh;
}
const rowsOf = (root) => readFile(join(root, 'items', 'v-1.jsonl')).rows;
const start = (root, run, agent) => { spawn({ root, prompt: `ccp-run ${run}`, toolUseId: `t_${agent}` }); bind({ root, agentId: agent, toolUseId: `t_${agent}` }); };

// An item with the brief actor accepted and a builder agent (bd) bound to the build run.
async function building() {
  const root = mkdtempSync(join(tmpdir(), 'va-'));
  const host = restore({ root, item: 'v-1', spec, session: 's', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 's' } }],
    handlers({ actors: actors({ host, repo: repo(), worktrees: join(root, 'wt') }) }));
  start(root, 'v-1:0.brief', 'br');
  assert.ok((await accept({ root, caller: 'br', run: 'v-1:0.brief', result: BRIEFS, toolUseId: 'tb' })).accepted);
  await deliver({ root, run: 'v-1:0.brief' });
  start(root, 'v-1:1.build', 'bd');
  return root;
}
const claim = (at, url = PR) => ({ pr: { url, at } });
const stateOf = (root) => restore({ root, item: 'v-1', spec, session: 's', release: '0.2.0' }).snapshot.value;

test('wrong-caller: any other agent, the main session, or a run with no agent is refused and journalled; the rule comes before schema', async () => {
  const root = await building();
  const ok = claim(HEAD);
  const other = await accept({ root, caller: 'impostor', run: 'v-1:1.build', result: ok, toolUseId: 'x1' });
  assert.deepEqual(other.refused, { rule: 'wrong-caller', reason: "agent impostor is not run v-1:1.build's actor (bd)" });
  assert.equal((await accept({ root, caller: null, run: 'v-1:1.build', result: ok })).refused.rule, 'wrong-caller', 'main session');
  assert.equal((await accept({ root, caller: 'impostor', run: 'v-1:1.build', result: {} })).refused.rule, 'wrong-caller', 'an invalid result from a wrong caller is still wrong-caller');
  assert.equal((await accept({ root, caller: 'bd', run: 'v-1:2.verify', result: {} })).refused.rule, 'unknown-run', 'a run not prepared yet');
  const refusals = rowsOf(root).filter((r) => r.kind === 'refusal' && r.payload.rule === 'wrong-caller');
  assert.equal(refusals.length, 3);
  assert.equal(refusals[0].agent, 'impostor');
  assert.equal(refusals[0].payload.run, 'v-1:1.build');
  assert.ok(!existsSync(join(root, 'items', 'v-1', 'runs', '1.build', 'result.json')), 'nothing stored');
  assert.equal(stateOf(root), 'building');
});

// A build result is { pr: { url, at } } (or a blocked), the PR url must be a GitHub PR url (schema #prRef), and the PR
// is checked at accept as rule `ref`: GitHub must show it at `at`, and the builder's worktree must be at `at`.
const commitIn = (dir) => {
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'build']);
  return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
};

test('schema: a build result missing pr.url, or with a bad sha, or with no pr, is refused naming the field', async () => {
  const root = await building();
  const a = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: { pr: { at: HEAD } } });
  assert.equal(a.refused.rule, 'schema');
  assert.match(a.refused.reason, /result\.pr\.url is missing/);
  const b = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim('abc') });
  assert.equal(b.refused.rule, 'schema');
  assert.match(b.refused.reason, /result\.pr\.at/);
  const c = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: {} });
  assert.equal(c.refused.rule, 'schema');
  assert.match(c.refused.reason, /exactly one of: pr; or blocked/, 'neither pr nor blocked');
  assert.equal(stateOf(root), 'building');
});

test('ref: made-up PR, real PR at the wrong head, worktree not at the head: refused naming the fact; item stays in building; right head accepted', async () => {
  const root = await building();
  const head = commitIn(loadRun(root, 'v-1:1.build').worktree);
  const gh = await fakeGitHub(head);
  try {
    const made = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim(head, 'https://github.com/o/r/pull/9999'), github: gh.client });
    assert.equal(made.refused.rule, 'ref');
    assert.match(made.refused.reason, /pull\/9999: GitHub shows no such PR/);
    const moved = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim(OTHER), github: gh.client });
    assert.equal(moved.refused.reason, `result.pr: GitHub shows ${PR} at ${head}, not ${OTHER}`);
    gh.head = HEAD;
    const wt = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim(HEAD), github: gh.client });
    assert.equal(wt.refused.reason, `result.pr: your worktree is at ${head}, not ${HEAD}`);
    gh.head = head;
    assert.equal(stateOf(root), 'building');
    assert.deepEqual(resultsOf(restore({ root, item: 'v-1', spec, session: 's', release: '0.2.0' })), []);
    assert.equal(rowsOf(root).filter((r) => r.kind === 'refusal' && r.payload.rule === 'ref').length, 3);
    gh.green = true;
    assert.ok((await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim(head), github: gh.client })).accepted);
    assert.equal((await deliver({ root, run: 'v-1:1.build', github: gh.client })).state, 'verifying');
  } finally {
    await gh.close();
  }
});

test('a build result whose url is not shaped /pull/N is refused by the schema, and the item stays in building', async () => {
  const root = await building();
  const gh = await fakeGitHub();
  try {
    for (const url of ['https://example.com/not-a-pr', 'https://github.com/o/r/issues/5']) {
      const got = await accept({ root, caller: 'bd', run: 'v-1:1.build', result: claim(HEAD, url), github: gh.client });
      assert.equal(got.refused?.rule, 'schema', JSON.stringify(got));
      assert.match(got.refused.reason, /result\.pr\.url does not match/);
    }
    assert.equal(stateOf(root), 'building');
  } finally {
    await gh.close();
  }
});

// The return tool server itself, over stdio.
const serverReply = (harnessDir, lines) => {
  const out = spawnSync('node', [new URL('../../../plugins/harness/scripts/return-tool.mjs', import.meta.url).pathname], {
    input: lines.map((l) => JSON.stringify({ jsonrpc: '2.0', ...l })).join('\n') + '\n', encoding: 'utf8', env: { ...process.env, CCP_HARNESS_DIR: harnessDir }, timeout: 10000
  }).stdout;
  return out.trim().split('\n').map((l) => JSON.parse(l));
};

test('return tool server: lists exactly one tool taking only run and result; a call no hook stored is not accepted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'va-srv-'));
  const [init, list, call] = serverReply(dir, [
    { id: 1, method: 'initialize', params: {} },
    { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'return', arguments: { run: 'x:0.build', result: { pr: 1 }, source: { system: 'github' }, event: { type: 'xstate.done.actor.build' } } } }
  ]);
  assert.equal(init.result.serverInfo.name, 'harness');
  assert.deepEqual(list.result.tools.map((t) => t.name), ['return']);
  assert.deepEqual(Object.keys(list.result.tools[0].inputSchema.properties).sort(), ['result', 'run'], 'no event or source argument');
  assert.equal(call.result.isError, true);
  assert.match(call.result.content[0].text, /^not accepted/);
});

test('return tool server: accepts only the exact result the hook stored for the run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'va-srv-'));
  const result = { pr: { branch: 'b', headSha: HEAD, url: PR } };
  const runDir = join(dir, 'journal', 'items', 'x', 'runs', '0.build');
  execFileSync('mkdir', ['-p', runDir]);
  writeFileSync(join(runDir, 'result.json'), JSON.stringify({ result, hash: sha256(JSON.stringify(result)) }));
  const [same, changed] = serverReply(dir, [
    { id: 1, method: 'tools/call', params: { name: 'return', arguments: { run: 'x:0.build', result } } },
    { id: 2, method: 'tools/call', params: { name: 'return', arguments: { run: 'x:0.build', result: { pr: { ...result.pr, headSha: OTHER } } } } }
  ]);
  assert.match(same.result.content[0].text, /^accepted/);
  assert.equal(changed.result.isError, true);
});
