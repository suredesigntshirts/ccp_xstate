// The names every harness process must spell alike: how a run id is written and read, how an id becomes a file name,
// where an item's, run's, card's and agent's files sit under a journal root, and how a returned result is hashed.
// The engine, the plugin's hooks and return tool, and the inspector each load this one file, so they cannot drift.
//
// It imports only node: built-ins, so a process that must not load XState (the return tool, the actor hooks in a
// session without it) can load it.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// A value serialised with its object keys sorted at every depth.
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);

/**
 * The hash of a result as an agent sent it, whatever order its keys came in. accept() stores it as `sent` and the
 * return tool's server matches its call by it.
 */
export const resultHash = (result) => sha256(JSON.stringify(sorted(result ?? null)));

/** A run's id is its effect id, `<item>:<seq>.<invoke>`; its name inside the item is `<seq>.<invoke>`. */
export const runId = (item, name) => `${item}:${name}`;

/** { item, name } of a run id, or null when it is not one. */
export function runOf(run) {
  const m = String(run ?? '').match(/^(.+):(\d+\.[\w-]+)$/);
  return m ? { item: m[1], name: m[2] } : null;
}

/** An id as a file or folder name: every character outside letters, digits, dot, underscore and dash becomes `_`. */
export const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

/** The one file an item's journal lives in. Restore reads it by this path and never lists a folder. */
export const itemFile = (root, item) => join(root, 'items', `${item}.jsonl`);
/** A session's own journal file, where it records what it was refused for an item it does not own. */
export const sessionFile = (root, session) => join(root, 'sessions', `${session}.jsonl`);

/** The folder holding an item's run folders. */
export const runsDir = (root, item) => join(root, 'items', safe(item), 'runs');
/** The run's folder: prompt, context, binding and result, under the item's own folder in the journal root. */
export const runDir = (root, run) => {
  const r = runOf(run);
  return r && join(runsDir(root, r.item), safe(r.name));
};

/**
 * The file holding a run's rendered prompt: prompt.md, or brief.md in a folder that has only that one (folders written
 * before journal v2 are kept as they were). Null for a non-run id.
 */
export function promptFile(root, run) {
  const dir = runDir(root, run);
  if (!dir) return null;
  const file = join(dir, 'prompt.md');
  const earlier = join(dir, 'brief.md');
  return !existsSync(file) && existsSync(earlier) ? earlier : file;
}

/** Where the record of an ask run's posted card lives: beside the item's runs, under cards/. Throws for a non-run id. */
export function cardFile(root, run) {
  const r = runOf(run);
  if (!r) throw new Error(`${run} is not a run id`);
  return join(root, 'items', safe(r.item), 'cards', `${safe(r.name)}.json`);
}
/** Where the record that an ask run's card was withdrawn lives: beside the card's record. */
export const closedFile = (root, run) => cardFile(root, run).replace(/\.json$/, '.closed.json');

/** An agent's binding to its run, written when the agent starts. */
export const agentFile = (root, agentId) => join(root, 'actors', 'agents', `${safe(agentId)}.json`);
/** The pointer from an Agent tool call to the run it starts, written when the call is made. */
export const spawnFile = (root, toolUseId) => join(root, 'actors', 'spawns', `${safe(toolUseId)}.json`);
