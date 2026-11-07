// Invoked actors: the agents a workflow starts, and the one way their results come back.
// When a state invokes a model stage (an actor whose meta.actors entry has stage parts), the host's run handler renders
// the run's prompt from that entry (stages.js) into prompt.md in its own run folder, makes it a git worktree named by item and run,
// journals the prompt's hash, and writes the run's stage record, stage.json (trace.js): every prompt piece and input with
// its source, and, once the item takes the result (the handler's ended), where the output went. The session then starts the agent with the Agent tool and the prompt `ccp-run <run>`;
// the harness's PreToolUse hook swaps in that prompt, and its SubagentStart hook binds the agent's id to the run.
// A result counts only through the return tool, whose PreToolUse hook calls accept(): the caller must be the run's
// agent, the result must match the actor's schema, and a claimed PR must be on GitHub at the claimed head. Why it is
// built this way: plan/decisions/2026-10-30-engine-actors.md.
//
// Nothing here imports XState: the harness hook loads this file in a session that may not have it. Handing an
// accepted result to the item (deliver) imports the host only when it is called.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { prRef } from './effects/merge.js';
import { render } from './messages.js';
import { assemble, BLOCKED, blockedOf, contextOf, isStage, sections, stagesOf } from './stages.js';
import { endRecord, stageRecord } from './trace.js';
import { promptFile, runDir, runOf, sha256 } from './names.js';
import {
  answerOf, boundRun, failureOf, itemRows, journal, loadRun, MARKER, readJson, recordOf, resultOf, spawnPointer,
  spawnPrompt, state, storeBlob, transition, unboundSpawns, verifyBinding, waitingRecords, ownedRecords, writeJson
} from './run/store.js';
import { addWorktree, githubOf, inside } from './run/worktree.js';

// The run's lifecycle and folder are run/store.js's; its worktree run/worktree.js's; accepting its result
// run/accept.js's; supervising an agent or session that doesn't deliver run/supervise.js's. This module prepares,
// starts, binds and confines runs and hands their results to the item, and exports all of them for the harness hooks.
export { MARKER, spawnPrompt, loadRun, boundRun };
export { githubOf, rebuildStart } from './run/worktree.js';
export { accept, agrees, differences, refusalText, REFUSAL_CAP, RESULT_RULES } from './run/accept.js';
export { cannotStart, CANNOT_START, cannotStartPrompt, handback, stall, STALL_CAP, stallText, stopped } from './run/supervise.js';

// The actors that are agents are the workflow's model stages (stages.js isStage). Others (merge, ask, post) are host
// effects (effects/index.js), and a workflow's name starts a child item.

/** True for the return tool under any plugin prefix: mcp__harness__return, mcp__plugin_ccp-harness_harness__return. */
export const isReturnTool = (name) => /^mcp__(?:plugin_[\w.-]+_)?harness__return$/.test(String(name));

// Run ids, file names and the result hash are names.js's, shared with the return tool and the inspector.
export { runOf, runDir, resultHash as sentHash } from './names.js';

// ---- The run handler: the host calls it when a state invokes an agent actor

// A run's prompt is rendered from its stage contract alone (stages.js sections): rules, inputs, task, output and
// return. The run's input named task (a brief another stage wrote, or a literal in the workflow) fills only the Task part.

