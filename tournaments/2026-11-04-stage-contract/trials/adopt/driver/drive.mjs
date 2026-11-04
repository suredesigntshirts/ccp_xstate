// Real-model trial driver for plan item engine-stage-contract (trial "adopt"), ported from trial 2's driver
// (/mnt/project-files/stage-contract-tournament/trial2/driver/drive.mjs). It runs quick-fix on this repo's engine, as
// checked out at the PR head, as tourney Q1 does
// (real restore/offer/pump, real handlers, real actors.prepare, real spawn/bind/accept, the tourney fakeGitHub and
// platform), except that model stages are answered by real agents: the driver stops at each model run, prints the
// prompt the agent would get (brief.md + context.md), and is resumed with `answer <run> <file>`.
//
//   node drive.mjs init                 fresh world + start the item, drive to the first agent hand-off
//   node drive.mjs next                 drive on (CI, cards) to the next hand-off
//   node drive.mjs answer <run> <file>  accept() the agent's JSON; on accept drive on, on refusal print it
//
// Nothing leaves the machine: GitHub is the tourney fake server (state persisted in gh-state.json between steps),
// the git "remote" is a local bare repo whose post-receive hook opens/updates the PR in that state on push.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

// The engine is this checkout's; the world (origin, clone, worktrees, CI runs, fake GitHub state) is a local folder.
const LANE = new URL('../../../../../packages/engine', import.meta.url).pathname;
const T = process.env.TRIAL_DIR ?? '/home/user/trial-adopt';
const W = join(T, 'world');
const ROOT = new URL('../journal', import.meta.url).pathname;
const ORIGIN = join(W, 'origin.git');
const REPO = join(W, 'repo');
const WT = join(W, 'wt');
const GHSTATE = join(T, 'gh-state.json');
const LOG = join(T, 'driver-log.jsonl');
const PENDING = join(T, 'pending');
const ITEM = 'trial';
const GH_URL = 'https://github.com/o/r.git';
// Each run's worktree reaches the fake origin through its own config (config.worktree), so the main clone's origin stays
// https://github.com/o/r.git for the engine's githubOf, and git push/fetch in a worktree land in the local bare repo.
const wire = (wt) => { try { execFileSync('git', ['-C', wt, 'config', '--worktree', '--unset-all', `url.${ORIGIN}.insteadOf`]); } catch {} for (const u of [GH_URL, 'https://github.com/o/r']) execFileSync('git', ['-C', wt, 'config', '--worktree', '--add', `url.${ORIGIN}.insteadOf`, u]); };
const SESSION = 'owner';
const RELEASE = '0.2.0';

const { restore, offer, pending } = await import(`${LANE}/src/host.js`);
const { inputsOfWake } = await import(`${LANE}/src/wake.js`);
const { actors, accept, bind, spawn, loadRun, runDir } = await import(`${LANE}/src/actors.js`);
const { handlers, pump } = await import(`${LANE}/src/effects/index.js`);
const { loadWorkflow, workflowOf } = await import(`${LANE}/src/index.js`);
const { isStage } = await import(`${LANE}/src/stages.js`);
const { fakeGitHub, platform, tapWake, webOf } = await import(`${LANE}/test/tourney/world.js`);

// Issue #23: chosen so one line is plausibly half-met. The repo already exports subtract() but its README never
// documented it; the body asks only for clamp's docs, while the third expect line asks for every export.
const ISSUE = {
  url: 'https://github.com/o/r/issues/23',
  title: 'clamp() for mathlib, so discount percentages stop going negative',
  body: "The invoice service applies discount percentages from a form, and people sometimes type -5 or 140. We'd like a clamp(x, lo, hi) in mathlib that keeps a value inside a range, and it should refuse a range that makes no sense (lo above hi) with a RangeError rather than guessing.\n\nPlease add clamp to the README's API section too, so the invoice team can find it.\n\nExpect:\n- math.js exports clamp(x, lo, hi), which returns x limited to the range lo to hi\n- clamp(x, lo, hi) throws a RangeError when lo is greater than hi\n- README.md documents every function math.js exports\n- npm test passes",
  expect: [
    'math.js exports clamp(x, lo, hi), which returns x limited to the range lo to hi',
    'clamp(x, lo, hi) throws a RangeError when lo is greater than hi',
    'README.md documents every function math.js exports',
    'npm test passes'
  ]
};

