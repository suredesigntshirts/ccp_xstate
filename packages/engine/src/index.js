// The engine: a workflow file loaded into XState.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFile } from '../../journal/src/index.js';
import { checkStages } from './stages.js';
import { readWorkflow } from './prompts.js';

export { machineOf, failing, get, mapPaths, startRefusal, hashOf, replay } from './spec.js';
export { check } from './schema.js';
export { restore, applyEvent, persist, runEffects, offer, pending, itemFile, sessionFile, OwnedError } from './host.js';
export { wakesIn, inputsOfWake, dueTimers } from './wake.js';
export { actors, accept, deliver, resultsOf, waiting } from './actors.js';
export { stageRecord, producerOf } from './trace.js';
export { tripwiresOf } from './tripwire.js';
export { compose, readWorkflow, parseStageFile, pinBytes, locationOf, hasStageFiles } from './prompts.js';

const REPO_WORKFLOWS = new URL('../../../workflows/', import.meta.url).pathname;
const PINNED = /^(.+)@([0-9a-f]{64})$/;

// The workflows an invoke may start as a child item: the files in the workflow folder, each with its meta.input
// schema, so the load check can hold a child invoke to the inputs the child requires. The load check refuses an invoke
// of anything else that is no stage and no host effect, such as an agent of a workflow pinned before the stage
// contract.
const workflowNames = (dir) => {
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
  } catch {
    return {};
  }
  return Object.fromEntries(names.map((n) => {
    try {
      return [n, JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8')).meta?.input ?? null];
    } catch {
      return [n, null];
    }
  }));
};

/**
 * A workflow by name, or by its pin. `name@<sha256>` reads the pinned bytes from <root>/blobs and checks
 * their hash; when the blob is missing and <dir>/<name>.json (with its stage files) gives exactly those bytes, they are
 * stored from it. A plain name reads <dir ?? repo workflows>/<name>.json and its stage files (prompts.js), stores the
 * bytes it is pinned as under root (when given), and returns the spec with id `<name>@<sha256>`, so every row the item
 * writes names the bytes it runs on. A workflow with stage files is pinned as its composed spec, so its blob alone
 * replays an item; one without is pinned as its file bytes.
 */
export const loadWorkflow = (name, { root = null, dir = null } = {}) => {
  const pinned = String(name).match(PINNED);
  if (pinned) {
    if (!root) throw new Error(`${name} is pinned, and no root was given to read its blob from`);
    const blob = join(root, 'blobs', pinned[2]);
    // A root that never stored the bytes (an item started with a spec loaded without root) still finds them when the
    // workflow file has those exact bytes: the hash is checked below either way, so an edited file is never taken.
    if (!existsSync(blob)) {
      let file = null;
      try {
        file = readWorkflow(pinned[1], { dir: dir ?? REPO_WORKFLOWS }).bytes;
      } catch {
        file = null;
      }
      if (file && createHash('sha256').update(file).digest('hex') === pinned[2]) {
        mkdirSync(join(root, 'blobs'), { recursive: true });
        writeFileSync(blob, file);
      }
    }
    const bytes = readFileSync(blob);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== pinned[2]) throw new Error(`blob ${pinned[2]} hashes to ${hash}`);
    // A pinned workflow's asking states may lack a timer; its items keep running on it as pinned until they finish.
    return checkStages({ ...JSON.parse(bytes.toString('utf8')), id: name }, { workflows: workflowNames(dir ?? REPO_WORKFLOWS), pinned: true });
  }
  const { spec: composed, bytes } = readWorkflow(name, { dir: dir ?? REPO_WORKFLOWS });
  const hash = createHash('sha256').update(bytes).digest('hex');
  // Checked before it is stored: a workflow that would be refused is never pinned.
  const spec = checkStages({ ...composed, id: `${name}@${hash}` }, { workflows: workflowNames(dir ?? REPO_WORKFLOWS) });
  if (root) {
    const path = join(root, 'blobs', hash);
    if (!existsSync(path)) {
      mkdirSync(join(root, 'blobs'), { recursive: true });
      writeFileSync(path, bytes);
    }
  }
  return spec;
};

/** The pinned workflow an item started on (its seq-0 row's payload.workflow), or null when it has not started. */
export const workflowOf = (root, item) => {
  let rows;
  try {
    rows = readFile(join(root, 'items', `${item}.jsonl`)).rows;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const first = rows.find((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && r.payload.seq === 0);
  return first ? loadWorkflow(first.payload.workflow, { root }) : null;
};
