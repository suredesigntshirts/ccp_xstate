// Expect: fix-blocked-card-grant/blocked-card-answered, fix-blocked-card-grant/refused-when-not-covered, fix-blocked-card-grant/pr-cards-unchanged, fix-grant-null-repo/null-repo-refused, fix-grant-null-repo/named-repos-unchanged
// A stand-in answering cards under a grants file: quick-fix is driven by the real engine with stub agents to the blocked
// card or the merge card, the card is put up with bin/host.js card and answered with bin/host.js answer. A covered answer
// moves the item; another repo, a choice not named, an expired grant, a missing why or a grant listing null is refused
// and changes nothing.
import { createServer } from 'node:http';
import { execFileSync, spawn as spawnProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../../packages/engine/src/host.js';
import { actors, accept, bind, spawn, loadRun } from '../../../packages/engine/src/actors.js';
import { handlers, github, pump, relay } from '../../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SESSION = 'owner';
const RELEASE = '0.2.0';
const ISSUE_URL = 'https://github.com/o/r/issues/7';
const EXPECT = ['math.js exports multiply'];
const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
const REASON = 'push refused: token lacks workflow scope for .github/workflows/ci.yml; grant it, then retry';
const FAR = '2999-01-01T00:00:00Z';
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];
const cli = new URL('../../../packages/engine/bin/host.js', import.meta.url).pathname;

const tmp = (name) => mkdtempSync(join(tmpdir(), `vfbcg-${name}-`));
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
const head = (dir) => git(dir, 'rev-parse', 'HEAD');

function originAndClone() {
  const origin = tmp('origin');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const seed = tmp('seed');
  execFileSync('git', ['clone', '-q', origin, seed], { stdio: 'ignore' });
  git(seed, 'checkout', '-q', '-b', 'main');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(seed, 'push', '-q', 'origin', 'main');
  const clone = tmp('clone');
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  return { origin, clone };
}