const log = (kind, data = {}) => {
  const row = { at: new Date().toISOString(), kind, ...data };
  appendFileSync(LOG, `${JSON.stringify(row)}\n`);
  console.log(`[${kind}]`, JSON.stringify(data).slice(0, 400));
};
const git = (dir, ...args) => execFileSync('git', ['-C', dir, '-c', 'user.email=dev@example.com', '-c', 'user.name=dev', ...args], { encoding: 'utf8' }).trim();

// ---- the world: origin (bare), clone, the issue's repo
function makeRepo() {
  rmSync(W, { recursive: true, force: true });
  mkdirSync(W, { recursive: true });
  const seed = join(W, 'seed');
  mkdirSync(join(seed, 'test'), { recursive: true });
  writeFileSync(join(seed, 'package.json'), `${JSON.stringify({ name: 'mathlib', version: '1.0.0', description: 'Small math helpers used by the invoice service', main: 'math.js', scripts: { test: 'node --test' }, license: 'MIT' }, null, 2)}\n`);
  writeFileSync(join(seed, 'math.js'), "'use strict';\n\n/** Sum of two numbers. */\nfunction add(a, b) {\n  return a + b;\n}\n\n/** Difference of two numbers. */\nfunction subtract(a, b) {\n  return a - b;\n}\n\n/** Product of two numbers. */\nfunction multiply(a, b) {\n  return a * b;\n}\n\nmodule.exports = { add, subtract, multiply };\n");
  writeFileSync(join(seed, 'test', 'math.test.js'), "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { add, subtract, multiply } = require('../math.js');\n\ntest('add sums two numbers', () => {\n  assert.equal(add(2, 3), 5);\n  assert.equal(add(-1, 1), 0);\n});\n\ntest('subtract returns the difference', () => {\n  assert.equal(subtract(5, 3), 2);\n});\n\ntest('multiply returns the product', () => {\n  assert.equal(multiply(2, 3), 6);\n  assert.equal(multiply(-2, 3), -6);\n});\n");
  writeFileSync(join(seed, 'README.md'), '# mathlib\n\nSmall math helpers used by the invoice service.\n\n## API\n\n### add(a, b)\n\nReturns the sum of `a` and `b`.\n\n```js\nconst { add } = require(\'./math.js\');\nadd(2, 3); // 5\n```\n\n### multiply(a, b)\n\nReturns the product of `a` and `b`.\n\n```js\nmultiply(-2, 3); // -6\n```\n\n## Tests\n\nRun the tests with `npm test`.\n');
  writeFileSync(join(seed, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['init', '-q', '-b', 'main', seed]);
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'mathlib: add() and multiply()');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', ORIGIN]);
  git(seed, 'remote', 'add', 'origin', ORIGIN);
  git(seed, 'push', '-q', 'origin', 'main');
  rmSync(seed, { recursive: true, force: true });
  execFileSync('git', ['clone', '-q', ORIGIN, REPO]);
  git(REPO, 'remote', 'set-url', 'origin', GH_URL);
  git(REPO, 'config', 'extensions.worktreeConfig', 'true');
  // post-receive: a push of any branch but main opens a PR for it (or updates its PR) in the fake GitHub's state, and
  // keeps refs/pull/<n>/head, as GitHub does.
  const hook = `#!/usr/bin/env node
// GitHub's push behaviour, minus PR creation: a push to a branch with an open PR moves that PR's head (and refs/pull/<n>/head).
const { readFileSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const STATE = ${JSON.stringify(GHSTATE)};
const lines = readFileSync(0, 'utf8').trim().split('\\n').filter(Boolean);
const s = JSON.parse(readFileSync(STATE, 'utf8'));
for (const line of lines) {
  const [, sha, ref] = line.split(' ');
  if (!ref.startsWith('refs/heads/') || /^0+$/.test(sha)) continue;
  const branch = ref.slice(11);
  s.pushes.push({ at: new Date().toISOString(), branch, sha });
  const n = Object.keys(s.prs).find((k) => s.prs[k].branch === branch && !s.prs[k].merged);
  if (!n) continue;
  s.prs[n].head = sha;
  s.prs[n].files = execFileSync('git', ['diff', '--name-only', s.prs[n].base + '...' + sha], { encoding: 'utf8' }).trim().split('\\n').filter(Boolean);
  execFileSync('git', ['update-ref', 'refs/pull/' + n + '/head', sha]);
}
writeFileSync(STATE, JSON.stringify(s, null, 2));
`;
  writeFileSync(join(ORIGIN, 'hooks', 'post-receive'), hook);
  chmodSync(join(ORIGIN, 'hooks', 'post-receive'), 0o755);
  writeFileSync(GHSTATE, JSON.stringify({ prs: {}, suites: {}, merges: [], pushes: [] }, null, 2));
}

