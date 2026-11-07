// The run store: the one owner of a run's folder and of the pointer files that lead to it.
//
// A run has a lifecycle: prepared (run.json written), spawned (its Agent call claimed it, spawn.json), bound (its agent
// is known, agent.json), then returned (result.json) or failed (failed.json). The state is read from which of those
// files the folder holds, so a folder written by any release reads the same. A transition writes its file once, with
// its journal row, and only from the states it leaves from. ANSWERS is what a hook tells its caller when the run is
// not in the state the hook needs: the catalogue entry to render (packages/engine/messages.md).
//
// An agent that isn't delivering spends the run's attempts: refused results, send-backs and stall blocks, each with
// its own limit in BUDGET. run.json counts what was spent; a run.json without the count reads it from the journal.
// Why: plan/decisions/2026-11-07-run-lifecycle-store.md.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { append, readFile } from '../../../journal/src/index.js';
import { agentFile, itemFile, promptFile, runDir, runsDir, sha256, spawnFile } from '../names.js';

/** The prompt the session gives the Agent tool to start a run; the hook replaces it with the run's prompt. */
export const MARKER = /^\s*ccp-run\s+(\S+)\s*$/;
export const spawnPrompt = (run) => `ccp-run ${run}`;

export const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};
// Written whole or not at all: a reader never sees half a file.
export const writeJson = (path, value) => {
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
/** Stores a text under its hash in the journal's blobs: { hash, bytes }. */
export const storeBlob = (root, text) => {
  const hash = sha256(text);
  const path = join(root, 'blobs', hash);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return { hash, bytes: Buffer.byteLength(text) };
};

const idOf = (run) => (typeof run === 'string' ? run : run?.run);
const fileOf = (root, run, name) => {
  const dir = runDir(root, idOf(run));
  return dir ? join(dir, name) : null;
};

/** The run's record (run.json) as written, or null. */
export const recordOf = (root, run) => {
  const file = fileOf(root, run, 'run.json');
  return file && readJson(file);
};

/** The run's record (run.json), or null. */
export const loadRun = (root, run) => {
  const loaded = recordOf(root, run);
  // A run.json without promptHash takes it from the prompt file, so every run reports the hash of the prompt it hands out.
  if (loaded && !loaded.promptHash && existsSync(promptFile(root, run))) loaded.promptHash = sha256(readFileSync(promptFile(root, run), 'utf8'));
  return loaded;
};

/** One journal row about a run, in the item's own file. */
export function journal(root, run, row) {
  const file = itemFile(root, run.item);
  mkdirSync(dirname(file), { recursive: true });
  return append(file, { session: run.session, release: run.release, item: run.item, state: run.state, agent: null, ...row });
}

/** The item's journal rows, none before its file exists. */
export function itemRows(root, item) {
  try {
    return readFile(itemFile(root, item)).rows;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// ---- States and transitions

export const STATES = Object.freeze(['prepared', 'spawned', 'bound', 'returned', 'failed']);

// The file each state adds, in the order state() reads them: a returned result wins over a failure written after it.
const STATE_FILES = [['returned', 'result.json'], ['failed', 'failed.json'], ['bound', 'agent.json'], ['spawned', 'spawn.json']];

/** The run's state from its folder, or null when it was never prepared. */
export function state(root, run) {
  if (!recordOf(root, run)) return null;
  for (const [name, file] of STATE_FILES) if (existsSync(fileOf(root, run, file))) return name;
  return 'prepared';
}

/**
 * What each transition writes and the states it leaves from. send-back leaves the run bound: it records the one time
 * an agent that ended without returning is told to return.
 */
export const TRANSITIONS = Object.freeze({
  prepare: { from: [null], file: 'run.json' },
  spawn: { from: ['prepared'], file: 'spawn.json' },
  bind: { from: ['spawned'], file: 'agent.json' },
  return: { from: ['bound'], file: 'result.json' },
  'send-back': { from: ['bound'], file: 'sent-back.json' },
  fail: { from: ['prepared', 'spawned', 'bound'], file: 'failed.json' }
});

/**
 * Moves a run by a transition: writes its file with `record`, then its journal row (`row`, if any). False, and nothing
 * written, when the run is not in a state the transition leaves from or another writer got there first. A prepare
 * writes the whole record and may rewrite it; every other file is written once.
 */
export function transition(root, run, event, record, row = null) {
  const t = TRANSITIONS[event];
  if (!t) throw new Error(`no run transition ${event}`);
  if (!t.from.includes(state(root, run))) return false;
  const file = fileOf(root, run, t.file);
  if (event === 'prepare') writeJson(file, record);
  else if (!writeOnce(file, record)) return false;
  if (event === 'spawn') writeJson(spawnFile(root, record.toolUseId), { run: idOf(run), session: record.session });
  // item and state: what capture tags the agent's own rows with.
  if (event === 'bind') writeJson(agentFile(root, record.agentId), { run: run.run, item: run.item, state: run.state, worktree: run.worktree, toolUseId: record.toolUseId, verified: record.via === 'meta' });
  if (row) journal(root, run, row);
  return true;
}

/**
 * What a hook answers when the run is not in the state it needs: the catalogue entry, by hook and state. A state a
 * hook does not list is one it acts in. return's failed entry depends on why the run failed.
 */
export const ANSWERS = Object.freeze({
  spawn: { spawned: 'spawn-started-elsewhere', bound: 'spawn-already-started', returned: 'spawn-already-started', failed: 'spawn-already-failed' },
  return: { returned: 'already-returned', failed: (failure) => (String(failure?.why ?? '').startsWith('refused') ? 'already-failed-refused' : 'already-failed-stopped') },
  'cannot-start': { spawned: 'cannot-start-already-started', bound: 'cannot-start-already-started', returned: 'cannot-start-already-started', failed: 'cannot-start-already-failed' }
});

/** The catalogue entry a hook answers with for the run's state, or null when the hook acts in it. */
export function answerOf(hook, current, root = null, run = null) {
  const entry = ANSWERS[hook]?.[current] ?? null;
  return typeof entry === 'function' ? entry(failureOf(root, run)) : entry;
}

/** The run's binding (agent.json): { agentId, toolUseId, via, at }, or null. */
export const bindingOf = (root, run) => readJson(fileOf(root, run, 'agent.json'));
/** The run's stored result (result.json): { result, hash, sent, caller, toolUseId, at }, or null. */
export const resultOf = (root, run) => readJson(fileOf(root, run, 'result.json'));
/** Why the run failed (failed.json): { agentId, why, at }, or null. */
export const failureOf = (root, run) => (run ? readJson(fileOf(root, run, 'failed.json')) : null);

/** The run an Agent call (toolUseId) started: { run, session }, or null. */
export const spawnPointer = (root, toolUseId) => readJson(spawnFile(root, toolUseId));

/** The run an agent was bound to, or null: { run, item, state, worktree, toolUseId, verified }. */
export const boundRun = (root, agentId) => (agentId ? readJson(agentFile(root, agentId)) : null);

/** Marks an agent's binding as checked against its meta.json. */
export const verifyBinding = (root, agentId) => {
  const known = boundRun(root, agentId);
  if (known) writeJson(agentFile(root, agentId), { ...known, verified: true });
};

/** Every Agent call that started a run and whose run has no agent yet: [{ toolUseId, run, session }]. */
export function unboundSpawns(root) {
  let names = [];
  try {
    names = readdirSync(join(root, 'actors', 'spawns'));
  } catch {
    return [];
  }
  return names
    .map((name) => ({ toolUseId: name.replace(/\.json$/, ''), pointer: readJson(join(root, 'actors', 'spawns', name)) }))
    .filter(({ pointer }) => pointer && pointer.run)
    .filter(({ pointer }) => !existsSync(join(runDir(root, pointer.run), 'agent.json')))
    .map(({ toolUseId, pointer }) => ({ toolUseId, run: pointer.run, session: pointer.session }));
}

/** The records of an item's runs prepared, not started and not failed, by run folder name. */
export function waitingRecords(root, item) {
  const dir = runsDir(root, item);
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

/** The waiting run records, across all items, whose owner is one of `sessions`; by item then run. */
export function ownedRecords(root, sessions) {
  const owners = new Set(sessions.filter(Boolean));
  let items = [];
  try {
    items = readdirSync(join(root, 'items'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return [];
  }
  return items.flatMap((item) => waitingRecords(root, item)).filter((run) => owners.has(run.session));
}

// ---- The attempt budget

/**
 * How many of each attempt a run may spend: result refusals (accept), send-backs of an agent that ended without
 * returning (handback, stopped), and Stop blocks of a session that has not started the run (stall).
 */
export const BUDGET = Object.freeze({ refused: 10, sentBack: 1, stalled: 2 });

/** The refusals of a result that count toward the refused budget. */
export const RESULT_RULES = Object.freeze(['schema', 'reserved', 'restated', 'covers', 'ref']);

/** The counted result refusals journalled for a run, oldest first. */
export const resultRefusals = (root, run) =>
  itemRows(root, run.item).filter((r) => r.kind === 'refusal' && r.payload?.run === run.run && r.payload?.outcome === 'denied' && RESULT_RULES.includes(r.payload?.rule));

// What a run.json written without attempts has spent, from the journal and the folder.
const FROM_JOURNAL = {
  refused: (root, run) => resultRefusals(root, run).length,
  sentBack: (root, run) => (existsSync(fileOf(root, run, 'sent-back.json')) ? 1 : 0),
  stalled: (root, run) => itemRows(root, run.item).filter((r) => r.kind === 'refusal' && r.payload?.run === run.run && r.payload?.rule === 'stall').length
};

/** How many attempts of a kind (a BUDGET key) the run has spent. */
export function spent(root, run, kind) {
  if (!(kind in BUDGET)) throw new Error(`no attempt kind ${kind}`);
  const counted = recordOf(root, run)?.attempts?.[kind];
  return Number.isInteger(counted) ? counted : FROM_JOURNAL[kind](root, run);
}

/** Spends one attempt of a kind: run.json's attempts gain it. Returns the count spent, this one included. */
export function spend(root, run, kind) {
  const count = spent(root, run, kind) + 1;
  const record = recordOf(root, run);
  if (record) writeJson(fileOf(root, run, 'run.json'), { ...record, attempts: { ...record.attempts, [kind]: count } });
  return count;
}
