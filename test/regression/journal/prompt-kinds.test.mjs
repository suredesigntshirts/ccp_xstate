// Expect: harness-glossary/capture-own-kinds, harness-glossary/prompt-unchanged, harness-glossary/v1-reads
// Each kind means one thing: the capture hook writes agent.prompt and agent.final, the engine writes prompt.md with a prompt.stored row, a run folder holding only brief.md still starts, and v1 journals read at v2 in the mapped kinds.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const BRIEF_MD_RUN = join(HERE, '..', 'fixtures', 'brief-md-run');
const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported', 'clamp throws when lo > hi'] };
const DATED = { GIT_AUTHOR_DATE: '2026-11-07T12:00:00Z', GIT_COMMITTER_DATE: '2026-11-07T12:00:00Z', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/** The raw lines of a journal file as written (not upcast), parsed. */
const rawRows = (file) => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

/**
 * A harness folder at a path named by `name` and this process, with one git repo committed at a fixed date.
 */
function world(name) {
  const base = join(tmpdir(), `verify-hg-${name}-${process.pid}`);
  rmSync(base, { recursive: true, force: true });
  const harness = join(base, 'harness');
  const root = join(harness, 'journal');
  mkdirSync(join(root, 'sessions'), { recursive: true });
  writeFileSync(join(harness, 'install.json'), '{}');
  const gitRepo = join(base, 'repo');
  const env = { ...process.env, ...DATED };
  execFileSync('git', ['init', '-q', '-b', 'main', gitRepo], { env });
  writeFileSync(join(gitRepo, 'math.js'), 'export const add = (a, b) => a + b;\n');
  execFileSync('git', ['-C', gitRepo, 'add', '-A'], { env });
  execFileSync('git', ['-C', gitRepo, '-c', 'user.email=v@v', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'one'], { env });
  return { base, harness, root, gitRepo };
}

const hookEnv = (repo, w) => ({ PATH: process.env.PATH, HOME: w.base, CCP_HARNESS_DIR: w.harness, CCP_HARNESS_STATE: join(w.base, 'state'), CLAUDE_CODE_REMOTE_SESSION_ID: '', CCP_GITHUB_API: 'http://127.0.0.1:9', CCP_REPO: repo });

/** The plugin's actor hook at `repo` with `input`: the parsed answer, or null when it printed nothing. */
function actorHook(repo, w, input) {
  const out = execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/actors.mjs')], { input: JSON.stringify(input), env: hookEnv(repo, w), encoding: 'utf8' }).trim();
  return out ? JSON.parse(out) : null;
}

/** Ask the plugin at `repo` to start run `run` with the Agent tool: the prompt its PreToolUse hook swaps in, or the answer. */
function spawnVia(repo, w, run, id = 'tu-spawn') {
  const a = actorHook(repo, w, { session_id: 'S', hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt: `ccp-run ${run}`, description: run, subagent_type: 'general-purpose' } });
  return a?.hookSpecificOutput?.updatedInput?.prompt ?? a;
}

/**
 * Start a quick-fix item `hg-1` with `repo`'s own host.js; its first state invokes the brief stage, so one run is
 * prepared. Returns the run, its folder's files, the prompt file's text, and the item's raw rows about it.
 */
function prepared(repo, name = 'prompt') {
  const w = world(name);
  const host = join(repo, 'packages/engine/bin/host.js');
  const started = JSON.parse(execFileSync(process.execPath, [host, 'start', '--item', 'hg-1', '--workflow', 'quick-fix', '--root', w.root, '--session', 'S',
    '--release', '0.2.0', '--input', JSON.stringify({ issue: ISSUE }), '--repo', w.gitRepo, '--worktrees', join(w.base, 'wt')], { env: hookEnv(repo, w), encoding: 'utf8', input: '' }));
  const run = started.waiting[0].run;
  const dir = join(w.root, 'items', 'hg-1', 'runs', run.split(':')[1]);
  const files = readdirSync(dir).sort();
  const file = files.includes('prompt.md') ? 'prompt.md' : 'brief.md';
  const rows = rawRows(join(w.root, 'items', 'hg-1.jsonl'));
  const stored = rows.filter((r) => r.kind === 'prompt.stored' || r.kind === 'brief.stored').map(({ v, kind, payload }) => ({ v, kind, payload }));
  return { w, run, dir, files, file, text: readFileSync(join(dir, file), 'utf8'), stored };
}

