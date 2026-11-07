// Verifier tests for fix-rebuild-worktree: rebuild-on-branch, branch-stamped and fails-closed. Real engine, local bare
// origin, stub GitHub, stub agents (lib.mjs). Written from the item, the decision and the cases, not the builder's tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  world, BRIEFS, firstBuild, rebuild, verifies, redWake, git, tryGit, head, branchOf, cloneOf, runDir, readRun, prUrl, commit
} from './lib.mjs';

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
