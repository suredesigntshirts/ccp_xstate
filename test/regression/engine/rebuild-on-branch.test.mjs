// Expect: fix-rebuild-worktree/rebuild-on-branch, fix-rebuild-worktree/branch-stamped, fix-rebuild-worktree/fails-closed
// A rebuild after a FAIL or a red check: real engine, local bare origin, stub GitHub, stub agents. The rebuild's worktree
// starts on the PR branch at its head with origin's branch upstream, the branch is GitHub's head.ref stamped at accept,
// and a fork PR, an unknown head or a branch held by the clone fails the rebuild with a reason.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../../packages/engine/src/host.js';
import { inputsOfWake } from '../../../packages/engine/src/wake.js';
import { actors, accept, bind, spawn, loadRun, runDir } from '../../../packages/engine/src/actors.js';
import { handlers, github, pump } from '../../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const SESSION = 'owner';
const RELEASE = '0.2.0';
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['math.js exports multiply'] };
const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
const prUrl = (n) => `https://github.com/o/r/pull/${n}`;
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier'];

const tmp = (name) => mkdtempSync(join(tmpdir(), `vfrw-${name}-`));
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (dir, ...args) => { try { return git(dir, ...args); } catch { return null; } };
const head = (dir) => git(dir, 'rev-parse', 'HEAD');
const branchOf = (dir) => git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');

/** A bare origin with one commit on main, and a clone of it (the host's --repo). */
function originAndClone() {
  const origin = tmp('origin');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const seed = tmp('seed');
  execFileSync('git', ['clone', '-q', origin, seed], { stdio: 'ignore' });
  git(seed, 'checkout', '-q', '-b', 'main');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(seed, 'push', '-q', 'origin', 'main');
  return { origin, clone: cloneOf(origin) };
}
function cloneOf(origin) {
  const clone = tmp('clone');
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  return clone;
}