/**
 * Drive `repo`'s plugins/harness/scripts/capture.mjs, as Claude Code would, with every hook input the obs-live-capture
 * fixture recorded (a real session with one Agent call and its SubagentStart and SubagentStop). Returns the session
 * journal's rows as written, without id, at and release.
 */
function captured(repo, name = 'capture') {
  const w = world(name);
  execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/install.mjs')], { env: { PATH: process.env.PATH, CCP_HARNESS_DIR: w.harness } });
  const fix = join(HERE, '..', 'fixtures', 'live-capture');
  const inputs = readFileSync(join(fix, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l.replaceAll('<fixture>', fix)));
  for (const input of inputs) execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/capture.mjs')], { input: JSON.stringify(input), env: hookEnv(repo, w), encoding: 'utf8' });
  const rows = rawRows(join(w.root, 'sessions', `${inputs[0].session_id}.jsonl`));
  return rows.map(({ id, at, release, ...rest }) => rest);
}

/** The committed v1 journals the Expect line names. */
const V1 = {
  toyItem: 'test/regression/fixtures/v1/item-toy-v1.jsonl',
  toySession: 'test/regression/fixtures/v1/session-4a54715a-cd89-4d82-8b17-baefea4cf3a6.jsonl',
  finishRun1: 'test/regression/fixtures/v1/finish-run1.jsonl',
  finishRun2: 'test/regression/fixtures/v1/finish-run2.jsonl',
  bench: 'bench/brief/runs/baseline/real-adopt-clamp.3/items/real-adopt-clamp-3.jsonl',
};
const BENCH_ROOT = 'bench/brief/runs/baseline/real-adopt-clamp.3';

/** Every { what, ok } check anywhere in an inspector export. */
function checksOf(o, out = []) {
  if (Array.isArray(o)) o.forEach((x) => checksOf(x, out));
  else if (o && typeof o === 'object') {
    if (typeof o.what === 'string' && 'ok' in o) out.push({ what: o.what, ok: o.ok });
    for (const v of Object.values(o)) checksOf(v, out);
  }
  return out;
}

/**
 * The v1 reads at `repo`: readFile over each committed v1 journal (kinds counted, bad lines, agent.spawn hash fields),
 * `derive.js stalls` over the toy item and the bench item, and the inspector's export of the bench run (each model
 * run's prompt text against its brief.md on disk, every check).
 */
async function v1Reads(repo) {
  const { readFile } = await import(pathToFileURL(join(repo, 'packages/journal/src/index.js')).href);
  const reads = {};
  for (const [key, rel] of Object.entries(V1)) {
    const { rows, bad } = readFile(join(REPO, rel));
    const kinds = {};
    for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
    const spawnHashes = rows.filter((r) => r.kind === 'agent.spawn').map(({ payload: p }) => ({ promptHash: p.promptHash, ...('briefHash' in p ? { briefHash: p.briefHash } : {}) }));
    reads[key] = { rows: rows.length, bad, kinds, versions: [...new Set(rows.map((r) => r.v))], spawnHashes };
  }
  const derive = (rel) => JSON.parse(execFileSync(process.execPath, [join(repo, 'packages/journal/bin/derive.js'), 'stalls', '--journal', join(REPO, rel)], { encoding: 'utf8' }));
  const stalls = {};
  for (const key of ['toyItem', 'bench']) {
    const s = derive(V1[key]);
    stalls[key] = { prepared: s.prepared, blocked: s.blocked, blocks: s.blocks };
  }
  const out = join(tmpdir(), `verify-hg-export-${process.pid}.json`);
  execFileSync(process.execPath, [join(repo, 'scripts/inspector/export.mjs'), '--engine', repo, '--journal', join(REPO, BENCH_ROOT), '--out', out], { encoding: 'utf8' });
  const exp = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(out, { force: true });
  const models = [];
  for (const step of exp.steps ?? []) for (const a of step.actors ?? []) {
    if (!a.layers?.l2) continue;
    const runDir = join(REPO, BENCH_ROOT, 'items', exp.item, 'runs', String(a.effect).split(':')[1]);
    const onDisk = existsSync(join(runDir, 'brief.md')) ? readFileSync(join(runDir, 'brief.md'), 'utf8') : null;
    models.push({ effect: a.effect, textEqualsBriefMd: onDisk != null && a.layers.l2.text === onDisk, bytes: onDisk?.length ?? null });
  }
  const checks = checksOf(exp);
  return { reads, stalls, export: { item: exp.item, models, checks, hashOk: (exp.steps ?? []).map((s) => s.hashOk) } };
}