// ---- one step's world over the persisted GitHub state
async function world() {
  const saved = JSON.parse(readFileSync(GHSTATE, 'utf8'));
  const gh = await fakeGitHub(saved.prs);
  Object.assign(gh.suites, saved.suites);
  gh.merges.push(...saved.merges);
  const save = () => {
    const now = JSON.parse(readFileSync(GHSTATE, 'utf8')); // the hook may have written since
    for (const [n, p] of Object.entries(gh.state)) now.prs[n] = { ...now.prs[n], ...p, branch: now.prs[n]?.branch ?? p.branch };
    now.suites = gh.suites;
    now.merges = gh.merges;
    writeFileSync(GHSTATE, JSON.stringify(now, null, 2));
  };
  const plat = platform();
  const web = webOf({});
  const load = (name, opts) => loadWorkflow(name, opts);
  const handlersFor = (host) => handlers({
    github: gh.client, hearth: plat.hearth,
    actors: actors({ host, repo: REPO, worktrees: WT }),
    host, workflows: ['quick-fix', 'feature', 'research'], load, handlersFor
  });
  const hostOf = () => { const spec = workflowOf(ROOT, ITEM); return spec && restore({ root: ROOT, item: ITEM, spec, session: SESSION, release: RELEASE }); };
  const drive = (text = '') => pump({ root: ROOT, top: ITEM, session: SESSION, release: RELEASE, handlersFor,
    inputsFor: (host) => (text ? inputsOfWake(host, text, { now: '2999-01-01T00:00:00Z' }) : []) });
  return { gh, plat, web, handlersFor, hostOf, drive, save };
}

const ev = (kind, json) => `<wake reason="external-event" current-time="${new Date().toISOString()}">\n  <event source="github" kind="${kind}" from="system" trust="relay">\n    ${JSON.stringify(json)}\n  </event>\n</wake>`;

// CI: run the repo's tests at the PR head in a throwaway worktree of origin, for real.
function ci(sha) {
  const dir = join(T, 'ci', sha);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(T, 'ci'), { recursive: true });
  execFileSync('git', ['--git-dir', ORIGIN, 'worktree', 'add', '-q', '--detach', dir, sha]);
  const r = spawnSync('npm', ['test'], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  const out = `$ npm test (at ${sha})\n${r.stdout}\n${r.stderr}\nexit ${r.status}\n`;
  writeFileSync(join(T, 'ci', `${sha}.log`), out);
  execFileSync('git', ['--git-dir', ORIGIN, 'worktree', 'remove', '--force', dir]);
  return { ok: r.status === 0, log: join(T, 'ci', `${sha}.log`), out };
}

