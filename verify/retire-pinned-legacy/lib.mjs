// Verifier's helpers for plan item retire-pinned-legacy, written from the item's Expect lines and the engine's
// exports; the builder's tests (packages/engine/test/retired.test.js) are not read or used. RPL_REPO names the
// checkout whose engine runs (default: this repo), so the same code runs at the PR's head and at main.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.RPL_REPO ?? join(HERE, '..', '..'));
export const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

const imp = (p) => import(pathToFileURL(join(REPO, p)).href);
export async function engine() {
  const [index, host, actors, prompts] = await Promise.all([
    imp('packages/engine/src/index.js'), imp('packages/engine/src/host.js'),
    imp('packages/engine/src/actors.js'), imp('packages/engine/src/prompts.js')
  ]);
  return { index, host, actors, prompts };
}

export const rows = (file) => {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};
export const applied = (file) => rows(file).filter((r) => r.kind === 'engine.transition' && r.payload?.outcome === 'applied');
export const effectRows = (file) => rows(file).filter((r) => r.kind === 'engine.effect');
export const pinOf = (file) => applied(file).find((r) => r.payload.seq === 0)?.payload?.workflow ?? null;

export const tempDir = (tag) => mkdtempSync(join(tmpdir(), `rpl-${tag}-`));

/** The adopt trial's journal root copied to a temp folder; with `beforeSeq`, its item file cut before that applied seq. */
export function adoptCopy(beforeSeq = null) {
  const root = tempDir('adopt');
  cpSync(ADOPT, root, { recursive: true });
  if (beforeSeq != null) {
    const file = join(root, 'items', 'trial.jsonl');
    const all = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const cut = all.findIndex((l) => {
      const r = JSON.parse(l);
      return r.kind === 'engine.transition' && r.payload?.outcome === 'applied' && r.payload.seq === beforeSeq;
    });
    writeFileSync(file, `${all.slice(0, cut).join('\n')}\n`);
  }
  return root;
}

/** The repo's quick-fix, composed as the engine pins it, passed through change(spec); written as a blob under root. */
export async function pinCopy(root, change) {
  const { prompts } = await engine();
  const { spec } = prompts.readWorkflow('quick-fix', { dir: join(REPO, 'workflows') });
  const copy = structuredClone(spec);
  change(copy);
  const bytes = prompts.pinBytes(copy);
  const hash = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'blobs'), { recursive: true });
  writeFileSync(join(root, 'blobs', hash), bytes);
  return `quick-fix@${hash}`;
}

/** The adopt trial's start input: a quick-fix issue. */
export const startInput = () => applied(join(ADOPT, 'items', 'trial.jsonl'))[0].payload.event.input;

/**
 * Starts `item` on `pin` as an earlier release did: its seq-0 row written by a host given the spec unmarked (a plain
 * copy, as a release whose check took it), with that release on the row.
 */
export async function startAsEarlier(root, item, pin, release) {
  const { index, host: H } = await engine();
  const loaded = index.loadWorkflow(pin, { root });
  const plain = JSON.parse(JSON.stringify(loaded));
  const h = H.restore({ root, item, spec: plain, session: 'earlier', release });
  const r = H.applyEvent(h, { event: { type: 'xstate.init', input: startInput() }, source: { system: 'test', ref: `start ${item}` } });
  if (r.outcome !== 'applied') throw new Error(`start refused: ${r.row.payload.reason}`);
  H.persist(h, r.row);
  return h;
}

/** Effect handlers that record every call and carry out nothing. */
export function recorder() {
  const calls = [];
  const handler = (type) => ({ start: (effect) => { calls.push([type, 'start', effect.id]); return {}; }, find: (effect) => { calls.push([type, 'find', effect.id]); return null; } });
  return { calls, handlers: Object.fromEntries(['run', 'stop', 'timer', 'cancel'].map((t) => [t, handler(t)])) };
}
