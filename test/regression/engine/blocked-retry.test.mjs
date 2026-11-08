// Expect: fix-blocked-retry/retry-route, fix-blocked-retry/no-second-retry
// A build that comes back blocked: the real engine over stub agents, a local origin, a stub GitHub and a card recorder.
// retry rebuilds once with the same briefs and the block as the failure, replan and drop do what replanning does, and a
// second block in the same attempt replans with no retry offered.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../../packages/engine/src/host.js';
import { inputsOfWake } from '../../../packages/engine/src/wake.js';
import { actors, accept, bind, spawn, stopped, loadRun, runDir } from '../../../packages/engine/src/actors.js';
import { handlers, github, pump } from '../../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standinInput } from '../../../packages/engine/src/standin.js';

const SESSION = 'owner';
const RELEASE = '0.2.0';
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['math.js exports multiply'] };
const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
const REASON = 'push refused: refusing to allow a token without workflow scope to update .github/workflows/ci.yml; grant the workflow scope, then retry';
const prUrl = (n) => `https://github.com/o/r/pull/${n}`;
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];

const tmp = (name) => mkdtempSync(join(tmpdir(), `vfbr-${name}-`));
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
      const cs = path.match(/^\/repos\/o\/r\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const mg = path.match(/^\/repos\/o\/r\/pulls\/(\d+)\/merge$/);
      if (mg && req.method === 'PUT') {
        const p = prs[mg[1]];
        const sha = JSON.parse(body || '{}').sha;
        if (!p || p.head !== sha) return reply(409, { message: 'Head branch was modified' });
        p.merged = true; p.mergeSha = 'e'.repeat(40);
        merges.push({ pr: Number(mg[1]), sha });
        return reply(200, { merged: true, sha: p.mergeSha });
      }
      const m = path.match(/^\/repos\/o\/r\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[m[1]];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[2]) return reply(200, p.files.map((filename) => ({ filename })));
      return reply(200, { number: Number(m[1]), merged: !!p.merged, merge_commit_sha: p.mergeSha ?? null, state: 'open', head: { sha: p.head, ref: p.ref, repo: { full_name: 'o/r' } }, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return {
    prs, suites, merges,
    client: github({ api: `http://127.0.0.1:${server.address().port}`, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

/** A thread that records every card it is asked to put up. */
function thread() {
  const cards = [];
  let n = 0;
  return {
    cards,
    hearth: {
      card: async ({ key, question, choices, inputs }) => { const ref = `cmsg_card${++n}`; cards.push({ key, ref, question, choices, inputs }); return { ref }; },
      post: async () => ({ ref: `cmsg_post${++n}` }),
      close: async ({ key }) => { const c = cards.find((x) => x.key === key); return c ? { ref: c.ref } : null; }
    },
    clock: { wakeAt: async ({ key }) => ({ ref: `wake ${key}` }) }
  };
}

const ev = (kind, json) => `<wake reason="external-event" current-time="2026-11-05T16:00:00Z">\n  <event source="github" kind="${kind}" from="system" trust="relay">\n    ${JSON.stringify(json)}\n  </event>\n</wake>`;
const redWake = (sha, n = 1) => ev('check_run.completed', { check: 'test', check_run_id: 1, conclusion: 'failure', details_url: `https://ci/test/${sha}`, head_sha: sha, pr: `o/r#${n}` });
const tapWake = (ref, index) => `<wake reason="decision-chosen" current-time="2026-11-05T16:00:00Z">
  <project id="chan_x" type="project"><thread ts="cmsg_t"><message trigger="true" from="human" trust="principal" author-id="user_x">Chose</message></thread></project>
  <system-note>decision_id=${ref}</system-note>
  <system-note>option=x</system-note>
  <system-note>option_index=${index}</system-note>
  <system-note>actor_account_id=user_person</system-note>
</wake>`;

let n = 0;
const commit = (dir, msg) => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/** A quick-fix host world over the real engine. */
async function world() {
  const root = tmp('root');
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  const th = thread();
  const w = {
    root, origin, repo: clone, worktrees: join(root, 'wt'), gh, cards: th.cards, seen: [],
    handlersFor: (host) => handlers({ github: gh.client, hearth: th.hearth, clock: th.clock, actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top, text = '') => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor,
      inputsFor: (host) => (text ? inputsOfWake(host, text, { now: '2999-01-01T00:00:00Z' }) : []) }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    snap: (item) => w.host(item).snapshot,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** An agent through the real hooks: spawn, bind, act in its worktree, accept; then drive. */
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      w.seen.push({ actor, run: run.id, input: run.input });
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      const got = await accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
      if (!got.accepted) throw new Error(`${actor} result refused: ${JSON.stringify(got)}`);
      await w.drive(item);
      return run;
    },
    /** An agent that binds and then stops without returning (failed.json). */
    stops: async (item, actor) => {
      const run = w.openRun(item, actor);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      stopped({ root, agentId: id, again: true });
      await w.drive(item);
      return run;
    },
    /** Tap choice `choice` on the newest card. */
    tap: async (item, choice) => {
      const card = w.cards.at(-1);
      const index = card.choices.indexOf(choice);
      if (index < 0) throw new Error(`"${choice}" is not on the card (${card.choices})`);
      await w.drive(item, tapWake(card.ref, index));
    },
    close: () => gh.close()
  };
  return w;
}

/** Builders and verifiers. */
const blocked = (reason = REASON) => async () => ({ blocked: { reason } });
const builds = (w, { pr = 1, green = true } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'build');
  const prev = w.gh.prs[pr];
  if (prev) { git(worktree, 'push', '-q', '-f', 'origin', `HEAD:refs/heads/${prev.ref}`); prev.head = sha; } else {
    git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${prepared.branch}`);
    w.gh.prs[pr] = { head: sha, ref: prepared.branch, files: ['math.js'] };
  }
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};
const verifies = (result) => async ({ input, worktree }) => {
  git(worktree, 'checkout', '-q', '--detach', input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue, lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` })) };
};

/** The newest card's choices and the error event the newest error transition applied. */
const lastCard = (w) => w.cards.at(-1) ?? null;
function lastError(w, item) {
  const row = w.rows(item).filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && String(r.payload.event?.type ?? '').startsWith('xstate.error.actor.')).at(-1);
  return row?.payload.event ?? null;
}