/** GitHub for o/r: PRs { head, ref, repo (head.repo; undefined leaves the key out), files }, suites by sha. */
async function stubGitHub() {
  const prs = {};
  const suites = {};
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      const path = req.url.split('?')[0];
      const cs = path.match(/^\/repos\/o\/r\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const m = path.match(/^\/repos\/o\/r\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[m[1]];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[2]) return reply(200, p.files.map((filename) => ({ filename })));
      const h = { sha: p.head, ref: p.ref };
      if (p.repo !== undefined) h.repo = p.repo === null ? null : { full_name: p.repo };
      return reply(200, { number: Number(m[1]), merged: false, merge_commit_sha: null, head: h, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return {
    prs, suites,
    client: github({ api: `http://127.0.0.1:${server.address().port}`, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

const ev = (kind, json) => `<wake reason="external-event" current-time="2026-11-05T02:00:00Z">\n  <event source="github" kind="${kind}" from="system" trust="relay">\n    ${JSON.stringify(json)}\n  </event>\n</wake>`;
const redWake = (sha, n = 1) => ev('check_run.completed', { check: 'test', check_run_id: 1, conclusion: 'failure', details_url: `https://ci/test/${sha}`, head_sha: sha, pr: `o/r#${n}` });
const suiteWake = (sha, n = 1) => ev('check_suite.completed', { head_sha: sha, pr: `o/r#${n}` });

/** A host world over the real engine. `w.repo`/`w.worktrees` may be swapped (a host on a fresh clone). */
async function world() {
  const root = tmp('root');
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  const w = {
    root, origin, repo: clone, worktrees: join(root, 'wt'), gh,
    handlersFor: (host) => handlers({ github: gh.client, actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top, text = '') => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor,
      inputsFor: (host) => (text ? inputsOfWake(host, text, { now: '2999-01-01T00:00:00Z' }) : []) }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** An agent through the real hooks: spawn, bind, act in its worktree, accept. */
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      return accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
    },
    close: () => gh.close()
  };
  return w;
}

let n = 0;
const commit = (dir, msg = 'work') => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/**
 * A first builder: commits in its worktree, pushes to origin as `as` (default: its run branch), opens PR `pr` on the
 * stub GitHub with head.ref = that branch and head.repo = `repo`.
 */
const firstBuild = (w, { pr = 1, as = null, repo = 'o/r', green = true } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'first build');
  const ref = as ?? prepared.branch;
  git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${ref}`);
  w.gh.prs[pr] = { head: sha, ref, repo, files: ['math.js'] };
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};

/** A rebuilder that records what it found, commits, and pushes with a plain `git push`. */
const rebuild = (w, seen, { pr = 1, green = true } = {}) => async ({ worktree, prepared, input }) => {
  seen.push({ worktree, prepared, input, head: head(worktree), branch: branchOf(worktree), upstream: tryGit(worktree, 'rev-parse', '--abbrev-ref', '@{u}') });
  const sha = commit(worktree, 'rebuild');
  git(worktree, 'push', '-q');
  w.gh.prs[pr].head = sha;
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};

const verdict = (result) => async ({ input }) => ({
  result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue,
  lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` }))
});

/** The verify run checks out the target detached, as the verify rule says. */
const verifies = (w, result) => async (a) => { git(a.worktree, 'checkout', '-q', '--detach', a.input.target.at); return verdict(result)(a); };

const readRun = (root, runId) => loadRun(root, runId);
const exists = existsSync;

const sha256 = (t) => createHash('sha256').update(t).digest('hex');

async function toFirstVerdict(w, item, build) {
  await w.start(item);
  assert.ok((await w.agent(item, 'brief', () => BRIEFS)).accepted);
  await w.drive(item);
  const first = w.openRun(item, 'build');
  const got = await w.agent(item, 'build', build);
  assert.ok(got.accepted, JSON.stringify(got));
  await w.drive(item);
  return first;
}

/** Everything rebuild-on-branch asks of a rebuild's run, given what the rebuilder saw. */
function checkRebuild(w, item, runId, seen, { branch, at }) {
  const s = seen.at(-1);
  assert.equal(s.head, at, 'the rebuild worktree starts at previous.at');
  assert.equal(s.branch, branch, 'the rebuild worktree is on the PR branch (rev-parse --abbrev-ref HEAD)');
  assert.equal(s.upstream, `origin/${branch}`, 'upstream is origin\'s branch, so a plain git push lands on the PR');
  const run = readRun(w.root, runId);
  assert.equal(run.branch, branch, 'run.json names the branch');
  const context = readFileSync(join(runDir(w.root, runId), 'context.md'), 'utf8');
  assert.match(context, new RegExp(`branch ${branch.replace(/[/.]/g, '\\$&')}\\.$`), 'the context.md run line names the branch');
  const stored = w.rows(item).find((r) => r.kind === 'prompt.stored' && r.payload.run === runId);
  assert.ok(stored, 'a prompt.stored row for the rebuild run');
  assert.equal(stored.payload.contextHash, sha256(context), 'the prompt.stored row is of this context');
  // The plain git push went to origin's branch, and the PR (one, number 1) is at it.
  const pushed = git(w.origin, 'rev-parse', `refs/heads/${branch}`);
  assert.equal(pushed, w.gh.prs[1].head);
  assert.equal(git(w.origin, 'rev-parse', `${pushed}^`), at, 'the rebuild commit sits on the PR head: the code being fixed');
  assert.deepEqual(Object.keys(w.gh.prs), ['1'], 'no second PR');
}

test('rebuild-on-branch: a FAIL sends the item back to building on the PR branch at its head; a second FAIL replans', async () => {
  const w = await world();
  try {
    const first = await toFirstVerdict(w, 'a', firstBuild(w));
    const main = git(w.repo, 'rev-parse', 'HEAD');
    const firstRun = readRun(w.root, first.id);
    assert.equal(firstRun.branch, 'run/a/1.build', 'a first build gets run/<item>/<run>');
    assert.equal(git(w.origin, 'rev-parse', 'refs/heads/main'), main);
    const pr = w.host('a').snapshot.context.pr;
    assert.equal(git(firstRun.worktree, 'rev-parse', 'HEAD^'), main, 'the first build started at the clone HEAD');
    assert.ok((await w.agent('a', 'verify', verifies(w, 'FAIL'))).accepted);
    await w.drive('a');
    assert.equal(w.state('a'), 'building');
    const second = w.openRun('a', 'build');
    assert.equal(second.input.previous.at, pr.at);
    const seen = [];
    assert.ok((await w.agent('a', 'build', rebuild(w, seen))).accepted);
    checkRebuild(w, 'a', second.id, seen, { branch: 'run/a/1.build', at: pr.at });
    // The first build's worktree was detached, its files and commits kept.
    assert.equal(branchOf(firstRun.worktree), 'HEAD', 'the finished first worktree is detached');
    assert.equal(head(firstRun.worktree), pr.at, 'and still at its commit');
    await w.drive('a');
    assert.equal(w.state('a'), 'verifying');
    const pr2 = w.host('a').snapshot.context.pr;
    assert.equal(pr2.url, prUrl(1));
    assert.equal(pr2.branch, 'run/a/1.build', 'the rebuild\'s PR is stamped with the same branch');
    // C-second-fail-replans: a second FAIL goes to replanning, no third build.
    assert.ok((await w.agent('a', 'verify', verifies(w, 'FAIL'))).accepted);
    await w.drive('a');
    assert.equal(w.state('a'), 'replanning');
    assert.equal(w.openRun('a', 'build'), null);
  } finally {
    await w.close();
  }
});

test('rebuild-on-branch: a red check_run sends the item back to building on the PR branch at its head', async () => {
  const w = await world();
  try {
    await toFirstVerdict(w, 'r', firstBuild(w, { green: false }));
    assert.equal(w.state('r'), 'checking');
    const pr = w.host('r').snapshot.context.pr;
    await w.drive('r', redWake(pr.at));
    assert.equal(w.state('r'), 'building', 'C-red-ci-back-to-building');
    const run = w.openRun('r', 'build');
    assert.equal(run.input.failure.sha, pr.at, 'the failing check is the input');
    const seen = [];
    assert.ok((await w.agent('r', 'build', rebuild(w, seen))).accepted);
    checkRebuild(w, 'r', run.id, seen, { branch: 'run/r/1.build', at: pr.at });
  } finally {
    await w.close();
  }
});

test('rebuild-on-branch: the branch is GitHub\'s head.ref, not the earlier run\'s name', async () => {
  const w = await world();
  try {
    await toFirstVerdict(w, 'n', firstBuild(w, { as: 'fix/multiply' }));
    const pr = w.host('n').snapshot.context.pr;
    assert.equal(pr.branch, 'fix/multiply');
    assert.ok((await w.agent('n', 'verify', verifies(w, 'FAIL'))).accepted);
    await w.drive('n');
    const run = w.openRun('n', 'build');
    const seen = [];
    assert.ok((await w.agent('n', 'build', rebuild(w, seen))).accepted);
    checkRebuild(w, 'n', run.id, seen, { branch: 'fix/multiply', at: pr.at });
    assert.equal(tryGit(w.origin, 'rev-parse', '--verify', '-q', 'refs/heads/run/n/3.build'), null, 'no run branch pushed');
  } finally {
    await w.close();
  }
});

test('rebuild-on-branch: a host on a fresh clone fetches the PR head from origin', async () => {
  const w = await world();
  try {
    await toFirstVerdict(w, 'f', firstBuild(w));
    const pr = w.host('f').snapshot.context.pr;
    assert.ok((await w.agent('f', 'verify', verifies(w, 'FAIL'))).accepted);
    // The next host runs on another clone, without the PR head: it is only on origin.
    w.repo = cloneOf(w.origin);
    git(w.repo, 'update-ref', '-d', `refs/remotes/origin/run/f/1.build`);
    git(w.repo, 'reflog', 'expire', '--all', '--expire=now');
    git(w.repo, 'gc', '-q', '--prune=now');
    assert.equal(tryGit(w.repo, 'cat-file', '-e', `${pr.at}^{commit}`), null, 'the head is not in the new clone');
    w.worktrees = join(w.root, 'wt2');
    await w.drive('f');
    const run = w.openRun('f', 'build');
    assert.ok(run, `a rebuild is open (state ${w.state('f')})`);
    const seen = [];
    assert.ok((await w.agent('f', 'build', rebuild(w, seen))).accepted);
    checkRebuild(w, 'f', run.id, seen, { branch: 'run/f/1.build', at: pr.at });
  } finally {
    await w.close();
  }
});

test('branch-stamped: own repo stamps head.ref (any case), a fork or a gone fork does not; the agent may not set it, and sees it in previous', async () => {
  for (const [repo, want] of [['o/r', 'b1'], ['O/R', 'b1'], ['fork/r', undefined], [null, undefined]]) {
    const w = await world();
    try {
      await toFirstVerdict(w, 's', firstBuild(w, { as: 'b1', repo }));
      const pr = w.host('s').snapshot.context.pr;
      assert.equal(pr.branch, want, `head.repo ${JSON.stringify(repo)}`);
      assert.equal(pr.key, 'o/r#1');
    } finally {
      await w.close();
    }
  }
  const w = await world();
  try {
    await toFirstVerdict(w, 'x', firstBuild(w));
    assert.ok((await w.agent('x', 'verify', verifies(w, 'FAIL'))).accepted);
    await w.drive('x');
    const run = w.openRun('x', 'build');
    const brief = readFileSync(join(runDir(w.root, run.id), 'prompt.md'), 'utf8');
    const line = brief.split('\n').find((l, i, all) => all[i - 1]?.startsWith('- previous:'));
    assert.ok(line?.trim().startsWith('= {'), `previous shown: ${line}`);
    // Replan #96: branch is reserved but shown; key, gates, green and checkout stay hidden.
    const shown = JSON.parse(line.trim().slice(2));
    assert.deepEqual(Object.keys(shown), ['url', 'at', 'branch'], 'previous shows url, at and branch, no key, checkout, green or gates');
    assert.equal(shown.branch, run.input.previous.branch, 'the branch shown is the one the host stamped');
    assert.equal(shown.branch, 'run/x/1.build');
    // A build result that sets pr.branch itself is refused, rule reserved.
    const got = await w.agent('x', 'build', async ({ worktree }) => {
      const sha = commit(worktree, 'sets branch');
      git(worktree, 'push', '-q');
      w.gh.prs[1].head = sha;
      return { pr: { url: prUrl(1), at: sha, branch: 'elsewhere' } };
    });
    assert.equal(got.refused?.rule, 'reserved', JSON.stringify(got));
    assert.match(got.refused.reason, /branch/);
  } finally {
    await w.close();
  }
});

/** The rebuild run's effect failed with a reason matching `why`, the item stepped back, and no worktree was made. */
function failedClosed(w, item, why) {
  const failed = w.rows(item).filter((r) => r.kind === 'engine.effect' && r.payload.phase === 'failed' && r.payload.actor === 'build');
  assert.equal(failed.length, 1, 'one failed build effect');
  assert.match(failed[0].payload.reason, why);
  assert.equal(w.state(item), 'replanning', 'the item steps back to replanning');
  const runId = failed[0].payload.effect;
  assert.equal(existsSync(join(w.worktrees, `${item}--${runId.split(':')[1]}`)), false, 'no worktree for the failed run');
  assert.equal(tryGit(w.repo, 'rev-parse', '--verify', '-q', `refs/heads/run/${item}/${runId.split(':')[1]}`), null, 'no fresh branch for it');
  assert.equal(w.host(item).snapshot.context.failure != null, true, 'the failure is the item\'s input to replanning');
  return failed[0];
}

test('fails-closed: a fork PR (no stamped branch) fails its rebuild with a reason and steps back', async () => {
  for (const repo of ['fork/r', null]) {
    const w = await world();
    try {
      await toFirstVerdict(w, 'k', firstBuild(w, { repo }));
      assert.ok((await w.agent('k', 'verify', verifies(w, 'FAIL'))).accepted);
      await w.drive('k');
      failedClosed(w, 'k', /rebuild-branch: .*no branch/);
    } finally {
      await w.close();
    }
  }
});

test('fails-closed: previous.at in neither the clone nor origin fails with a reason and steps back', async () => {
  const w = await world();
  try {
    await toFirstVerdict(w, 'g', firstBuild(w));
    const pr = w.host('g').snapshot.context.pr;
    assert.ok((await w.agent('g', 'verify', verifies(w, 'FAIL'))).accepted);
    // The branch is gone from origin and its commit pruned; the next host has a fresh clone.
    git(w.origin, 'update-ref', '-d', 'refs/heads/run/g/1.build');
    git(w.origin, 'reflog', 'expire', '--all', '--expire=now');
    git(w.origin, 'gc', '-q', '--prune=now');
    assert.equal(tryGit(w.origin, 'cat-file', '-e', `${pr.at}^{commit}`), null);
    w.repo = cloneOf(w.origin);
    w.worktrees = join(w.root, 'wt2');
    await w.drive('g');
    failedClosed(w, 'g', new RegExp(`rebuild-head: .*${pr.at}.*neither the clone nor origin`));
  } finally {
    await w.close();
  }
});

test('fails-closed: a branch held by the clone\'s own checkout is not touched and the rebuild fails', async () => {
  const w = await world();
  try {
    git(w.repo, 'checkout', '-q', '-b', 'feat');
    const before = head(w.repo);
    await toFirstVerdict(w, 'h', firstBuild(w, { as: 'feat' }));
    assert.equal(w.host('h').snapshot.context.pr.branch, 'feat');
    assert.ok((await w.agent('h', 'verify', verifies(w, 'FAIL'))).accepted);
    await w.drive('h');
    failedClosed(w, 'h', /rebuild-branch: branch feat is checked out at .*outside the host's worktrees/);
    assert.equal(branchOf(w.repo), 'feat', 'the clone is still on feat');
    assert.equal(head(w.repo), before, 'and at the same commit');
  } finally {
    await w.close();
  }
});
