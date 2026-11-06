// Invoked actors (plan item engine-actors): the agents a workflow starts, and the one way their results come back.
// When a state invokes a model stage (an actor whose meta.actors entry has stage parts), the host's run handler renders
// the run's prompt from that entry (stages.js) into brief.md in its own run folder, makes it a git worktree named by item and run,
// journals the prompt's hash, and writes the run's stage record, stage.json (trace.js): every prompt piece and input with
// its source, and, once the item takes the result (the handler's ended), where the output went. The session then starts the agent with the Agent tool and the prompt `ccp-run <run>`;
// the harness's PreToolUse hook swaps in that prompt, and its SubagentStart hook binds the agent's id to the run.
// A result counts only through the return tool, whose PreToolUse hook calls accept(): the caller must be the run's
// agent, the result must match the actor's schema, and a claimed PR must be on GitHub at the claimed head. Why it is
// built this way: plan/decisions/2026-10-30-engine-actors.md.
//
// Nothing here imports XState: the harness hook loads this file in a session that may not have it. Handing an
// accepted result to the item (deliver) imports the host only when it is called.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { append, readFile } from '../../journal/src/index.js';
import { check } from './schema.js';
import { prRef } from './effects/merge.js';
import { render, said } from './messages.js';
import { assemble, BLOCKED, blockedOf, contextOf, coverGap, isStage, returnLine, sections, stagesOf, STAMPED } from './stages.js';
import { endRecord, stageRecord } from './trace.js';

// The actors that are agents are the workflow's model stages (stages.js isStage). Others (merge, ask, post) are host
// effects (effects/index.js), and a workflow's name starts a child item.

/** The prompt the session gives the Agent tool to start a run; the hook replaces it with the run's brief. */
export const MARKER = /^\s*ccp-run\s+(\S+)\s*$/;
export const spawnPrompt = (run) => `ccp-run ${run}`;

/** True for the return tool under any plugin prefix: mcp__harness__return, mcp__plugin_ccp-harness_harness__return. */
export const isReturnTool = (name) => /^mcp__(?:plugin_[\w.-]+_)?harness__return$/.test(String(name));

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
// A value serialised with its object keys sorted at every depth, so the return tool's server and accept() hash the
// same result alike whatever order its keys came in (fix-return-tool-answer). return-tool.mjs repeats these lines,
// since it may not import the engine.
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
export const sentHash = (result) => sha256(JSON.stringify(sorted(result ?? null)));

/** A run's id is its effect id, `<item>:<seq>.<invoke>`; its name inside the item is `<seq>.<invoke>`. */
export function runOf(run) {
  const m = String(run ?? '').match(/^(.+):(\d+\.[\w-]+)$/);
  return m ? { item: m[1], name: m[2] } : null;
}

const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');
/** The run's folder: brief, context, binding and result, under the item's own folder in the journal root. */
export const runDir = (root, run) => {
  const r = runOf(run);
  return r && join(root, 'items', safe(r.item), 'runs', safe(r.name));
};
const agentFile = (root, agentId) => join(root, 'actors', 'agents', `${safe(agentId)}.json`);
const spawnFile = (root, toolUseId) => join(root, 'actors', 'spawns', `${safe(toolUseId)}.json`);
const itemFile = (root, item) => join(root, 'items', `${item}.jsonl`);

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};
// Written whole or not at all: a reader never sees half a file.
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.${process.pid}`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${path}.${process.pid}`, path);
};
// Made once: the second writer is refused, so two hooks can't both bind or both accept.
const writeOnce = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
};
const storeBlob = (root, text) => {
  const hash = sha256(text);
  const path = join(root, 'blobs', hash);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return { hash, bytes: Buffer.byteLength(text) };
};

/** The run's record (run.json), or null. */
export const loadRun = (root, run) => {
  const dir = runDir(root, run);
  return dir && readJson(join(dir, 'run.json'));
};

// One journal row about a run, in the item's own file.
function journal(root, run, row) {
  const file = itemFile(root, run.item);
  mkdirSync(dirname(file), { recursive: true });
  return append(file, { session: run.session, release: run.release, item: run.item, state: run.state, agent: null, ...row });
}

// ---- The run handler: the host calls it when a state invokes an agent actor

// A run's prompt is rendered from its stage contract alone (stages.js sections): rules, inputs, task, output and
// return. The run's input named task (a brief another stage wrote, or a literal in the workflow) fills only the Task part.

/**
 * Run handlers for the agent actors, for effects/index.js handlers({ actors }). `host` is the item's host (its root,
 * item, session, release, spec and state); `repo` is the git clone each actor's worktree is added from (its HEAD),
 * `worktrees` the folder they go in. start() prepares the run and returns its outcome: { ref: the run, briefHash,
 * folder, worktree, branch, spawn: { tool, prompt } }. The run stays open until accept() hands back its result.
 */
export function actors({ host, repo = process.cwd(), worktrees = join(dirname(resolve(repo)), 'ccp-actors'), names = stagesOf(host.spec) }) {
  const handler = {
    start: (effect) => prepare({ host, effect, repo, worktrees }),
    // A host that stopped after the start row asks the run folder: prepared means it happened.
    find: (effect) => {
      const run = loadRun(host.root, effect.id);
      return run ? outcomeOf(run) : null;
    },
    // The item took the run's result or error: the stage record gains what came out and where it went.
    ended: (effect, row) => {
      const file = join(runDir(host.root, effect.id), 'stage.json');
      const record = readJson(file);
      if (record && !record.finished) writeJson(file, endRecord(record, host.spec, row, itemRows(host.root, host.item)));
    }
  };
  return Object.fromEntries(names.map((name) => [name, handler]));
}