const brief = (w) => w.agent('a', 'brief', () => BRIEFS);
const runsOf = (w, actor) => [...new Set(w.rows('a').filter((r) => r.kind === 'engine.effect' && r.payload.type === 'run' && r.payload.actor === actor).map((r) => r.payload.effect))];
const answers = (w) => w.rows('a').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && r.payload.event?.type === 'xstate.done.actor.ask');

async function toBlocked(w) {
  await w.start('a');
  await brief(w);
  const first = await w.agent('a', 'build', blocked());
  return first;
}

test('retry-route: a blocked first build reaches blocked; retry rebuilds with the same briefs and the block as failure; the PR then verifies and merges', async () => {
  const w = await world();
  try {
    const first = await toBlocked(w);
    assert.equal(w.state('a'), 'blocked');
    const err = lastError(w, 'a');
    assert.equal(err.error, `build blocked: ${REASON}`, 'the error names the block');
    assert.equal(err.blocked, REASON, 'the error event carries the block');
    const card = w.cards.at(-1);
    assert.deepEqual(card.choices, ['retry', 'replan', 'drop']);
    assert.equal(card.inputs.failure, `build blocked: ${REASON}`, "the card's input carries the block's text");
    const before = w.snap('a').context;
    assert.equal(before.built, null);

    await w.tap('a', 'retry');
    assert.equal(w.state('a'), 'building');
    const after = w.snap('a').context;
    assert.deepEqual(after.briefs, before.briefs, 'same briefs');
    assert.equal(after.why, before.why, 'why unchanged');
    assert.equal(after.why, null);
    assert.equal(after.failure, `build blocked: ${REASON}`, 'failure names the block');
    assert.equal(after.built, true, 'the retried build counts as the second');
    assert.deepEqual(runsOf(w, 'brief').length, 1, 'no brief run after the block');
    const retried = w.openRun('a', 'build');
    assert.notEqual(retried.id, first.id);
    assert.equal(retried.input.task, first.input.task, 'the retried build has the same builder brief');
    assert.equal(retried.input.failure, `build blocked: ${REASON}`, "the retried build's failure input names the block");
    const stage = JSON.parse(readFileSync(join(runDir(w.root, retried.id), 'run.json'), 'utf8'));
    assert.equal(stage.input?.failure ?? stage.inputs?.failure, `build blocked: ${REASON}`, "the run folder's input has the failure");
    // The answer row names retry and who chose it.
    const ans = answers(w).at(-1);
    assert.equal(ans.payload.event.output.choice, 'retry');
    assert.equal(ans.payload.event.output.by, 'user_person');

    await w.agent('a', 'build', builds(w));
    assert.equal(w.state('a'), 'verifying');
    await w.agent('a', 'verify', verifies('PASS'));
    assert.equal(w.state('a'), 'awaitingMerge');
    await w.tap('a', w.cards.at(-1).choices[0]);
    assert.equal(w.state('a'), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), [1]);
    assert.equal(w.snap('a').context.pr.url, prUrl(1));
  } finally { await w.close(); }
});