/**
 * Run handlers for the agent actors, for effects/index.js handlers({ actors }). `host` is the item's host (its root,
 * item, session, release, spec and state); `repo` is the git clone each actor's worktree is added from (its HEAD),
 * `worktrees` the folder they go in. start() prepares the run and returns its outcome: { ref: the run, promptHash,
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

const outcomeOf = (run) => ({
  ref: run.run,
  promptHash: run.promptHash,
  folder: runDir(run.root, run.run),
  worktree: run.worktree,
  branch: run.branch,
  spawn: { tool: 'Agent', prompt: spawnPrompt(run.run) }
});

/** Write the run's folder, prompt and worktree, and journal the prompt. Returns the run effect's outcome. */
export function prepare({ host, effect, repo, worktrees }) {
  const { root, item, spec } = host;
  const r = runOf(effect.id);
  if (!r || r.item !== item) throw new Error(`run ${effect.id} is not a run of ${item}`);
  const existing = recordOf(root, effect.id);
  if (existing) return outcomeOf(existing);

  const stage = spec.meta.actors?.[effect.actor];
  if (!isStage(stage)) throw new Error(`${effect.actor} is no stage`);
  // A rebuild (input.previous is a PR ref) works on that PR's branch at its head; any other run
  // gets a fresh branch named by its run, at the clone's HEAD.
  const previous = prRef(effect.input?.previous?.url) ? effect.input.previous : null;
  const { worktree, branch } = addWorktree({ repo, worktrees, item, name: r.name, previous });
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
  run.promptHash = sha256(prompt);
  // The run facts go to the agent once, as its context (SubagentStart, or the first tool call's refusal), not in the prompt.
  const context = contextOf(run);
  run.context = context.text;
  const dir = runDir(root, effect.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(promptFile(root, run.run), prompt);
  writeFileSync(join(dir, 'context.md'), run.context);
  const { hash, bytes } = storeBlob(root, prompt);
  journal(root, run, {
    kind: 'prompt.stored',
    source: { system: 'journal', ref: `blobs/${hash}` },
    payload: { run: run.run, actor: run.actor, role: run.actor, hash, bytes, contextHash: sha256(run.context), worktree }
  });
  const rows = itemRows(root, item);
  const value = host.snapshot?.value ?? null;
  writeJson(join(dir, 'stage.json'), stageRecord({ spec, run, parts, context, promptHash: run.promptHash, value, rows, transition: effect.transition }));
  transition(root, run, 'prepare', run);
  return outcomeOf(run);
}

// ---- What the harness hooks call

/**
 * PreToolUse of the Agent tool. A prompt that is not `ccp-run <run>` is not ours: null. Otherwise { allow, prompt }
 * with the prompt to start the agent with, or { deny } when the run is unknown or already has its agent.
 */
export function spawn({ root, prompt, toolUseId, session = null }) {
  const m = String(prompt ?? '').match(MARKER);
  if (!m) return null;
  const run = loadRun(root, m[1]);
  if (!run) return { deny: render('unknown-run', { run: m[1] }) };
  const answer = answerOf('spawn', state(root, run));
  if (answer) return { deny: render(answer, { run: run.run }) };
  if (!transition(root, run, 'spawn', { toolUseId, session, at: new Date().toISOString() })) {
    return { deny: render(answerOf('spawn', state(root, run)) ?? 'spawn-started-elsewhere', { run: run.run }) };
  }
  return { allow: true, prompt: readFileSync(promptFile(root, run.run), 'utf8'), run };
}

/**
 * The Agent call a new agent came from, at SubagentStart. That hook runs before the agent's transcript and meta.json
 * exist (seen on Claude Code 2.1.314), so it can't read the call's id; this finds the session's one started run
 * that has no agent yet. With none, or several (parallel Agent calls), it returns null and the agent is bound at its
 * first tool call instead, from meta.json (bindLate).
 */
export function startedRun({ root, session }) {
  const open = unboundSpawns(root).filter((s) => s.session === session);
  return open.length === 1 ? open[0].toolUseId : null;
}

/**
 * Bind an agent to the run its Agent call (toolUseId) started. Journals agent.spawn and returns { run, context }
 * (what the agent is told besides its prompt), or null when that call started no run or the run has its agent.
 * `via` says how the call was found: `start` (startedRun) or `meta` (the agent's meta.json, exact).
 */
export function bind({ root, agentId, toolUseId, agentType = null, session = null, via = 'meta' }) {
  if (!agentId || !toolUseId) return null;
  const pointer = spawnPointer(root, toolUseId);
  const run = pointer && loadRun(root, pointer.run);
  if (!run) return null;
  const bound = transition(root, run, 'bind', { agentId, toolUseId, via, at: new Date().toISOString() }, {
    kind: 'agent.spawn',
    source: { system: 'claude-code', ref: toolUseId },
    agent: agentId,
    payload: { agentId, type: agentType, run: run.run, actor: run.actor, promptHash: run.promptHash, worktree: run.worktree, via, hookSession: session }
  });
  if (!bound) return null;
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
  const known = boundRun(root, agentId);
  if (known) {
    if (known.verified) return null;
    if (known.toolUseId !== metaToolUseId) {
      return { deny: render('bind-mismatch', { agent: String(agentId), call: String(metaToolUseId), run: String(known.run), boundCall: String(known.toolUseId) }) };
    }
    verifyBinding(root, agentId);
    return null;
  }
  const got = bind({ root, agentId, toolUseId: metaToolUseId, agentType, session, via: 'meta' });
  return got ? { bound: got } : null;
}

/** The deny that tells an agent bound only at its first tool call its run (the call did not run). */
export const boundText = (context) => render('bound', { context: String(context) });


const FILE_TOOLS = { Read: 'file_path', Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const SEARCH_TOOLS = { Glob: 'path', Grep: 'path', LS: 'path' };
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
    const got = resultOf(host.root, run.id);
    const failed = !got && failureOf(host.root, run.id);
    if (failed) {
      inputs.push({ event: { type: `xstate.error.actor.${run.invoke}`, error: failed.why }, run: run.id, source: { system: 'harness', ref: `stop ${failed.agentId}` } });
      continue;
    }
    if (!got) continue;
    // The stage's "could not" (stages.js BLOCKED): the actor's error, so the invoke's onError takes it like a stop.
    // The event also carries the reason as `blocked`, so a chart can route a block apart from other errors by a guard
    // on event.blocked; `error` keeps the same text for every other onError.
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

/** The runs of an item prepared and not yet started (a failed run is not): { run, prompt } for the session's Agent call. */
export function waiting(root, item) {
  return waitingRecords(root, item).map((run) => ({ run: run.run, actor: run.actor, prompt: spawnPrompt(run.run) }));
}

/**
 * The runs, across all items, prepared, not started and not failed, whose item is owned by one of `sessions` (the
 * session's id and its sessionName): { run, actor, prompt, item }, by item then run. The runs the Stop guard checks,
 * and the ones the hook names after a wake or an Agent call.
 */
export function ownedWaiting(root, sessions) {
  return ownedRecords(root, sessions).map((run) => ({ run: run.run, actor: run.actor, prompt: spawnPrompt(run.run), item: run.item }));
}

/** What the hook adds after an Agent call or a wake while runs of the session's own items wait (ownedWaiting). */
export const waitingText = (runs) =>
  render('waiting', { lines: runs.map((r) => render('waiting-line', { actor: String(r.actor), run: String(r.run), prompt: String(r.prompt) })).join('\n') });
