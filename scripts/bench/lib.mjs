// The stage bench (plan item stage-bench): run one model stage of a workflow alone, on committed cases, with the
// exact prompt the engine renders. Nothing here assembles a prompt: a run's prompt is the brief.md the engine's own
// prepare() writes (packages/engine/src/actors.js, which calls stages.js sections() and assemble()), and the bench
// sends that file's bytes. Usage and the refinement procedure: docs/prompts.md.
import { execFileSync, spawn as spawnChild } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { offer, restore } from '../../packages/engine/src/host.js';
import { accept, actors, bind, loadRun, prepare, runDir, spawn } from '../../packages/engine/src/actors.js';
import { handlers } from '../../packages/engine/src/effects/index.js';
import { loadWorkflow } from '../../packages/engine/src/index.js';
import { chart, isStage } from '../../packages/engine/src/stages.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '../..');
export const BENCH = join(REPO, 'bench');
export const SESSION = 'bench';
export const RELEASE = '0.0.0';
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const writeJson = (f, v) => {
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
};
const git = (dir, ...args) => execFileSync('git', ['-C', dir, '-c', 'user.email=bench@example.com', '-c', 'user.name=bench', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// ---- Workflow versions

/**
 * A workflow version: the bytes of <name>.json from a file (`workflow`), from this repo at a git revision (`rev`), or
 * this checkout's workflows/<name>.json. Returns { name, bytes, sha256, source, dir }: dir is a temp copy of this
 * repo's workflows/ with <name>.json replaced by those bytes, so the engine's loadWorkflow checks and pins exactly
 * them (its spec id is <name>@<sha256>).
 */
export function workflowVersion({ name = 'quick-fix', workflow = null, rev = null, pinned = null } = {}) {
  let bytes;
  let source;
  if (workflow) {
    bytes = readFileSync(resolve(workflow));
    source = `file ${resolve(workflow)}`;
  } else if (rev) {
    bytes = execFileSync('git', ['-C', REPO, 'show', `${rev}:workflows/${name}.json`]);
    source = `git ${rev}:workflows/${name}.json`;
  } else {
    bytes = readFileSync(join(REPO, 'workflows', `${name}.json`));
    source = `workflows/${name}.json`;
  }
  const dir = mkdtempSync(join(tmpdir(), 'bench-wf-'));
  for (const f of readdirSync(join(REPO, 'workflows')).filter((f) => f.endsWith('.json'))) cpSync(join(REPO, 'workflows', f), join(dir, f));
  writeFileSync(join(dir, `${name}.json`), bytes);
  // A journal's blob (a file named by its hash) is loaded as the pin it is: with the checks an item started on it keeps.
  pinned ??= Boolean(workflow && /^[0-9a-f]{64}$/.test(basename(workflow)));
  return { name, bytes, sha256: sha256(bytes), source, dir, pinned };
}

/**
 * The version's spec, checked and pinned by the engine; with root, its blob is stored there. A pinned version is read
 * back through its pin (name@sha256 from root/blobs), as restore() reads an item's workflow.
 */
export function specOf(version, root = null) {
  if (!version.pinned) return loadWorkflow(version.name, { root, dir: version.dir });
  const at = root ?? mkdtempSync(join(tmpdir(), 'bench-pin-'));
  mkdirSync(join(at, 'blobs'), { recursive: true });
  writeFileSync(join(at, 'blobs', version.sha256), version.bytes);
  return loadWorkflow(`${version.name}@${version.sha256}`, { root: at, dir: version.dir });
}

// ---- Stages and their inputs

/** The invoke of a stage in the chart (the first, if several): { at, state, id, src, input }. */
export function invokeOf(spec, actor) {
  if (!isStage(spec.meta?.actors?.[actor])) throw new Error(`${spec.id}: ${actor} is not a model stage (stages: ${Object.keys(spec.meta?.actors ?? {}).filter((a) => isStage(spec.meta.actors[a])).join(', ')})`);
  const inv = chart(spec).invokes.find((i) => i.src === actor);
  if (!inv) throw new Error(`${spec.id}: no state invokes ${actor}`);
  return inv;
}

/** Whether the stage's invoke is in the chart's initial state: then the bench runs it through the real host. */
export const atStart = (spec, actor) => invokeOf(spec, actor).state.join('.') === String(spec.initial);

/**
 * The stage's input for a case: every input the invoke gives it, a literal from the workflow (the task, for the brief
 * stage), else the case's value for that name, else null (what a context path no one has written yet holds).
 */
export function stageInput(spec, actor, given = {}) {
  const inv = invokeOf(spec, actor);
  return Object.fromEntries(Object.entries(inv.input).map(([name, from]) => [
    name,
    from && typeof from === 'object' && 'value' in from ? from.value : Object.hasOwn(given, name) ? given[name] : null
  ]));
}

// ---- Cases

/** The cases of a stage's bench: bench/<stage>/cases/<id>/case.json, in name order. */
export function casesOf(stage, only = null) {
  const dir = join(BENCH, stage, 'cases');
  const ids = readdirSync(dir).filter((n) => existsSync(join(dir, n, 'case.json'))).sort();
  const want = only == null || only === 'all' ? ids : String(only).split(',');
  for (const id of want) if (!ids.includes(id)) throw new Error(`no case ${id} in ${dir} (cases: ${ids.join(', ')})`);
  return want.map((id) => ({ ...readJson(join(dir, id, 'case.json')), id, dir: join(dir, id) }));
}

/**
 * A git clone of the case's repository at the case's commit, made under `work`. A case's repo is { seed: <folder in
 * the case> } (committed files, made into a one-commit repository) or { git: <url>, commit: <sha> } (fetched; a
 * public repository needs no token). The clone's origin is set to { origin } when given, so the run line names it.
 */
export function caseRepo(c, work) {
  const repo = join(work, 'repo');
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  if (c.repo?.seed) {
    cpSync(join(c.dir, c.repo.seed), repo, { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main', repo]);
    git(repo, 'add', '-A');
    git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', c.repo.message ?? `${c.id}: seed`, '--date', '2026-11-01T00:00:00Z');
  } else if (c.repo?.git && c.repo?.commit) {
    const cache = join(tmpdir(), 'bench-cache', sha256(c.repo.git).slice(0, 12));
    if (!existsSync(join(cache, 'HEAD'))) {
      mkdirSync(dirname(cache), { recursive: true });
      execFileSync('git', ['clone', '-q', '--bare', c.repo.git, cache], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
    }
    try {
      execFileSync('git', ['-C', cache, 'cat-file', '-e', `${c.repo.commit}^{commit}`], { stdio: 'ignore' });
    } catch {
      execFileSync('git', ['-C', cache, 'fetch', '-q', 'origin', c.repo.commit], { stdio: ['ignore', 'ignore', 'pipe'] });
    }
    execFileSync('git', ['clone', '-q', '--no-checkout', cache, repo], { stdio: ['ignore', 'ignore', 'pipe'] });
    git(repo, 'checkout', '-q', '-B', 'main', c.repo.commit);
  } else {
    throw new Error(`case ${c.id}: repo is neither { seed } nor { git, commit }`);
  }
  if (c.repo.origin) git(repo, 'remote', c.repo.seed ? 'add' : 'set-url', 'origin', c.repo.origin);
  else if (!c.repo.seed) git(repo, 'remote', 'remove', 'origin');
  return repo;
}

// ---- One run's folder, written by the engine

/**
 * Prepare one bench run of `actor` with the engine: a journal root at `root` holding item `item`, its run folder
 * (brief.md, context.md, stage.json, run.json) and a worktree of `repo` under `worktrees`. A stage invoked in the
 * initial state is started through the real host (restore, then offer the item's start event), so the journal holds
 * the item's first transition and the Inspector can replay it; any other stage is prepared directly with the same
 * prepare() the host's run handler calls, from the given stage input. Returns { run, dir, prompt, context }.
 */
export async function prepareRun({ spec, actor, item, root, repo, worktrees, caseInput = {}, input = null }) {
  mkdirSync(root, { recursive: true });
  let runId;
  if (input == null && atStart(spec, actor)) {
    const host = restore({ root, item, spec, session: SESSION, release: RELEASE });
    const hs = handlers({ github: null, actors: actors({ host, repo, worktrees }) });
    await offer(host, [{ event: { type: 'xstate.init', input: caseInput }, source: { system: 'bench', ref: `start ${item}` } }], hs);
    const open = [...host.runs.values()].filter((e) => e.actor === actor);
    if (open.length !== 1) throw new Error(`${item}: starting the item opened ${open.length} ${actor} runs`);
    runId = open[0].id;
  } else {
    const inv = invokeOf(spec, actor);
    runId = `${item}:0.${inv.id}`;
    const host = { root, item, spec, session: SESSION, release: RELEASE, snapshot: null };
    prepare({ host, effect: { id: runId, actor, invoke: inv.id, input: input ?? stageInput(spec, actor, caseInput), transition: null }, repo, worktrees });
  }
  const dir = runDir(root, runId);
  return { run: runId, dir, prompt: readFileSync(join(dir, 'brief.md'), 'utf8'), context: readFileSync(join(dir, 'context.md'), 'utf8') };
}

/** Start the run as the harness hooks do (PreToolUse spawn, SubagentStart bind), for a bench agent id. */
export function startAgent({ root, run, agentId }) {
  const toolUseId = `toolu_${agentId}`;
  const sp = spawn({ root, prompt: `ccp-run ${run}`, toolUseId, session: SESSION });
  if (!sp?.allow) throw new Error(`spawn refused: ${sp?.deny}`);
  const b = bind({ root, agentId, toolUseId, agentType: 'bench', session: SESSION, via: 'meta' });
  if (!b) throw new Error(`bind failed for ${run}`);
  return { prompt: sp.prompt, context: b.context };
}

/** The engine's accept(), as the return tool calls it. No GitHub: a result that claims a PR is refused with rule ref. */
export const acceptResult = ({ root, run, agentId, result, toolUseId }) =>
  accept({ root, caller: agentId, run, result, toolUseId, github: { pull: async () => { throw new Error('the bench has no GitHub'); } }, session: SESSION });

export { loadRun, runDir };

// ---- The model: Claude Code headless

/** The claude binary: $BENCH_CLAUDE (tests point it at a fake), else `claude` on PATH. */
export const claudeBin = () => process.env.BENCH_CLAUDE || 'claude';

/**
 * The environment a bench session runs in: this process's, without the variables that hand a session this host's
 * project instructions (extra CLAUDE.md folders) or memory, and with auto memory off. What still reaches the session
 * is measured per run (ambientOf), not assumed.
 */
export function benchEnv(extra = {}) {
  const env = { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', ...extra };
  for (const k of ['CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD', 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE', 'NODE_TEST_CONTEXT']) delete env[k];
  return env;
}

/** Run claude -p with `args`, the prompt on stdin. Resolves { code, stdout, stderr, ms }. */
export function runClaude({ args, prompt, cwd, env = benchEnv(), timeoutMs = 30 * 60 * 1000 }) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const child = spawnChild(claudeBin(), args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code, signal) => { clearTimeout(timer); ok({ code, signal, stdout, stderr, ms: Date.now() - t0 }); });
    child.stdin.end(prompt);
  });
}

/** The rows of claude's stream-json output. */
export const streamRows = (stdout) => stdout.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

/** Token counts from a result row's usage: fresh = input + cache writes + output, the tokens a run newly spends. */
export function tokensOf(usage = {}) {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return { input, output, cacheCreation, cacheRead, fresh: input + output + cacheCreation, total: input + output + cacheCreation + cacheRead };
}

// What can carry this host's instructions into a session, by what marks it in the session's system prompt or its
// context attachments. Found in a probe on 5 Nov: a headless session on this host gets the attribution trailers
// (remote_session_change), the user's email (session_context) and the skill list, with no CLAUDE.md or memory.
export const AMBIENT = Object.freeze({
  attribution: /Co-Authored-By:|Claude-Session:|Generated with \[Claude Code\]/,
  projectInstructions: /Contents of [^\n]*CLAUDE\.md|project instructions, checked into the codebase/,
  memory: /persistent file-based memory|# Memory\b|MEMORY\.md/,
  userContext: /# userEmail|The user's email address/,
  skills: /The following skills are available/,
  hooks: /hook additional context|SessionStart hook/
});

/** Claude Code's transcript of a session: ~/.claude/projects/<cwd with / and . as ->/<session>.jsonl, or null. */
export function transcriptOf(cwd, session) {
  const base = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
  const slug = resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');
  const file = join(base, slug, `${session}.jsonl`);
  return existsSync(file) ? file : null;
}

/**
 * What of this host reached a session, from its transcript: the attachment types, the system prompt as recorded
 * (prompt_snapshot), and which AMBIENT marks appear in either. reached is true when any mark appears.
 */
export function ambientOf(transcriptText) {
  const rows = String(transcriptText ?? '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const attachments = [];
  let systemPrompt = null;
  let seen = '';
  for (const r of rows) {
    if (r.type !== 'attachment') continue;
    const a = r.attachment ?? {};
    attachments.push(a.type ?? '?');
    if (a.type === 'prompt_snapshot') {
      const sp = a.systemPrompt ?? a.prompt ?? a.content;
      const text = Array.isArray(sp) ? sp.join('\n') : typeof sp === 'string' ? sp : JSON.stringify(a);
      if (!systemPrompt || text.length > systemPrompt.length) systemPrompt = text;
    } else {
      seen += `\n${JSON.stringify(r.rendered ?? a)}`;
    }
  }
  const marks = Object.entries(AMBIENT).filter(([, re]) => re.test(systemPrompt ?? '') || re.test(seen)).map(([k]) => k);
  return { recorded: rows.length > 0, reached: marks.length > 0, marks, attachments: [...new Set(attachments)], systemPrompt };
}

/** A transcript cut down for the run folder: the assistant's text and tool calls, and tool results to 2000 chars. */
export function trimTranscript(rows) {
  const out = [];
  for (const r of rows) {
    if (r.type === 'assistant') {
      for (const c of r.message?.content ?? []) {
        if (c.type === 'text' && c.text.trim()) out.push({ kind: 'text', text: c.text });
        if (c.type === 'tool_use') out.push({ kind: 'tool', tool: c.name, input: c.input });
      }
    } else if (r.type === 'user') {
      for (const c of Array.isArray(r.message?.content) ? r.message.content : []) {
        if (c.type !== 'tool_result') continue;
        const text = Array.isArray(c.content) ? c.content.map((x) => x.text ?? '').join('') : String(c.content ?? '');
        out.push({ kind: 'result', error: !!c.is_error, text: text.length > 2000 ? `${text.slice(0, 2000)}… (${text.length} chars)` : text });
      }
    }
  }
  return out;
}

// ---- Bench folders

/** The bench runs under a folder: every subfolder with bench.json, in name order. */
export function benchRuns(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().filter((n) => existsSync(join(dir, n, 'bench.json'))).map((n) => ({ name: n, dir: join(dir, n), bench: readJson(join(dir, n, 'bench.json')) }));
}

/** A bench run's accepted result ({ builder, verifier } for the brief stage), or null. */
export function resultOf(run) {
  const f = join(run.dir, run.bench.runFolder, 'result.json');
  return existsSync(f) ? readJson(f).result : null;
}