/** A copy of a run folder into another harness journal, under the same item and run. */
function copyRun(fromDir, w, run) {
  const [item, name] = run.split(':');
  const to = join(w.root, 'items', item, 'runs', name);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(fromDir, to, { recursive: true });
  return to;
}

const sha = (t) => createHash('sha256').update(t).digest('hex');
const pick = (rows, kind) => rows.filter((r) => r.kind === kind);

test('capture-own-kinds: the capture hook writes v2 agent.prompt and agent.final rows, never brief.stored or result.stored', () => {
  const rows = captured(REPO, 'capture-test');
  assert.ok(rows.every((r) => r.v === 2), 'v2 rows');
  assert.equal(pick(rows, 'agent.prompt').length, 1);
  assert.equal(pick(rows, 'agent.final').length, 1);
  assert.deepEqual(pick(rows, 'brief.stored'), []);
  assert.deepEqual(pick(rows, 'result.stored'), []);
  const spawn = pick(rows, 'agent.spawn')[0];
  assert.ok('promptHash' in spawn.payload && !('briefHash' in spawn.payload));
});

test('prompt-unchanged: the engine writes prompt.md, no brief.md, and a prompt.stored row with its hash', (t) => {
  const head = prepared(REPO, 'prompt');
  t.diagnostic(`files ${head.files.join(',')}`);
  assert.equal(head.file, 'prompt.md');
  assert.ok(!head.files.includes('brief.md'), 'no brief.md');
  assert.equal(head.stored.length, 1);
  assert.equal(head.stored[0].kind, 'prompt.stored');
  assert.equal(head.stored[0].payload.hash, sha(head.text));
  const run = JSON.parse(readFileSync(join(head.dir, 'run.json'), 'utf8'));
  assert.equal(run.promptHash, head.stored[0].payload.hash);
  assert.ok(!('briefHash' in run));
});

test('prompt-unchanged: the Agent hook at the head hands out prompt.md, and binds with its promptHash', () => {
  const head = prepared(REPO, 'spawn-head');
  const given = spawnVia(REPO, head.w, head.run);
  assert.equal(given, head.text);
  // SubagentStart binds the agent; its agent.spawn row carries the prompt's hash as promptHash.
  actorHook(REPO, head.w, { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-1', agent_type: 'general-purpose' });
  const spawnRow = rawRows(join(head.w.root, 'items', 'hg-1.jsonl')).find((r) => r.kind === 'agent.spawn');
  assert.ok(spawnRow, 'bound');
  assert.equal(spawnRow.payload.promptHash, sha(head.text));
  assert.ok(!('briefHash' in spawnRow.payload));
});

test('prompt-unchanged: a run folder holding only brief.md still starts with its bytes', (t) => {
  const RUN = JSON.parse(readFileSync(join(BRIEF_MD_RUN, 'run.json'), 'utf8')).run;
  const w = world('brief-md-folder');
  const dir = copyRun(BRIEF_MD_RUN, w, RUN);
  assert.ok(existsSync(join(dir, 'brief.md')) && !existsSync(join(dir, 'prompt.md')));
  const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));
  assert.ok('briefHash' in run && !('promptHash' in run), 'a brief.md-era run.json');
  const given = spawnVia(REPO, w, RUN);
  t.diagnostic(`given ${typeof given === 'string' ? `${given.length} chars` : JSON.stringify(given)}`);
  assert.equal(given, readFileSync(join(BRIEF_MD_RUN, 'brief.md'), 'utf8'));
  assert.ok(!existsSync(join(dir, 'prompt.md')), 'the old folder is not rewritten');
  actorHook(REPO, w, { session_id: 'S', hook_event_name: 'SubagentStart', agent_id: 'ag-old', agent_type: 'general-purpose' });
  const spawnRow = rawRows(join(w.root, 'items', 'hg-1.jsonl')).find((r) => r.kind === 'agent.spawn');
  assert.equal(spawnRow?.payload.promptHash, run.briefHash, 'the bound agent reports the hash of the prompt it was handed');
});