// Drive until an agent is needed or the item ends.
async function advance(w) {
  for (let i = 0; i < 40; i++) {
    await w.drive();
    const host = w.hostOf();
    const value = host.snapshot.value;
    if (host.snapshot.status === 'done') { log('item.ended', { value, context: host.snapshot.context }); w.save(); return { ended: value }; }
    const runs = pending(host).runs;
    const stage = runs.find((r) => isStage(host.spec.meta.actors?.[r.actor]));
    if (stage) {
      const dir = runDir(ROOT, stage.id);
      if (!existsSync(join(dir, 'result.json'))) {
        const brief = readFileSync(join(dir, 'brief.md'), 'utf8');
        const context = readFileSync(join(dir, 'context.md'), 'utf8');
        const prepared = loadRun(ROOT, stage.id);
        wire(prepared.worktree);
        // The harness's PreToolUse (spawn) and SubagentStart (bind) hooks, as world.agent calls them.
        const agentId = `real-${stage.id}`.replace(/[^\w-]/g, '_');
        const tool = `toolu_${agentId}`;
        if (!existsSync(join(dir, 'agent.json'))) {
          const sp = spawn({ root: ROOT, prompt: `ccp-run ${stage.id}`, toolUseId: tool });
          const b = bind({ root: ROOT, agentId, toolUseId: tool });
          log('agent.spawn', { run: stage.id, agentId, spawnPromptIsBrief: sp?.prompt === brief, bindContextIsContextMd: b?.context === context });
        }
        mkdirSync(PENDING, { recursive: true });
        const prompt = `${brief}\n\n${context}`;
        const file = join(PENDING, `${stage.id.replace(/[^\w.-]/g, '_')}.prompt.md`);
        writeFileSync(file, prompt);
        writeFileSync(join(PENDING, 'current.json'), JSON.stringify({ run: stage.id, actor: stage.actor, state: value, agentId, worktree: prepared.worktree, branch: prepared.branch, promptFile: file }, null, 2));
        log('handoff', { run: stage.id, actor: stage.actor, state: value, promptFile: file });
        w.save();
        return { handoff: stage.id, promptFile: file, worktree: prepared.worktree };
      }
    }
    const ask = runs.find((r) => r.actor === 'ask');
    if (ask) {
      const card = host.effects.get(ask.id)?.outcome?.ref;
      if (value === 'awaitingMerge' || value === 'awaitingGates') {
        log('person.tap', { state: value, card, choice: 0, input: ask.input });
        await w.drive(tapWake(card, 0));
        continue;
      }
      log('item.asks', { state: value, card, input: ask.input, context: host.snapshot.context });
      w.save();
      return { ended: `asking in ${value}` };
    }
    if (value === 'checking') {
      const { at, key } = host.snapshot.context.pr;
      const n = Number(key.split('#')[1]);
      const r = ci(at);
      log('ci', { sha: at, pr: key, ok: r.ok, log: r.log, tail: r.out.slice(-600) });
      if (r.ok) { w.gh.green(at); await w.drive(ev('check_suite.completed', { head_sha: at, pr: key })); }
      else { w.gh.suites[at] = [{ status: 'completed', conclusion: 'failure' }]; await w.drive(ev('check_run.completed', { check: 'test', check_run_id: n, conclusion: 'failure', details_url: `file://${r.log}`, head_sha: at, pr: key })); }
      continue;
    }
    log('stuck', { value, runs: runs.map((r) => r.id) });
    w.save();
    return { stuck: value };
  }
  w.save();
  return { stuck: 'loop limit' };
}

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'init') {
  if (existsSync(join(ROOT, 'items'))) throw new Error(`${ROOT} already holds a journal; remove it first`);
  rmSync(LOG, { force: true }); rmSync(PENDING, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  makeRepo();
  const w = await world();
  try {
    const host = restore({ root: ROOT, item: ITEM, spec: loadWorkflow('quick-fix', { root: ROOT }), session: SESSION, release: RELEASE });
    const r = await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: `start ${ITEM}` } }], w.handlersFor(host));
    log('start', { outcome: r.map((x) => x.outcome), issue: ISSUE });
    console.log(JSON.stringify(await advance(w), null, 2));
  } finally { await w.gh.close(); }
} else if (cmd === 'next') {
  const w = await world();
  try { console.log(JSON.stringify(await advance(w), null, 2)); } finally { await w.gh.close(); }
} else if (cmd === 'answer') {
  const w = await world();
  try {
    const cur = JSON.parse(readFileSync(join(PENDING, 'current.json'), 'utf8'));
    if (cur.run !== a1) throw new Error(`pending run is ${cur.run}, not ${a1}`);
    const raw = readFileSync(a2, 'utf8');
    let result;
    let unwrapped = false;
    let parseError = null;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(m ? m[0] : raw);
      if (result && typeof result === 'object' && 'run' in result && 'result' in result && Object.keys(result).length === 2) { result = result.result; unwrapped = true; }
    } catch (e) { parseError = String(e.message); }
    if (parseError) { log('answer.unparsable', { run: a1, parseError }); console.log(JSON.stringify({ refused: { rule: 'parse', reason: `your final message is not JSON: ${parseError}` } })); }
    else {
      const got = await accept({ root: ROOT, caller: cur.agentId, run: a1, result, toolUseId: `ret-${Date.now()}`, github: w.gh.client, web: w.web });
      log('accept', { run: a1, unwrapped, answer: a2, got });
      console.log(JSON.stringify(got, null, 2));
      if (got.accepted) console.log(JSON.stringify(await advance(w), null, 2));
    }
    w.save();
  } finally { await w.gh.close(); }
} else {
  console.log('usage: init | next | answer <run> <file>');
}