// The item's journal rows, none before its file exists.
function itemRows(root, item) {
  try {
    return readFile(itemFile(root, item)).rows;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** owner/repo of the clone's origin when it is on GitHub (https or ssh), else null: the run line names it. */
export function githubOf(repo) {
  let url = '';
  try {
    url = execFileSync('git', ['-C', resolve(repo), 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
  return url.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1] ?? null;
}

const outcomeOf = (run) => ({
  ref: run.run,
  briefHash: run.briefHash,
  folder: runDir(run.root, run.run),
  worktree: run.worktree,
  branch: run.branch,
  spawn: { tool: 'Agent', prompt: spawnPrompt(run.run) }
});

// git in a folder, its output trimmed, or null when it fails.
const git = (dir, args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const hasCommit = (repo, sha) => git(repo, ['cat-file', '-e', `${sha}^{commit}`]) != null;

/**
 * Where a rebuild's worktree starts: the previous PR's branch (stamped by accept from GitHub's head.ref) at previous.at,
 * the head the host last saw. A missing commit is fetched from origin (the PR's head and its branch) first. Throws,
 * so the run fails and its item steps back, when the branch is unknown or the commit cannot be found.
 */
export function rebuildStart({ repo, worktrees, previous }) {
  const clone = resolve(repo);
  const { branch, at, url } = previous;
  if (typeof branch !== 'string' || !branch || git(clone, ['check-ref-format', '--branch', branch]) == null) {
    throw new Error(`rebuild-branch: previous PR ${url} has no branch the host saw on GitHub (a fork PR, or not read at accept)`);
  }
  const pr = prRef(url);
  const tracking = `refs/remotes/origin/${branch}`;
  if (!hasCommit(clone, at) || git(clone, ['rev-parse', '--verify', '-q', tracking]) == null) {
    git(clone, ['fetch', '-q', 'origin', `+refs/heads/${branch}:${tracking}`]);
    if (!hasCommit(clone, at)) git(clone, ['fetch', '-q', 'origin', `pull/${pr.pullNumber}/head`]);
  }
  if (!hasCommit(clone, at)) throw new Error(`rebuild-head: previous PR ${url} head ${at} is in neither the clone nor origin`);
  const upstream = git(clone, ['rev-parse', '--verify', '-q', tracking]) != null ? `origin/${branch}` : null;
  return { branch, at, upstream };
}

/**
 * git refuses a branch checked out in another worktree. A finished run's worktree (one in the host's worktrees folder)
 * that holds the branch is detached, its files and commits kept; a branch held anywhere else is not touched: throws.
 */
function freeBranch({ repo, worktrees, branch }) {
  const list = git(resolve(repo), ['worktree', 'list', '--porcelain']) ?? '';
  for (const block of list.split(/\n\n+/)) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    if (!path || !block.split('\n').includes(`branch refs/heads/${branch}`)) continue;
    if (!inside(resolve(worktrees), path) || resolve(path) === resolve(worktrees)) {
      throw new Error(`rebuild-branch: branch ${branch} is checked out at ${path}, outside the host's worktrees; it is left alone`);
    }
    if (git(path, ['checkout', '-q', '--detach']) == null) throw new Error(`rebuild-branch: could not detach ${path} from ${branch}`);
  }
}

/** Write the run's folder, brief and worktree, and journal the brief. Returns the run effect's outcome. */
export function prepare({ host, effect, repo, worktrees }) {
  const { root, item, spec } = host;
  const r = runOf(effect.id);
  if (!r || r.item !== item) throw new Error(`run ${effect.id} is not a run of ${item}`);
  const dir = runDir(root, effect.id);
  const existing = readJson(join(dir, 'run.json'));
  if (existing) return outcomeOf(existing);

  const stage = spec.meta.actors?.[effect.actor];
  if (!isStage(stage)) throw new Error(`${effect.actor} is no stage`);
  // A rebuild (input.previous is a PR ref) works on that PR's branch at its head (fix-rebuild-worktree); any other run
  // gets a fresh branch named by its run, at the clone's HEAD.
  const previous = prRef(effect.input?.previous?.url) ? effect.input.previous : null;
  const start = previous ? rebuildStart({ repo, worktrees, previous }) : { branch: `run/${safe(item)}/${safe(r.name)}`, at: 'HEAD' };
  const { branch } = start;
  const worktree = join(resolve(worktrees), `${safe(item)}--${safe(r.name)}`);
  if (!existsSync(worktree)) {
    mkdirSync(dirname(worktree), { recursive: true });
    if (previous) freeBranch({ repo, worktrees, branch });
    execFileSync('git', ['-C', resolve(repo), 'worktree', 'add', '-q', '-B', branch, worktree, start.at], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (start.upstream) git(worktree, ['branch', '-q', '--set-upstream-to', start.upstream]);
  }
  const run = {
    run: effect.id,
    item,
    name: r.name,
    invoke: effect.invoke,
    actor: effect.actor,
    workflow: spec.id,
    root,
    session: host.session,
    release: host.release,
    state: host.snapshot ? JSON.stringify(host.snapshot.value) : null,
    input: effect.input ?? null,
    schema: stage,
    defs: spec.meta.schemas ?? {},
    repo: resolve(repo),
    github: githubOf(repo),
    worktrees: resolve(worktrees),
    worktree,
    branch
  };
  const parts = sections(run);
  const prompt = assemble(parts);
  run.briefHash = sha256(prompt);
  // The run facts go to the agent once, as its context (SubagentStart, or the first tool call's refusal), not in the prompt.
  const context = contextOf(run);
  run.context = context.text;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'brief.md'), prompt); // file name kept: spawn() and the hook read brief.md
  writeFileSync(join(dir, 'context.md'), run.context);
  const { hash, bytes } = storeBlob(root, prompt);
  journal(root, run, {
    kind: 'brief.stored',
    source: { system: 'journal', ref: `blobs/${hash}` },
    payload: { run: run.run, actor: run.actor, role: run.actor, hash, bytes, contextHash: sha256(run.context), worktree }
  });
  const rows = itemRows(root, item);
  const value = host.snapshot?.value ?? null;
  writeJson(join(dir, 'stage.json'), stageRecord({ spec, run, parts, context, promptHash: run.briefHash, value, rows, transition: effect.transition }));
  writeJson(join(dir, 'run.json'), run);
  return outcomeOf(run);
}

// ---- What the harness hooks call

/**
 * PreToolUse of the Agent tool. A prompt that is not `ccp-run <run>` is not ours: null. Otherwise { allow, prompt }
 * with the brief to start the agent with, or { deny } when the run is unknown or already has its agent.
 */
export function spawn({ root, prompt, toolUseId, session = null }) {
  const m = String(prompt ?? '').match(MARKER);
  if (!m) return null;
  const run = loadRun(root, m[1]);
  if (!run) return { deny: render('unknown-run', { run: m[1] }) };
  const dir = runDir(root, run.run);
  if (existsSync(join(dir, 'failed.json'))) return { deny: render('spawn-already-failed', { run: run.run }) };
  if (existsSync(join(dir, 'agent.json'))) return { deny: render('spawn-already-started', { run: run.run }) };
  if (!writeOnce(join(dir, 'spawn.json'), { toolUseId, session, at: new Date().toISOString() })) {
    return { deny: render('spawn-started-elsewhere', { run: run.run }) };
  }
  writeJson(spawnFile(root, toolUseId), { run: run.run, session });
  return { allow: true, prompt: readFileSync(join(dir, 'brief.md'), 'utf8'), run };
}

/**
 * The Agent call a new agent came from, at SubagentStart. That hook runs before the agent's transcript and meta.json
 * exist (seen on Claude Code 2.1.314), so it can't read the call's id; this finds the session's one started run
 * that has no agent yet. With none, or several (parallel Agent calls), it returns null and the agent is bound at its
 * first tool call instead, from meta.json (bindLate).
 */
export function startedRun({ root, session }) {
  let names = [];
  try {
    names = readdirSync(join(root, 'actors', 'spawns'));
  } catch {
    return null;
  }
  const open = names
    .map((name) => ({ toolUseId: name.replace(/\.json$/, ''), pointer: readJson(join(root, 'actors', 'spawns', name)) }))
    .filter(({ pointer }) => pointer && pointer.session === session && pointer.run)
    .filter(({ pointer }) => !existsSync(join(runDir(root, pointer.run), 'agent.json')));
  return open.length === 1 ? open[0].toolUseId : null;
}

/**
 * Bind an agent to the run its Agent call (toolUseId) started. Journals agent.spawn and returns { run, context }
 * (what the agent is told besides its brief), or null when that call started no run or the run has its agent.
 * `via` says how the call was found: `start` (startedRun) or `meta` (the agent's meta.json, exact).
 */
export function bind({ root, agentId, toolUseId, agentType = null, session = null, via = 'meta' }) {
  if (!agentId || !toolUseId) return null;
  const pointer = readJson(spawnFile(root, toolUseId));
  const run = pointer && loadRun(root, pointer.run);
  if (!run) return null;
  const dir = runDir(root, run.run);
  if (!writeOnce(join(dir, 'agent.json'), { agentId, toolUseId, via, at: new Date().toISOString() })) return null;
  // item and state: what capture tags the agent's own rows with (plan item engine-item-views).
  writeJson(agentFile(root, agentId), { run: run.run, item: run.item, state: run.state, worktree: run.worktree, toolUseId, verified: via === 'meta' });
  journal(root, run, {
    kind: 'agent.spawn',
    source: { system: 'claude-code', ref: toolUseId },
    agent: agentId,
    payload: { agentId, type: agentType, run: run.run, actor: run.actor, briefHash: run.briefHash, worktree: run.worktree, via, hookSession: session }
  });
  return { run, context: run.context };
}

/**
 * At a subagent's tool call, once its meta.json names the Agent call that started it (`metaToolUseId`): an agent
 * bound at SubagentStart is checked against it, and an agent that should have been bound and wasn't is bound now.
 * Returns null (nothing to do), { bound: { run, context } } (bound just now: tell it its run) or { deny } when the
 * agent was bound to another call's run.
 */
export function bindLate({ root, agentId, metaToolUseId, agentType = null, session = null }) {
  if (!agentId || !metaToolUseId) return null;
  const known = readJson(agentFile(root, agentId));
  if (known) {
    if (known.verified) return null;
    if (known.toolUseId !== metaToolUseId) {
      return { deny: render('bind-mismatch', { agent: String(agentId), call: String(metaToolUseId), run: String(known.run), boundCall: String(known.toolUseId) }) };
    }
    writeJson(agentFile(root, agentId), { ...known, verified: true });
    return null;
  }
  const got = bind({ root, agentId, toolUseId: metaToolUseId, agentType, session, via: 'meta' });
  return got ? { bound: got } : null;
}

/** The deny that tells an agent bound only at its first tool call its run (the call did not run). */
export const boundText = (context) => render('bound', { context: String(context) });

/** The run an agent was bound to, or null: { run, item, state, worktree }. */
export const boundRun = (root, agentId) => (agentId ? readJson(agentFile(root, agentId)) : null);

const FILE_TOOLS = { Read: 'file_path', Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const SEARCH_TOOLS = { Glob: 'path', Grep: 'path', LS: 'path' };
const inside = (dir, path) => {
  const rel = relative(dir, resolve(dir, path));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/**
 * PreToolUse of a bound agent's tool: keep it in its worktree. Returns null (leave the call alone), { input } (run it
 * with this input instead) or { deny }. Shell commands run in a subshell that starts in the worktree; file tools
 * outside it are refused; a search with no path searches the worktree.
 */
export function confine({ worktree, tool, input }) {
  if (tool === 'Bash' && typeof input?.command === 'string') {
    const prefix = `( cd ${quote(worktree)} || exit 1\n`;
    if (input.command.startsWith(prefix)) return null;
    return { input: { ...input, command: `${prefix}${input.command}\n)` } };
  }
  if (FILE_TOOLS[tool]) {
    const path = input?.[FILE_TOOLS[tool]];
    if (typeof path === 'string' && !inside(worktree, path)) return { deny: render('own-folder', { tool: String(tool), path, worktree: String(worktree) }) };
    return null;
  }
  if (SEARCH_TOOLS[tool]) {
    const path = input?.[SEARCH_TOOLS[tool]];
    if (path == null || path === '') return { input: { ...input, [SEARCH_TOOLS[tool]]: worktree } };
    if (!inside(worktree, path)) return { deny: render('own-folder', { tool: String(tool), path, worktree: String(worktree) }) };
  }
  return null;
}

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Whether a restated value agrees with the input it restates (fix-verify-issue-echo): an object may leave out keys,
 * and every key it carries must agree with the input's, at any depth; arrays and other values must be equal. The
 * schema's required list says what must be carried. Key order does not matter.
 */
export function agrees(given, input) {
  if (plain(given) && plain(input)) {
    return Object.keys(given).every((k) => Object.hasOwn(input, k) && agrees(given[k], input[k]));
  }
  if (Array.isArray(given) && Array.isArray(input)) {
    return given.length === input.length && given.every((v, i) => agrees(v, input[i]) && agrees(input[i], v));
  }
  return JSON.stringify(given) === JSON.stringify(input);
}

// A value as a refusal shows it: JSON, cut to CUT characters (fix-refusal-hints).
const CUT = 200;
const brief = (v) => {
  const t = JSON.stringify(v) ?? 'undefined';
  return t.length > CUT ? `${t.slice(0, CUT)}…` : t;
};

/**
 * Where a restated value disagrees with its input, as agrees() decides it: every differing path, with the returned
 * value and the input's (fix-refusal-hints). A key the input lacks is named as not in the input; arrays of different
 * length are named whole.
 */
export function differences(given, input, path, inPath) {
  if (plain(given) && plain(input)) {
    return Object.keys(given).flatMap((k) =>
      Object.hasOwn(input, k) ? differences(given[k], input[k], `${path}.${k}`, `${inPath}.${k}`) : [render('difference-not-in-input', { path: `${path}.${k}`, inPath: String(inPath) })]
    );
  }
  if (Array.isArray(given) && Array.isArray(input) && given.length === input.length) {
    return given.flatMap((v, i) => differences(v, input[i], `${path}[${i}]`, `${inPath}[${i}]`));
  }
  if (agrees(given, input)) return [];
  return [render('difference', { path: String(path), given: brief(given), inPath: String(inPath), input: brief(input) })];
}

/** The refusals of a result that count toward a run's cap, and the cap (fix-refusal-hints). */
export const RESULT_RULES = Object.freeze(['schema', 'reserved', 'restated', 'covers', 'ref']);
export const REFUSAL_CAP = 10;

// How to fix a refusal: `<field>: <description>` for each top-level output field the reason names, once each, in the
// schema's order. Only top-level fields carry descriptions (prompts.js puts each ## Output line there).
// The journal keeps each as `<field>: <description>`; the deny shows each as a refusal-hint line (refusalText).
function hintOf(schema, reason) {
  const named = new Set([...String(reason).matchAll(/\bresult\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  return Object.entries(schema?.properties ?? {})
    .filter(([k, s]) => named.has(k) && typeof s?.description === 'string' && s.description.trim())
    .map(([k, s]) => `${k}: ${s.description}`);
}

// The result refusals already journalled for a run, oldest first.
function resultRefusals(root, run) {
  let rows = [];
  try {
    rows = readFile(itemFile(root, run.item)).rows;
  } catch {
    return [];
  }
  return rows.filter((r) => r.kind === 'refusal' && r.payload?.run === run.run && r.payload?.outcome === 'denied' && RESULT_RULES.includes(r.payload?.rule));
}

/**
 * The checks a result passes before it counts, in order: the run exists, the caller is the agent the run started,
 * the run hasn't returned yet, the result matches the actor's schema, and every PR it claims is on GitHub at the
 * claimed head. `github` is a client from effects/github.js ({ pull }). Returns { accepted: { run, hash } } or
 * { refused: { rule, reason } }; both are journalled in the item's file. A refusal of the result (RESULT_RULES) also
 * has fix: { hint, count, cap }, and the one that reaches REFUSAL_CAP has failed: the run, which has then failed.
 */
export async function accept({ root, caller, run: runId, result, toolUseId, github, web = null, session = null }) {
  const run = loadRun(root, runId);
  if (!run) return { refused: { rule: 'unknown-run', reason: render('accept-unknown-run', { run: JSON.stringify(runId ?? null) }) } };
  // A refusal of the result (RESULT_RULES) carries how to fix it and counts toward the run's cap; the one that reaches
  // the cap fails the run, so its item takes the invoke's error instead of the agent looping (fix-refusal-hints).
  // `told` is a catalogue render with what to record (messages.js said): the row keeps its entry and slot values.
  const refuse = (rule, told) => {
    const { text: reason, message } = told;
    const counted = RESULT_RULES.includes(rule);
    const before = counted ? resultRefusals(root, run) : [];
    const extra = counted ? { hint: hintOf(run.schema, reason), count: before.length + 1, cap: REFUSAL_CAP } : {};
    journal(root, run, {
      kind: 'refusal',
      source: { system: 'hook', ref: toolUseId ?? `return ${run.run}` },
      agent: caller ?? null,
      payload: { source: 'hook', rule, reason, message, ...extra, run: run.run, actor: run.actor, caller: caller ?? null, tool: 'harness return', textHash: sha256(`${rule}: ${reason}`), outcome: 'denied', hookSession: session }
    });
    const fix = counted ? { fix: extra } : {};
    if (!counted || extra.count < REFUSAL_CAP) return { refused: { rule, reason }, ...fix };
    const list = [...before.map((r) => r.payload), { rule, reason }].map((r, i) => render('refusal-cap-item', { n: i + 1, rule: String(r.rule), reason: String(r.reason) }));
    const capped = said('refusal-cap', { cap: REFUSAL_CAP, list: list.join(' ') });
    const why = capped.text;
    if (!writeOnce(join(runDir(root, run.run), 'failed.json'), { agentId: caller ?? null, why, at: new Date().toISOString() })) return { refused: { rule, reason }, ...fix };
    journal(root, run, {
      kind: 'refusal',
      source: { system: 'hook', ref: toolUseId ?? `return ${run.run}` },
      agent: caller ?? null,
      payload: { source: 'hook', rule: 'refusal-cap', reason: why, message: capped.message, run: run.run, actor: run.actor, caller: caller ?? null, tool: 'harness return', textHash: sha256(`refusal-cap: ${why}`), outcome: 'failed', hookSession: session }
    });
    return { refused: { rule, reason }, ...fix, failed: run.run };
  };

  const dir = runDir(root, run.run);
  const bound = readJson(join(dir, 'agent.json'));
  if (!bound) return refuse('wrong-caller', said('wrong-caller-unbound', { run: run.run }));
  if (!caller) return refuse('wrong-caller', said('wrong-caller-main', { run: run.run, agent: String(bound.agentId) }));
  if (caller !== bound.agentId) return refuse('wrong-caller', said('wrong-caller-agent', { caller: String(caller), run: run.run, agent: String(bound.agentId) }));
  if (existsSync(join(dir, 'result.json'))) return refuse('already-returned', said('already-returned', { run: run.run }));
  if (existsSync(join(dir, 'failed.json'))) {
    const why = readJson(join(dir, 'failed.json'))?.why ?? '';
    return refuse('already-failed', why.startsWith('refused') ? said('already-failed-refused', { run: run.run, cap: REFUSAL_CAP }) : said('already-failed-stopped', { run: run.run }));
  }

  const problems = check(run.schema, result, run.defs);
  if (problems.length) return refuse('schema', said('schema', { actor: run.actor, problems: problems.join('; ').replaceAll('$', 'result') }));

  // Design A, 4.1: refs observed, restated inputs equal, stamped fields reserved. Only the stamped result is stored.
  const refs = refsIn(result);
  for (const { path, ref } of refs) {
    const taken = STAMPED.filter((k) => k in ref);
    if (taken.length) return refuse('reserved', said('reserved', { path, fields: taken.join(', ') }));
  }
  for (const k of Object.keys(result ?? {})) {
    if (run.input && Object.hasOwn(run.input, k) && !agrees(result[k], run.input[k])) {
      const where = differences(result[k], run.input[k], `result.${k}`, k).join('; ');
      return refuse('restated', said('restated', { field: k, differences: where }));
    }
  }
  // A blocked result (the stage's "could not") covers nothing: it becomes the stage's error (resultsOf).
  const gap = blockedOf(run.schema, result) == null ? coverGap(run.schema, run.input, result) : null;
  if (gap) return refuse('covers', gap);
  const stamped = structuredClone(result);
  for (const { path, ref } of refsIn(stamped)) {
    const pr = prRef(ref.url);
    if (pr) {
      let now;
      try {
        now = await github.pull(pr);
      } catch (error) {
        return refuse('ref', error.status === 404 ? said('ref-no-pr', { path, url: ref.url }) : said('ref-unreadable', { path, url: ref.url, error: String(error.message) }));
      }
      if (now?.head?.sha !== ref.at) return refuse('ref', said('ref-head', { path, url: ref.url, sha: String(now?.head?.sha ?? 'none'), at: ref.at }));
      let head = null;
      try {
        head = execFileSync('git', ['-C', run.worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        head = 'unreadable';
      }
      if (head !== ref.at) return refuse('ref', said('ref-worktree', { path, head, at: ref.at }));
      ref.key = `${pr.owner}/${pr.repo}#${pr.pullNumber}`;
      // The PR's branch, for a rebuild's worktree (fix-rebuild-worktree): only when the head is in the PR's own
      // repository, since a fork's branch is not on origin. GitHub gives head.repo null when the fork is gone.
      const from = now?.head?.repo;
      const own = from === undefined || (typeof from?.full_name === 'string' && from.full_name.toLowerCase() === `${pr.owner}/${pr.repo}`.toLowerCase());
      if (own && typeof now?.head?.ref === 'string' && now.head.ref) ref.branch = now.head.ref;
      // The exact commands that put this head in a worktree (judge's round-1 graft from lane A): host-filled data.
      ref.checkout = `git fetch origin pull/${pr.pullNumber}/head && git checkout --detach ${ref.at}`;
      // Fails closed (round 2, graft from lane B): when the files cannot all be listed, the gates are unknown, and an
      // unknown gate is a touched gate, so the person's CI-change card is asked.
      let files = null;
      let unlisted = null;
      try {
        files = await github.files(pr);
      } catch (error) {
        unlisted = `GitHub could not list the PR's files (${error.message})`;
      }
      if (!unlisted && !Array.isArray(files)) unlisted = 'GitHub gave no file list';
      if (!unlisted && files.length >= FILES_PAGE) unlisted = `the PR has ${FILES_PAGE} or more files, more than one page`;
      const gates = unlisted
        ? [`(unknown: ${unlisted})`]
        : files.map((f) => f.filename).filter((f) => typeof f === 'string' && f.startsWith('.github/'));
      if (gates.length) ref.gates = gates;
      const suites = (await github.suites({ owner: pr.owner, repo: pr.repo, sha: ref.at }))?.check_suites ?? [];
      if (suites.length && suites.every((x) => x.status === 'completed' && GREEN.includes(x.conclusion))) ref.green = true;
    } else {
      let page = null;
      try {
        page = await web.get(ref.url);
      } catch (error) {
        page = { status: 0, body: String(error?.message ?? error) };
      }
      const flat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
      if (!(page?.status >= 200 && page?.status <= 299) || !flat(page.body).includes(flat(ref.at))) {
        return refuse('ref', said('ref-page', { path, url: ref.url }));
      }
    }
  }

  const text = JSON.stringify(stamped);
  const { hash, bytes } = storeBlob(root, text);
  // sent is the result as the agent sent it, before the stamp: the return tool's server matches its call by it.
  if (!writeOnce(join(dir, 'result.json'), { result: stamped, hash, sent: sentHash(result), caller, toolUseId, at: new Date().toISOString() })) {
    return refuse('already-returned', said('already-returned', { run: run.run }));
  }
  journal(root, run, {
    kind: 'result.stored',
    source: { system: 'journal', ref: `blobs/${hash}` },
    agent: caller,
    payload: { run: run.run, actor: run.actor, agentId: caller, hash, bytes, toolUseId: toolUseId ?? null }
  });
  // A brief actor's briefs are fixed here, before any build starts: the verifier later gets this text exactly.
  if (run.actor === 'brief') {
    for (const [role, brief] of Object.entries(result)) {
      if (typeof brief !== 'string') continue;
      const b = storeBlob(root, brief);
      journal(root, run, { kind: 'brief.stored', source: { system: 'journal', ref: `blobs/${b.hash}` }, payload: { run: run.run, actor: run.actor, role, hash: b.hash, bytes: b.bytes } });
    }
  }
  return { accepted: { run: run.run, hash } };
}

/**
 * The text an agent sees for a refused return (fix-refusal-hints): `<rule>: <reason>`, then for a result refusal how
 * to fix it, from the run's Output, and which refusal of the cap this is; at the cap, that the run has failed.
 */
export function refusalText({ refused, fix = null, failed = null }) {
  const said = { rule: String(refused.rule), reason: String(refused.reason) };
  if (!fix) return failed ? render('refusal-failed', { ...said, cap: REFUSAL_CAP, run: String(failed) }) : render('refusal', said);
  const counted = { ...said, count: fix.count, cap: fix.cap };
  // Each hint is `<field>: <description>` as the journal keeps it (hintOf).
  const hints = (fix.hint ?? []).map((h) => {
    const at = h.indexOf(': ');
    return render('refusal-hint', { field: h.slice(0, at), description: h.slice(at + 2) });
  }).join('\n');
  if (failed) return hints ? render('refusal-last-hints', { ...counted, hints, run: String(failed) }) : render('refusal-last', { ...counted, run: String(failed) });
  return hints ? render('refusal-counted-hints', { ...counted, hints }) : render('refusal-counted', counted);
}

// Every ref { url, at } in a value, depth-first, with its path (design A, 4.1). STAMPED (stages.js): the fields the
// host stamps on a PR ref.
const FILES_PAGE = 100; // github.files asks for one page of 100
const GREEN = ['success', 'neutral', 'skipped'];
function refsIn(value, path = 'result') {
  if (!value || typeof value !== 'object') return [];
  const here = typeof value.url === 'string' && typeof value.at === 'string' ? [{ path, ref: value }] : [];
  return [...here, ...Object.entries(value).flatMap(([k, v]) => refsIn(v, `${path}.${k}`))];
}

// An agent ending with its run still open (plan item engine-actor-returns) is sent back once to call the return tool;
// the next time it ends, its run fails, so the item gets the actor's error instead of waiting forever. An agent ends
// in two ways, and both are watched: the SubagentHandback tool (PreToolUse, handback()) and a plain stop (SubagentStop,
// stopped()). A block at SubagentStop does not re-prompt an agent that already handed back (seen in the verifier's
// scratch run ar2, 2026-10-31), so such a stop fails the run at once.
const sentBackFile = (dir) => join(dir, 'sent-back.json');

// The bound agent's open run and its folder, or null when the agent is no actor or its run returned or failed.
function openRunOf(root, agentId) {
  const bound = boundRun(root, agentId);
  const run = bound && loadRun(root, bound.run);
  if (!run) return null;
  const dir = runDir(root, run.run);
  if (existsSync(join(dir, 'result.json')) || existsSync(join(dir, 'failed.json'))) return null;
  return { run, dir };
}

// Sends the run's agent back the first time it ends; true when it had already been sent back.
function sentBackBefore(dir, agentId, how) {
  return !writeOnce(sentBackFile(dir), { agentId, how, at: new Date().toISOString() });
}

// The send-back message is journalled word for word with its hash (critique fix 12, grafted from lane M).
function sentBack(root, run, agentId, tool, { text, message }, session) {
  journal(root, run, {
    kind: 'refusal',
    source: { system: 'hook', ref: `stop ${agentId}` },
    agent: agentId,
    payload: { source: 'hook', rule: 'sent-back', reason: text, message, run: run.run, actor: run.actor, caller: agentId, tool, textHash: sha256(text), outcome: 'sent-back', hookSession: session }
  });
  return text;
}

function fail(root, { run, dir }, agentId, how, session) {
  const { text: why, message } = said(how === 'SubagentStop, after a handback' ? 'no-return-after-handback' : 'no-return', { how });
  if (!writeOnce(join(dir, 'failed.json'), { agentId, why, at: new Date().toISOString() })) return null;
  journal(root, run, {
    kind: 'refusal',
    source: { system: 'hook', ref: `stop ${agentId}` },
    agent: agentId,
    payload: { source: 'hook', rule: 'no-return', reason: why, message, run: run.run, actor: run.actor, caller: agentId, tool: how.startsWith('SubagentStop') ? 'SubagentStop' : 'SubagentHandback', textHash: sha256(`no-return: ${why}`), outcome: 'denied', hookSession: session }
  });
  return { failed: run.run };
}

/**
 * PreToolUse of SubagentHandback by an agent: null (no actor, or its result is in), { deny: reason } the first time
 * its run is open, or { failed: run } the next time; the handback then goes through.
 */
export function handback({ root, agentId, session = null }) {
  const open = openRunOf(root, agentId);
  if (!open) return null;
  if (!sentBackBefore(open.dir, agentId, 'SubagentHandback')) {
    return { deny: sentBack(root, open.run, agentId, 'SubagentHandback', said('sent-back-handback', { returnLine: returnLine(open.run.run) }), session) };
  }
  return fail(root, open, agentId, 'SubagentHandback', session);
}

/**
 * SubagentStop of an agent: null (no actor, or its run returned or failed), { block: reason } the first time its run
 * is open, or { failed: run }. `again` is the hook input's stop_hook_active; `handedBack` is true when the agent's
 * transcript ends in its SubagentHandback result, when a block would not bring it back.
 */
export function stopped({ root, agentId, again = false, handedBack = false, session = null }) {
  const open = openRunOf(root, agentId);
  if (!open) return null;
  if (handedBack) return fail(root, open, agentId, 'SubagentStop, after a handback', session);
  if (!again && !sentBackBefore(open.dir, agentId, 'SubagentStop')) return { block: sentBack(root, open.run, agentId, 'SubagentStop', said('return-line', { run: open.run.run }), session) };
  return fail(root, open, agentId, 'SubagentStop', session);
}

/**
 * The accepted results of an item's open runs, as host inputs: the actor's done event with the result as output.
 * The source is the return call that the checks accepted. A run whose actor stopped without returning (stopped())
 * gives the actor's error event instead, its source the agent's stop. A host offers these on any wake; deliver()
 * offers them at once.
 */
export function resultsOf(host) {
  const inputs = [];
  for (const run of host.runs.values()) {
    if (!isStage(host.spec.meta.actors?.[run.actor])) continue;
    const got = readJson(join(runDir(host.root, run.id), 'result.json'));
    const failed = !got && readJson(join(runDir(host.root, run.id), 'failed.json'));
    if (failed) {
      inputs.push({ event: { type: `xstate.error.actor.${run.invoke}`, error: failed.why }, run: run.id, source: { system: 'harness', ref: `stop ${failed.agentId}` } });
      continue;
    }
    if (!got) continue;
    // The stage's "could not" (stages.js BLOCKED): the actor's error, so the invoke's onError takes it like a stop.
    // The event also carries the reason as `blocked`, so a chart can route a block apart from other errors by a guard
    // on event.blocked (plan item fix-blocked-retry); `error` keeps the same text for every other onError.
    const blocked = blockedOf(host.spec.meta.actors[run.actor], got.result);
    if (blocked != null) {
      inputs.push({ event: { type: `xstate.error.actor.${run.invoke}`, error: `${run.actor} blocked: ${blocked}`, [BLOCKED]: blocked }, run: run.id, source: { system: 'harness', ref: `return ${got.toolUseId ?? got.hash}` } });
      continue;
    }
    inputs.push({
      event: { type: `xstate.done.actor.${run.invoke}`, output: got.result },
      run: run.id,
      source: { system: 'harness', ref: `return ${got.toolUseId ?? got.hash}` }
    });
  }
  return inputs;
}

/**
 * Hand an accepted result to its item: restore the item as its owner, offer the results, and prepare the runs the
 * next state invokes. Imports the host (and XState) only here. Returns the offer's results and the runs now waiting
 * for their agent, or { error } when the host can't be loaded or the item refuses.
 */
export async function deliver({ root, run: runId, github = null, workflow = null }) {
  const run = loadRun(root, runId);
  if (!run) return { error: `no prepared run ${runId}` };
  const { repo, worktrees } = run;
  try {
    const [{ restore, offer }, { handlers }, { loadWorkflow }] = await Promise.all([import('./host.js'), import('./effects/index.js'), import('./index.js')]);
    const spec = workflow ?? loadWorkflow(run.workflow, { root });
    const host = restore({ root, item: run.item, spec, session: run.session, release: run.release });
    host.session = host.owner ?? run.session;
    const results = await offer(host, resultsOf(host), handlers({ github, actors: actors({ host, repo, worktrees }) }));
    return { results: results.map(({ outcome, row }) => ({ outcome, reason: row.payload.reason })), state: host.snapshot?.value ?? null, waiting: waiting(root, run.item) };
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}

// The run records of an item prepared, not started and not failed.
function waitingRecords(root, item) {
  const dir = join(root, 'items', safe(item), 'runs');
  let names = [];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return [];
  }
  return names
    .map((name) => join(dir, name))
    .filter((d) => existsSync(join(d, 'run.json')) && !existsSync(join(d, 'spawn.json')) && !existsSync(join(d, 'failed.json')))
    .map((d) => readJson(join(d, 'run.json')))
    .filter(Boolean);
}

/** The runs of an item prepared and not yet started (a failed run is not): { run, prompt } for the session's Agent call. */
export function waiting(root, item) {
  return waitingRecords(root, item).map((run) => ({ run: run.run, actor: run.actor, prompt: spawnPrompt(run.run) }));
}

// ---- The stall guard (plan item fix-waiting-run-stall)
//
// A Stop of the session that owns an item, with one of the item's runs prepared and no agent, is blocked with the
// exact Agent call to make. Claude Code's stop_hook_active only marks a stop that follows a block, so the guard keeps
// its own count: the stall rows for the run in the item's file. STALL_CAP blocks per run; the stop after that fails
// the run, so the item takes the invoke's error (in quick-fix, replanning, where a card is in front of the person).
// A session that cannot start a run says why with the Agent prompt `ccp-cannot-start <run>: <why>`, which fails it.
// plan/decisions/2026-11-05-waiting-run-stall.md.

export const STALL_CAP = 2;
export const CANNOT_START = /^\s*ccp-cannot-start\s+(\S+:\d+\.[\w-]+):\s*(\S[\s\S]*?)\s*$/;
export const cannotStartPrompt = (run, why = '<why>') => `ccp-cannot-start ${run}: ${why}`;

// The run records, across all items, prepared, not started and not failed, whose owner is one of `sessions`.
function ownedRecords(root, sessions) {
  const owners = new Set(sessions.filter(Boolean));
  let items = [];
  try {
    items = readdirSync(join(root, 'items'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return [];
  }
  return items.flatMap((item) => waitingRecords(root, item)).filter((run) => owners.has(run.session));
}

/**
 * The runs, across all items, prepared, not started and not failed, whose item is owned by one of `sessions` (the
 * session's id and its sessionName): { run, actor, prompt, item }, by item then run. The runs the Stop guard checks,
 * and the ones the hook names after a wake or an Agent call (plan item fix-waiting-lines-owner).
 */
export function ownedWaiting(root, sessions) {
  return ownedRecords(root, sessions).map((run) => ({ run: run.run, actor: run.actor, prompt: spawnPrompt(run.run), item: run.item }));
}

/** What the hook adds after an Agent call or a wake while runs of the session's own items wait (ownedWaiting). */
export const waitingText = (runs) =>
  render('waiting', { lines: runs.map((r) => render('waiting-line', { actor: String(r.actor), run: String(r.run), prompt: String(r.prompt) })).join('\n') });

const stallRows = (root, run) => itemRows(root, run.item).filter((r) => r.kind === 'refusal' && r.payload?.run === run.run && r.payload?.rule === 'stall');
const stateOf = (run) => {
  try {
    return JSON.stringify(JSON.parse(run.state));
  } catch {
    return String(run.state);
  }
};

// Fails a run that has no agent: failed.json, then a refusal row with the rule. False when it had already failed.
function failUnstarted(root, run, rule, { text: why, message }, tool, session) {
  if (!writeOnce(join(runDir(root, run.run), 'failed.json'), { agentId: null, why, at: new Date().toISOString() })) return false;
  journal(root, run, {
    kind: 'refusal',
    source: { system: 'hook', ref: `${tool} ${run.run}` },
    payload: { source: 'hook', rule, reason: why, message, run: run.run, actor: run.actor, caller: null, tool, textHash: sha256(`${rule}: ${why}`), outcome: 'failed', hookSession: session }
  });
  return true;
}

/** The block reason for a waiting run: what is waiting, the exact call, which block this is, and the way out. */
export const stallText = (run, count) => stallSaid(run, count).text;
const stallSaid = (run, count) => said('stall', {
  item: String(run.item), state: stateOf(run), run: String(run.run), actor: String(run.actor),
  prompt: spawnPrompt(run.run), cannotStart: cannotStartPrompt(run.run), count, cap: STALL_CAP
});

/**
 * A Stop of the main session. `sessions` are the names the session may own items under (its session_id and its
 * sessionName). Null with no run of its own waiting; else { block, failed }: runs already blocked STALL_CAP times
 * fail now (failed), and the first run blocked fewer times is blocked (block, its reason; null when none is left).
 */
export function stall({ root, sessions, session = null }) {
  const runs = ownedRecords(root, sessions);
  if (!runs.length) return null;
  const failed = [];
  let block = null;
  for (const run of runs) {
    const count = stallRows(root, run).length;
    if (count >= STALL_CAP) {
      const why = said('stall-cap', { turns: STALL_CAP + 1, run: String(run.run), cap: STALL_CAP });
      if (failUnstarted(root, run, 'stall-cap', why, 'Stop', session)) failed.push(run.run);
      continue;
    }
    if (block) continue;
    const told = stallSaid(run, count + 1);
    block = told.text;
    journal(root, run, {
      kind: 'refusal',
      source: { system: 'hook', ref: `Stop ${run.run}` },
      payload: { source: 'hook', rule: 'stall', reason: block, message: told.message, count: count + 1, cap: STALL_CAP, run: run.run, actor: run.actor, caller: null, tool: 'Stop', textHash: sha256(block), outcome: 'blocked', hookSession: session }
    });
  }
  return { block, failed };
}

/**
 * PreToolUse of the Agent tool with the prompt `ccp-cannot-start <run>: <why>`. Null for any other prompt; else
 * { deny } (the call never starts an agent), with failed: the run when it was failed now. Only a session the run's
 * item is owned by may fail it.
 */
export function cannotStart({ root, prompt, sessions, session = null }) {
  if (!/^\s*ccp-cannot-start\b/.test(String(prompt ?? ''))) return null;
  const m = String(prompt).match(CANNOT_START);
  if (!m || m[2] === '<why>') return { deny: render('cannot-start-no-reason', { prompt: cannotStartPrompt('<run>') }) };
  const [, id, why] = m;
  const run = loadRun(root, id);
  if (!run) return { deny: render('unknown-run', { run: id }) };
  if (!sessions.filter(Boolean).includes(run.session)) return { deny: render('cannot-start-wrong-session', { run: run.run, owner: String(run.session) }) };
  const dir = runDir(root, run.run);
  if (existsSync(join(dir, 'failed.json'))) return { deny: render('cannot-start-already-failed', { run: run.run }) };
  if (existsSync(join(dir, 'spawn.json'))) return { deny: render('cannot-start-already-started', { run: run.run }) };
  if (!failUnstarted(root, run, 'cannot-start', said('cannot-start-reason', { why }), 'Agent', session)) return { deny: render('cannot-start-already-failed', { run: run.run }) };
  return { deny: render('cannot-start-done', { run: run.run }), failed: run.run };
}