const V1READS = await v1Reads(REPO);

/** What the upcaster should make of each raw v1 row, worked out here from the item's outcome, not from its code. */
function expectedKinds(rel) {
  const kinds = {};
  for (const r of rawRows(join(REPO, rel))) {
    let k = r.kind;
    if (k === 'brief.stored' && r.payload?.contextHash) k = 'prompt.stored';
    else if (k === 'brief.stored' && !r.payload?.run) k = 'agent.prompt';
    else if (k === 'result.stored' && !r.payload?.run) k = 'agent.final';
    kinds[k] = (kinds[k] ?? 0) + 1;
  }
  return kinds;
}

test('v1-reads: every committed v1 journal reads with no bad rows, at v2, in the mapped kinds', (t) => {
  for (const [key, rel] of Object.entries(V1)) {
    const raw = rawRows(join(REPO, rel));
    assert.ok(raw.every((r) => r.v === 1), `${rel} is a v1 journal`);
    const h = V1READS.reads[key];
    t.diagnostic(`${rel}: ${h.rows} rows, bad ${h.bad.length}, kinds ${JSON.stringify(h.kinds)}`);
    assert.deepEqual(h.bad, [], rel);
    assert.equal(h.rows, raw.length, `${rel}: every row read`);
    assert.deepEqual(h.versions, [2]);
    assert.deepEqual(h.kinds, expectedKinds(rel), rel);
    // agent.spawn: briefHash becomes promptHash, value kept.
    const rawSpawns = raw.filter((r) => r.kind === 'agent.spawn');
    assert.deepEqual(h.spawnHashes, rawSpawns.map((r) => ({ promptHash: r.payload.briefHash })), `${rel} spawn hashes`);
  }
  // Each journal holds at least one of the shapes the upcaster maps.
  assert.ok(V1READS.reads.toyItem.kinds['prompt.stored'] === 3 && V1READS.reads.toyItem.kinds['brief.stored'] === 2, 'engine prompt rows mapped, returned briefs kept');
  assert.ok(V1READS.reads.toySession.kinds['agent.prompt'] === 3 && V1READS.reads.toySession.kinds['agent.final'] === 5);
  assert.ok(!('brief.stored' in V1READS.reads.finishRun1.kinds) && !('result.stored' in V1READS.reads.finishRun1.kinds));
  assert.ok(V1READS.reads.bench.spawnHashes[0].promptHash?.length === 64);
});

test('v1-reads: derive.js stalls counts the v1 toy and bench items', (t) => {
  t.diagnostic(JSON.stringify(V1READS.stalls));
  assert.equal(V1READS.stalls.toyItem.prepared, 3);
  assert.equal(V1READS.stalls.bench.prepared, 1);
});

test('v1-reads: the inspector shows each model run\'s prompt as its brief.md, every check ok', (t) => {
  t.diagnostic(JSON.stringify(V1READS.export));
  assert.ok(V1READS.export.models.length >= 1);
  assert.ok(V1READS.export.models.every((m) => m.textEqualsBriefMd));
  assert.ok(V1READS.export.checks.length >= 2 && V1READS.export.checks.every((c) => c.ok === true));
});
