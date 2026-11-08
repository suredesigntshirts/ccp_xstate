// Verifier's helpers for plan item harness-glossary, written from the item's Expect lines; the builder's tests are not
// used. Each helper takes a checkout (`repo`) and drives that checkout's own code, so the same steps run at main and at
// the PR head: record.mjs writes main's answers to evidence/, and the tests compare the head's live answers with them.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const EVIDENCE = join(HERE, 'evidence');
export const ISSUE = { url: 'https://github.com/o/r/issues/9', title: 'Add clamp', body: 'Add clamp(x, lo, hi).', expect: ['clamp is exported', 'clamp throws when lo > hi'] };
const DATED = { GIT_AUTHOR_DATE: '2026-11-07T12:00:00Z', GIT_COMMITTER_DATE: '2026-11-07T12:00:00Z', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/** The raw lines of a journal file as written (not upcast), parsed. */
export const rawRows = (file) => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

/**
 * A harness folder at a fixed path (so the prompt's bytes cannot differ by temp name), with one git repo committed at
 * a fixed date, so two checkouts given the same `name` see the same world.
 */
export function world(name) {
  const base = join(tmpdir(), `verify-hg-${name}`);
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
export function actorHook(repo, w, input) {
  const out = execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/actors.mjs')], { input: JSON.stringify(input), env: hookEnv(repo, w), encoding: 'utf8' }).trim();
  return out ? JSON.parse(out) : null;
}

/** Ask the plugin at `repo` to start run `run` with the Agent tool: the prompt its PreToolUse hook swaps in, or the answer. */
export function spawnVia(repo, w, run, id = 'tu-spawn') {
  const a = actorHook(repo, w, { session_id: 'S', hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { prompt: `ccp-run ${run}`, description: run, subagent_type: 'general-purpose' } });
  return a?.hookSpecificOutput?.updatedInput?.prompt ?? a;
}

/**
 * Start a quick-fix item `hg-1` with `repo`'s own host.js; its first state invokes the brief stage, so one run is
 * prepared. Returns the run, its folder's files, the prompt file's text, and the item's raw rows about it.
 */
export function prepared(repo, name = 'prompt') {
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
export function captured(repo, name = 'capture') {
  const w = world(name);
  execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/install.mjs')], { env: { PATH: process.env.PATH, CCP_HARNESS_DIR: w.harness } });
  const fix = join(REPO, 'verify/obs-live-capture/fixture');
  const inputs = readFileSync(join(fix, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l.replaceAll('<fixture>', fix)));
  for (const input of inputs) execFileSync(process.execPath, [join(repo, 'plugins/harness/scripts/capture.mjs')], { input: JSON.stringify(input), env: hookEnv(repo, w), encoding: 'utf8' });
  const rows = rawRows(join(w.root, 'sessions', `${inputs[0].session_id}.jsonl`));
  return rows.map(({ id, at, release, ...rest }) => rest);
}

/** The committed v1 journals the Expect line names. */
export const V1 = {
  toyItem: 'test/regression/fixtures/v1/item-toy-v1.jsonl',
  toySession: 'test/regression/fixtures/v1/session-4a54715a-cd89-4d82-8b17-baefea4cf3a6.jsonl',
  finishRun1: 'verify/fix-agent-finish-ms/evidence/real/journal-run1.jsonl',
  finishRun2: 'verify/fix-agent-finish-ms/evidence/real/journal-run2.jsonl',
  bench: 'bench/brief/runs/baseline/real-adopt-clamp.3/items/real-adopt-clamp-3.jsonl',
};
export const BENCH_ROOT = 'bench/brief/runs/baseline/real-adopt-clamp.3';

/** Every { what, ok } check anywhere in an inspector export. */
export function checksOf(o, out = []) {
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
export async function v1Reads(repo) {
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
export function copyRun(fromDir, w, run) {
  const [item, name] = run.split(':');
  const to = join(w.root, 'items', item, 'runs', name);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(fromDir, to, { recursive: true });
  return to;
}