/** GitHub REST for any owner/repo: PRs keyed "owner/repo#n", check suites by sha, merges recorded. */
async function stubGitHub() {
  const prs = {};
  const suites = {};
  const merges = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      const path = req.url.split('?')[0];
      const cs = path.match(/^\/repos\/[^/]+\/[^/]+\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const mg = path.match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/merge$/);
      if (mg && req.method === 'PUT') {
        const key = `${mg[1]}#${mg[2]}`;
        const p = prs[key];
        const sha = JSON.parse(body || '{}').sha;
        if (!p || p.head !== sha) return reply(409, { message: 'Head branch was modified' });
        p.merged = true; p.mergeSha = 'e'.repeat(40);
        merges.push({ pr: key, sha });
        return reply(200, { merged: true, sha: p.mergeSha });
      }
      const m = path.match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[`${m[1]}#${m[2]}`];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[3]) return reply(200, p.files.map((filename) => ({ filename })));
      return reply(200, { number: Number(m[2]), merged: !!p.merged, merge_commit_sha: p.mergeSha ?? null, state: 'open', head: { sha: p.head, ref: p.ref, repo: { full_name: m[1] } }, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const api = `http://127.0.0.1:${server.address().port}`;
  return {
    prs, suites, merges, api,
    client: github({ api, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

let n = 0;
const commit = (dir, msg) => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/** A quick-fix world over the real engine, the thread being the command line's relay. */
async function world({ issueUrl = ISSUE_URL } = {}) {
  const harness = tmp('harness');
  const root = join(harness, 'journal');
  mkdirSync(root, { recursive: true });
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  let cardNo = 0;
  const w = {
    harness, root, origin, repo: clone, worktrees: join(harness, 'wt'), gh, issueUrl,
    handlersFor: (host) => handlers({ github: gh.client, hearth: relay({ root }), actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: { url: issueUrl, expect: EXPECT } } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top) => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor, inputsFor: () => [] }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    snap: (item) => w.host(item).snapshot,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      const got = await accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
      if (!got.accepted) throw new Error(`${actor} result refused: ${JSON.stringify(got)}`);
      await w.drive(item);
      return run;
    },
    /** bin/host.js <command> ... for `item`, with the stub GitHub and the world's repo. */
    cli: (item, command, args = []) => new Promise((ok) => {
      const c = spawnProcess(process.execPath, [cli, command, '--item', item, '--workflow', 'quick-fix', '--root', root, '--release', RELEASE, '--repo', w.repo, '--worktrees', w.worktrees, ...args],
        { env: { ...process.env, CCP_GITHUB_API: gh.api }, cwd: w.repo });
      let stdout = '', stderr = '';
      c.stdout.on('data', (d) => (stdout += d));
      c.stderr.on('data', (d) => (stderr += d));
      c.on('close', (status) => { let json = null; try { json = JSON.parse(stdout); } catch {} ok({ status, stdout, stderr, json }); });
      c.stdin.end('');
    }),
    /** Put up the open ask's card with `host.js card`; returns { effect, ref }. */
    putCard: async (item) => {
      const ask = w.openRun(item, 'ask');
      if (!ask) throw new Error(`no open ask on ${item}`);
      const ref = `cmsg_vcard${++cardNo}`;
      const r = await w.cli(item, 'card', ['--effect', ask.id, '--ref', ref]);
      if (r.status !== 0) throw new Error(`card refused: ${r.stderr}`);
      return { effect: ask.id, ref, input: ask.input };
    },
    grants: (list) => { const f = join(harness, `grants-${++cardNo}.json`); writeFileSync(f, JSON.stringify({ grants: list })); return f; },
    answer: (item, { effect, choice, by = 'standin-session', why, grants }) =>
      w.cli(item, 'answer', ['--effect', effect, '--choice', choice, '--by', by, ...(why != null ? ['--why', why] : []), '--grants', grants]),
    close: () => gh.close()
  };
  return w;
}

const blocked = (reason = REASON) => async () => ({ blocked: { reason } });
/** A builder that opens PR `repo`#`pr` (default the issue's repo) and greens it. */
const builds = (w, { repo = 'o/r', pr = 1 } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'build');
  git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${prepared.branch}`);
  w.gh.prs[`${repo}#${pr}`] = { head: sha, ref: prepared.branch, files: ['math.js'] };
  w.gh.green(sha);
  return { pr: { url: `https://github.com/${repo}/pull/${pr}`, at: sha } };
};
const verifies = (result) => async ({ input, worktree }) => {
  git(worktree, 'checkout', '-q', '--detach', input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue, lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` })) };
};
const grant = (over = {}) => ({ id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['retry', 'replan', 'drop'], repos: ['o/r'], until: FAR, ...over });

const ITEM = 'a';
const answersOf = (w) => w.rows(ITEM).filter((r) => r.source?.system === 'standin');
const bytes = (w) => readFileSync(itemFile(w.root, ITEM), 'utf8');

async function toBlocked(opts) {
  const w = await world(opts);
  await w.start(ITEM);
  await w.agent(ITEM, 'brief', () => BRIEFS);
  const first = await w.agent(ITEM, 'build', blocked());
  assert.equal(w.state(ITEM), 'blocked');
  const card = await w.putCard(ITEM);
  assert.deepEqual(card.input.choices, ['retry', 'replan', 'drop']);
  assert.equal(card.input.pr, undefined, 'the blocked card has no pr');
  return { w, first, card };
}

function assertAnswerRow(w, card, output) {
  const rows = answersOf(w);
  assert.equal(rows.length, 1, 'one stand-in row');
  const [row] = rows;
  assert.equal(row.kind, 'engine.transition');
  assert.equal(row.payload.outcome, 'applied');
  assert.equal(row.payload.run, card.effect);
  assert.equal(row.source.system, 'standin');
  assert.match(row.source.ref, /\bvg\b/, 'ref names the grant');
  assert.ok(row.source.ref.includes(card.ref), 'ref names the card');
  assert.equal(row.payload.event.type, 'xstate.done.actor.ask');
  assert.deepEqual(row.payload.event.output, output);
}

test('blocked-card-answered: retry under a grant moves to building with the same briefs and the block as failure', async () => {
  const { w, first, card } = await toBlocked();
  try {
    const before = w.snap(ITEM).context;
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ choices: ['retry'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.state, 'building');
    assert.equal(w.state(ITEM), 'building');
    const after = w.snap(ITEM).context;
    assert.deepEqual(after.briefs, before.briefs, 'same briefs');
    assert.equal(after.failure, `build blocked: ${REASON}`, 'failure names the block');
    const rebuilt = w.openRun(ITEM, 'build');
    assert.ok(rebuilt && rebuilt.id !== first.id, 'a new build run is open');
    assert.equal(rebuilt.input.task, first.input.task, 'the same builder brief');
    assert.equal(rebuilt.input.failure, `build blocked: ${REASON}`);
    assertAnswerRow(w, card, { choice: 'retry', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('blocked-card-answered: replan with --why moves to briefing with that why', async () => {
  const { w, card } = await toBlocked();
  try {
    const why = 'why 1: the brief asked for a CI edit the token cannot push; ... why 5: no scope check before build';
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'replan', why, grants: w.grants([grant()]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'briefing');
    assert.equal(w.snap(ITEM).context.why, why);
    assert.ok(w.openRun(ITEM, 'brief'), 'a new brief run');
    assertAnswerRow(w, card, { choice: 'replan', by: 'standin-session', grant: 'vg', why });
  } finally { await w.close(); }
});

test('blocked-card-answered: drop ends the item dropped', async () => {
  const { w, card } = await toBlocked();
  try {
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'drop', grants: w.grants([grant({ choices: ['drop'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'dropped');
    assertAnswerRow(w, card, { choice: 'drop', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('refused-when-not-covered: another repo, a choice not named, an expired grant, and a replan with no why are refused; the item and journal stay', async () => {
  const { w, card } = await toBlocked();
  try {
    const cases = [
      ['another repo', { choice: 'retry', grants: [grant({ repos: ['o/x'] })] }, /o\/r not granted \(read from the issue\)/],
      ['choice not named', { choice: 'retry', grants: [grant({ choices: ['replan', 'drop'] })] }, /does not grant "retry"/],
      ['expired', { choice: 'retry', grants: [grant({ until: new Date(Date.now() - 3600e3).toISOString() })] }, /expired/],
      ['replan without why', { choice: 'replan', grants: [grant()] }, /refused/],
      ['replan with blank why', { choice: 'replan', why: '   ', grants: [grant()] }, /refused/]
    ];
    for (const [name, { choice, why, grants }, msg] of cases) {
      const was = bytes(w);
      const r = await w.answer(ITEM, { effect: card.effect, choice, why, grants: w.grants(grants) });
      assert.equal(r.status, 2, `${name}: exit 2 (${r.stderr})`);
      assert.match(r.stderr, msg, name);
      assert.equal(bytes(w), was, `${name}: journal unchanged`);
      assert.equal(w.state(ITEM), 'blocked', `${name}: still blocked`);
    }
    assert.equal(answersOf(w).length, 0);
    // The refusals did not poison the card: the same grant id, covering, is then taken.
    const ok = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant()]) });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(w.state(ITEM), 'building');
  } finally { await w.close(); }
});

for (const url of ['https://gitlab.com/o/r/issues/7', 'https://github.com/o/r/pull/7', 'https://github.com/o/r', 'o/r#7']) {
  test(`refused-when-not-covered: an issue url that is not a github.com issue URL (${url}) gives no repo`, async () => {
    const { w, card } = await toBlocked({ issueUrl: url });
    try {
      const was = bytes(w);
      const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant()]) });
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, /\(none\) not granted/);
      assert.equal(bytes(w), was);
      assert.equal(w.state(ITEM), 'blocked');
    } finally { await w.close(); }
  });
}

test('pr-cards-unchanged: a merge card is checked against its PR repo (o/s), not the issue repo (o/r)', async () => {
  const w = await world();
  try {
    await w.start(ITEM);
    await w.agent(ITEM, 'brief', () => BRIEFS);
    await w.agent(ITEM, 'build', builds(w, { repo: 'o/s' }));
    await w.agent(ITEM, 'verify', verifies('PASS'));
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const card = await w.putCard(ITEM);
    assert.match(card.input.pr.url, /github\.com\/o\/s\/pull\/1$/);
    const g = (repos) => w.grants([{ id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['approve', 'reject'], repos, until: '2999-01-01T00:00:00Z' }]);
    const was = bytes(w);
    const no = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: g(['o/r']) });
    assert.equal(no.status, 2, no.stderr);
    assert.match(no.stderr, /o\/s not granted \(read from the pr\)/);
    assert.equal(bytes(w), was);
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const yes = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: g(['o/s']) });
    assert.equal(yes.status, 0, yes.stderr);
    assert.equal(w.state(ITEM), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), ['o/s#1']);
    assertAnswerRow(w, card, { choice: 'approve', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

const standinRows = (w) => w.rows(ITEM).filter((r) => r.source?.system === 'standin');

async function toBlockedCard(opts) {
  const w = await world(opts);
  await w.start(ITEM);
  await w.agent(ITEM, 'brief', () => BRIEFS);
  await w.agent(ITEM, 'build', blocked());
  assert.equal(w.state(ITEM), 'blocked');
  const card = await w.putCard(ITEM);
  assert.equal(card.input.pr, undefined, 'the blocked card has no pr');
  return { w, card };
}

const NOT_GITHUB_ISSUES = ['https://gitlab.com/o/r/issues/7', 'https://github.com/o/r/pull/7', 'o/r#7'];
const NULL_GRANTS = [['repos [null]', [null]], ['repos [null, "o/r"]', [null, 'o/r']]];

for (const url of NOT_GITHUB_ISSUES) {
  test(`null-repo-refused: issue ${url}, every choice, grants with null in repos are refused; item and journal unchanged`, async () => {
    const { w, card } = await toBlockedCard({ issueUrl: url });
    try {
      const was = bytes(w);
      const snapWas = JSON.stringify(w.snap(ITEM).context);
      for (const [label, repos] of NULL_GRANTS) {
        for (const choice of ['retry', 'replan', 'drop']) {
          const why = choice === 'replan' ? 'why 1: a real why' : undefined;
          const r = await w.answer(ITEM, { effect: card.effect, choice, why, grants: w.grants([grant({ repos })]) });
          assert.equal(r.status, 2, `${label} ${choice}: exit 2 (stdout ${r.stdout} stderr ${r.stderr})`);
          assert.match(r.stderr, /refused/, `${label} ${choice}`);
          assert.match(r.stderr, /\bvg\b/, `${label} ${choice}: names the grant`);
          assert.match(r.stderr, /\(none\) not granted/, `${label} ${choice}: names the missing repo`);
          assert.match(r.stderr, /card has no pr/, `${label} ${choice}: says the card has no repository`);
          assert.equal(bytes(w), was, `${label} ${choice}: journal unchanged`);
          assert.equal(w.state(ITEM), 'blocked', `${label} ${choice}: still blocked`);
          assert.equal(JSON.stringify(w.snap(ITEM).context), snapWas, `${label} ${choice}: context unchanged`);
        }
      }
      assert.equal(standinRows(w).length, 0);
    } finally { await w.close(); }
  });
}

test('null-repo-refused: several null-listing grants in one file are all refused, each named', async () => {
  const { w, card } = await toBlockedCard({ issueUrl: 'https://gitlab.com/o/r/issues/7' });
  try {
    const was = bytes(w);
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ id: 'g1', repos: [null] }), grant({ id: 'g2', repos: [null, 'o/r'] })]) });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /g1/);
    assert.match(r.stderr, /g2/);
    assert.equal(bytes(w), was);
  } finally { await w.close(); }
});

test('named-repos-unchanged: grant [null, "o/r"] answers the blocked card of an o/r issue', async () => {
  const { w, card } = await toBlockedCard({ issueUrl: 'https://github.com/o/r/issues/12' });
  try {
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'retry', grants: w.grants([grant({ repos: [null, 'o/r'] })]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'building');
    assert.equal(w.snap(ITEM).context.failure, `build blocked: ${REASON}`);
    const rows = standinRows(w);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].payload.outcome, 'applied');
    assert.deepEqual(rows[0].payload.event.output, { choice: 'retry', by: 'standin-session', grant: 'vg' });
  } finally { await w.close(); }
});

test('named-repos-unchanged: grant [null, "o/r"] answers the merge card of a PR in o/r', async () => {
  const w = await world({ issueUrl: 'https://gitlab.com/o/r/issues/7' });
  try {
    await w.start(ITEM);
    await w.agent(ITEM, 'brief', () => BRIEFS);
    await w.agent(ITEM, 'build', builds(w, { repo: 'o/r' }));
    await w.agent(ITEM, 'verify', verifies('PASS'));
    assert.equal(w.state(ITEM), 'awaitingMerge');
    const card = await w.putCard(ITEM);
    assert.match(card.input.pr.url, /github\.com\/o\/r\/pull\/1$/);
    const g = { id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['approve', 'reject'], repos: [null, 'o/r'], until: '2999-01-01T00:00:00Z' };
    const r = await w.answer(ITEM, { effect: card.effect, choice: 'approve', grants: w.grants([g]) });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(w.state(ITEM), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), ['o/r#1']);
    assert.equal(standinRows(w).length, 1);
  } finally { await w.close(); }
});