test('retry-route: replan and drop on the blocked card do what replanning does; nothing retries without an answer', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    // No answer: driving again (and a due checkBack) moves nothing.
    await w.drive('a');
    await w.drive('a', '<wake reason="send-later" current-time="2999-01-01T00:00:00Z"></wake>');
    assert.equal(w.state('a'), 'blocked', 'only an answer retries');
    assert.equal(runsOf(w, 'build').length, 1);
    await w.tap('a', 'drop');
    assert.equal(w.state('a'), 'dropped');
  } finally { await w.close(); }
});

// A card with no PR takes its repository from the item's GitHub issue, so a grant for that repository answers it.
test('retry-route (note): a stand-in grant answers the blocked card, reading the repository from the issue', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    const host = w.host('a');
    const run = [...host.runs.values()].find((r) => r.actor === 'ask');
    const grants = [{ id: 'g1', workflow: 'quick-fix', ask: 'ask', choices: ['retry'], repos: ['o/r'], until: '2999-01-01T00:00:00Z' }];
    assert.equal(standinInput(host, { effect: run.id, choice: 'retry', by: 'standin', grants }).event.output.grant, 'g1');
  } finally { await w.close(); }
});

test('no-second-retry: a retried build blocked again replans with replan and drop only', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', blocked('blocked again'));
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
    assert.equal(w.snap('a').context.failure, 'build blocked: blocked again');
  } finally { await w.close(); }
});

test('no-second-retry: a rebuild after a verify FAIL that is blocked replans', async () => {
  const w = await world();
  try {
    await w.start('a'); await brief(w);
    await w.agent('a', 'build', builds(w));
    await w.agent('a', 'verify', verifies('FAIL'));
    assert.equal(w.state('a'), 'building');
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
  } finally { await w.close(); }
});

test('no-second-retry: a rebuild after a red check that is blocked replans', async () => {
  const w = await world();
  try {
    await w.start('a'); await brief(w);
    await w.agent('a', 'build', builds(w, { green: false }));
    assert.equal(w.state('a'), 'checking');
    await w.drive('a', redWake(w.gh.prs[1].head));
    assert.equal(w.state('a'), 'building');
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
  } finally { await w.close(); }
});

test('no-second-retry: a retried build whose verify FAILs has no build left and replans', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', builds(w));
    await w.agent('a', 'verify', verifies('FAIL'));
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
    assert.equal(runsOf(w, 'build').length, 2);
  } finally { await w.close(); }
});

test('no-second-retry: a replan resets the count, so a fresh attempt may be retried once', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', blocked('again'));
    assert.equal(w.state('a'), 'replanning');
    // A replan needs a why; a tap carries none, so answer as the ask's done event through offer.
    const { offer } = await import('../../../packages/engine/src/host.js');
    const host = w.host('a');
    const run = [...host.runs.values()].find((r) => r.actor === 'ask');
    await offer(host, [{ event: { type: 'xstate.done.actor.ask', output: { choice: 'replan', why: 'five whys', by: 'p' } }, run: run.id, source: { system: 'hearth', ref: w.cards.at(-1).ref } }], w.handlersFor(host));
    await w.drive('a');
    assert.equal(w.state('a'), 'briefing');
    await brief(w);
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'blocked', 'the new attempt\'s first build may be retried');
  } finally { await w.close(); }
});


