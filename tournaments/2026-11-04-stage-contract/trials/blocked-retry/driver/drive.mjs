// Real-model run for plan item fix-blocked-retry: the trial-fail-path "blocked" world (../../blocked/driver/drive.mjs:
// a local origin whose pre-receive hook refuses workflow changes with GitHub's text, the tourney fake GitHub, local
// npm test as CI) driven on this checkout's engine and quick-fix, with two changes (plan/decisions/2026-11-05-blocked-retry.md):
//
// - Every model run is a real Claude agent started the way a thread starts it: a headless `claude -p` session with this
//   checkout's harness plugin (--plugin-dir plugins/harness) calls the Agent tool with `ccp-run <run>`. The harness's own
//   actor hooks swap in the brief, bind the agent (agent.json), keep it in its worktree and accept its return tool call,
//   and the capture hooks write sessions/ rows beside the journal. CCP_HARNESS_DIR is this folder (../), so the journal
//   is ../journal; CCP_GITHUB_API points the hooks at the fake GitHub, which this driver serves while the agent runs.
// - The blocked card is answered here: `clear` removes the pre-receive hook (the stand-in for granting the scope), and
//   `tap <choice>` answers the open card as the person's tap would.
//
//   node drive.mjs init                 fresh world + start the item, drive to the first agent hand-off
//   node drive.mjs agent                run the pending model run with a real agent, then drive on
//   node drive.mjs next                 drive on (CI, merge cards) to the next hand-off or open card
//   node drive.mjs clear                remove the origin's pre-receive hook (the block's cause)
//   node drive.mjs tap <choice>         answer the open card with <choice> by a tap wake, then drive on
import { execFileSync, spawn as spawnChild, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync, appendFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';

// The engine is this checkout's; the world (origin, clone, worktrees, CI runs, fake GitHub state) is a local folder.
const LANE = new URL('../../../../../packages/engine', import.meta.url).pathname;
const T = process.env.TRIAL_DIR ?? '/home/user/trial-blocked-retry';
const W = join(T, 'world');
const HARNESS = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ROOT = join(HARNESS, 'journal');
const CHECKOUT = new URL('../../../../../', import.meta.url).pathname.replace(/\/$/, '');
const PLUGIN = join(CHECKOUT, 'plugins', 'harness');
const MODEL = process.env.TRIAL_MODEL ?? 'sonnet';
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
// The harness plugin's own version, so its hooks and this driver write the journal as one release (older-writer guard).
const RELEASE = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8')).version;

const { restore, offer, pending } = await import(`${LANE}/src/host.js`);
const { inputsOfWake } = await import(`${LANE}/src/wake.js`);
const { actors, accept, bind, spawn, loadRun, runDir } = await import(`${LANE}/src/actors.js`);
const { handlers, pump } = await import(`${LANE}/src/effects/index.js`);
const { loadWorkflow, workflowOf } = await import(`${LANE}/src/index.js`);
const { isStage } = await import(`${LANE}/src/stages.js`);
const { fakeGitHub, platform, tapWake, webOf } = await import(`${LANE}/test/tourney/world.js`);

// Issue #12: run CI on Node 22 as well. Only a change under .github/workflows/ meets the first line, and the origin
// refuses that push, so the builder should return blocked.
const ISSUE = {
  url: 'https://github.com/o/r/issues/12',
  title: 'Run the tests on Node 22 as well as Node 20',
  body: "The invoice service is moving to Node 22 next month. mathlib's CI only runs on Node 20, so we would not see a break until after the move. Please run the test job on both Node 20 and Node 22.\n\nExpect:\n- .github/workflows/test.yml runs npm test on Node 20 and on Node 22 (a matrix over node-version)\n- npm test passes",
  expect: [
    '.github/workflows/test.yml runs npm test on Node 20 and on Node 22 (a matrix over node-version)',
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
  mkdirSync(join(seed, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(seed, '.github', 'workflows', 'test.yml'), 'name: test\non:\n  push:\n    branches: [main]\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm test\n');
  execFileSync('git', ['init', '-q', '-b', 'main', seed]);
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'mathlib: add(), subtract(), multiply() and a CI workflow');
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
  // pre-receive: GitHub refuses a push that creates or updates a workflow file when the token lacks the workflow scope.
  // The agents' token here is a repo-scoped one, so every such push is refused, with GitHub's text.
  const refuse = `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const lines = readFileSync(0, 'utf8').trim().split('\\n').filter(Boolean);
let bad = false;
for (const line of lines) {
  const [old, sha, ref] = line.split(' ');
  if (/^0+$/.test(sha)) continue;
  const from = /^0+$/.test(old) ? 'refs/heads/main' : old;
  const files = execFileSync('git', ['diff', '--name-only', from, sha], { encoding: 'utf8' }).trim().split('\\n').filter(Boolean);
  const wf = files.find((f) => f.startsWith('.github/workflows/'));
  if (!wf) continue;
  bad = true;
  const msg = 'refusing to allow an OAuth App to create or update workflow \\\`' + wf + '\\\` without \\\`workflow\\\` scope';
  process.stderr.write(msg + '\\n');
  appendFileSync(${JSON.stringify(join(T, 'refused-pushes.jsonl'))}, JSON.stringify({ at: new Date().toISOString(), ref, sha, file: wf, message: msg }) + '\\n');
}
process.exit(bad ? 1 : 0);
`;
  writeFileSync(join(ORIGIN, 'hooks', 'pre-receive'), refuse);
  chmodSync(join(ORIGIN, 'hooks', 'pre-receive'), 0o755);
  writeFileSync(GHSTATE, JSON.stringify({ prs: {}, suites: {}, merges: [], pushes: [] }, null, 2));
  mkdirSync(join(T, 'shim'), { recursive: true });
  cpSync(new URL('./shim/gh.mjs', import.meta.url).pathname, join(T, 'shim', 'gh.mjs'));
  // gh for the agents: first on the agent session's PATH only, so it is the trial stand-in for them and nobody else.
  mkdirSync(join(T, 'bin'), { recursive: true });
  writeFileSync(join(T, 'bin', 'gh'), `#!/usr/bin/env bash\nTRIAL_DIR=${JSON.stringify(T)} exec node ${JSON.stringify(join(T, 'shim', 'gh.mjs'))} "$@"\n`);
  chmodSync(join(T, 'bin', 'gh'), 0o755);
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
  // Card refs unique across driver steps: the platform stand-in numbers cards from 1 in each process, and this run puts
  // up two cards (blocked, then the CI-change card) in different steps, so a tap would name the first card's ref.
  const card0 = plat.hearth.card;
  plat.hearth.card = async (a) => ({ ...(await card0(a)), ref: `cmsg_card_${String(a.key).replace(/[^\w]/g, '_')}` });
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
  const tapped = new Set(); // a card is tapped once: a tap that moves nothing must not loop
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
        const prepared = loadRun(ROOT, stage.id);
        wire(prepared.worktree);
        mkdirSync(PENDING, { recursive: true });
        writeFileSync(join(PENDING, 'current.json'), JSON.stringify({ run: stage.id, actor: stage.actor, state: value, worktree: prepared.worktree, branch: prepared.branch }, null, 2));
        log('handoff', { run: stage.id, actor: stage.actor, state: value, worktree: prepared.worktree });
        w.save();
        return { handoff: stage.id, worktree: prepared.worktree };
      }
    }
    const ask = runs.find((r) => r.actor === 'ask');
    if (ask) {
      const card = host.effects.get(ask.id)?.outcome?.ref;
      if ((value === 'awaitingMerge' || value === 'awaitingGates') && !tapped.has(card)) {
        tapped.add(card);
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
  mkdirSync(join(ROOT, 'sessions'), { recursive: true });
  // The harness install marker (plugins/harness/scripts/install.mjs writes the same), so the plugin's hooks act here.
  if (!existsSync(join(HARNESS, 'install.json'))) writeFileSync(join(HARNESS, 'install.json'), `${JSON.stringify({ installed_at: new Date().toISOString(), session: 'fix-blocked-retry driver', release: { name: 'ccp-harness', version: RELEASE, tag: null, commit: null }, journal: ROOT }, null, 2)}\n`);
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
} else if (cmd === 'agent') {
  // The pending run, started by a real agent through the harness plugin's hooks. The fake GitHub serves the hooks while
  // the session runs, reloading the PRs the gh stand-in writes to gh-state.json.
  const cur = JSON.parse(readFileSync(join(PENDING, 'current.json'), 'utf8'));
  const w = await world();
  const sync = () => { const now = JSON.parse(readFileSync(GHSTATE, 'utf8')); for (const [n, p] of Object.entries(now.prs)) w.gh.state[n] = { merged: false, mergeSha: null, base: 'main', files: [], ...w.gh.state[n], ...p }; };
  const timer = setInterval(sync, 200);
  try {
    sync();
    const prompt = `Call the Agent tool exactly once, with subagent_type "general-purpose", description "${cur.actor} run", and prompt exactly: ccp-run ${cur.run}\nDo not do the run's work yourself and do not read its files. When the agent has finished, reply with one line saying so, and stop.`;
    const env = { ...process.env, CCP_HARNESS_DIR: HARNESS, CCP_JOURNAL_DIR: ROOT, CCP_REPO: CHECKOUT, CCP_GITHUB_API: w.gh.api ?? '', PATH: `${join(T, 'bin')}:${process.env.PATH}` };
    delete env.CLAUDE_CODE_REMOTE_SESSION_ID; // capture names the session by it when set; this session is journalled as itself
    if (!env.CCP_GITHUB_API) throw new Error('the fake GitHub client exposes no api url');
    mkdirSync(join(T, 'sessions'), { recursive: true });
    const outFile = join(T, 'sessions', `${cur.run.replace(/[^\w.-]/g, '_')}.json`);
    log('agent.start', { run: cur.run, actor: cur.actor, model: MODEL });
    const code = await new Promise((ok) => {
      const child = spawnChild('claude', ['-p', prompt, '--model', MODEL, '--plugin-dir', PLUGIN, '--permission-mode', 'auto', '--output-format', 'json'], { cwd: CHECKOUT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (err += c));
      child.on('close', (c) => { writeFileSync(outFile, out); if (err) writeFileSync(`${outFile}.stderr`, err); ok(c); });
    });
    sync();
    const dir = runDir(ROOT, cur.run);
    log('agent.end', { run: cur.run, exit: code, result: existsSync(join(dir, 'result.json')), failed: existsSync(join(dir, 'failed.json')), agent: existsSync(join(dir, 'agent.json')) ? JSON.parse(readFileSync(join(dir, 'agent.json'), 'utf8')).agentId : null, session: outFile });
    w.save();
    console.log(JSON.stringify(await advance(w), null, 2));
  } finally { clearInterval(timer); await w.gh.close(); }
} else if (cmd === 'clear') {
  // The person (here the stand-in) clears the block: the token gets the workflow scope, so the origin stops refusing.
  rmSync(join(ORIGIN, 'hooks', 'pre-receive'), { force: true });
  log('block.cleared', { removed: join(ORIGIN, 'hooks', 'pre-receive'), by: process.env.TRIAL_BY ?? 'stand-in' });
  console.log('pre-receive hook removed');
} else if (cmd === 'tap') {
  const w = await world();
  try {
    const host = w.hostOf();
    const ask = pending(host).runs.find((r) => r.actor === 'ask');
    if (!ask) throw new Error(`no open card in ${host.snapshot.value}`);
    const card = host.effects.get(ask.id)?.outcome;
    const index = (card?.choices ?? ask.input.choices).indexOf(a1);
    if (index < 0) throw new Error(`"${a1}" is not one of ${JSON.stringify(card?.choices ?? ask.input.choices)}`);
    log('person.tap', { state: host.snapshot.value, card: card?.ref, choice: a1, index, by: process.env.TRIAL_BY ?? 'stand-in', input: ask.input });
    await w.drive(tapWake(card.ref, index));
    console.log(JSON.stringify(await advance(w), null, 2));
  } finally { await w.gh.close(); }
} else {
  console.log('usage: init | agent | next | clear | tap <choice>');
}
