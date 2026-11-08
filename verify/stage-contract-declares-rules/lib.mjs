// Verifier's helpers for plan item stage-contract-declares-rules, written from the item's Expect lines and main's
// engine; the builder's tests (packages/engine/test/marks.test.js) are not read or used. Every helper takes `repo`, the
// root of the checkout whose engine runs, so the same code runs at the PR's head and at main.
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.SCDR_REPO ?? join(HERE, '..', '..'));
export const WORKFLOWS = ['quick-fix', 'research', 'intake', 'feature'];

// Commits made by the fake worlds get the same shas at both checkouts: fixed dates, no signing, no global config.
export function fixGit() {
  Object.assign(process.env, {
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1'
  });
}

const imp = (repo, p) => import(pathToFileURL(join(repo, p)).href);
/** A checkout's engine: index.js, stages.js and actors.js exports, and the tourney world (world.js). */
export async function engineOf(repo = REPO) {
  const [index, stages, actors, world] = await Promise.all([
    imp(repo, 'packages/engine/src/index.js'), imp(repo, 'packages/engine/src/stages.js'),
    imp(repo, 'packages/engine/src/actors.js'), imp(repo, 'packages/engine/test/tourney/world.js')
  ]);
  return { index, stages, actors, world };
}

/** The raw workflow file of a checkout, parsed. */
export const rawWorkflow = (repo, name) => JSON.parse(readFileSync(join(repo, 'workflows', `${name}.json`), 'utf8'));

/**
 * A copy of a checkout's workflows/ (JSON files and stage files) in a temp folder, each workflow file passed through
 * change[name](spec) when given (and through every(spec) first). Returns the folder.
 */
export function copyWorkflows(repo, change = {}, every = null) {
  const dir = mkdtempSync(join(tmpdir(), 'scdr-wf-'));
  cpSync(join(repo, 'workflows'), dir, { recursive: true });
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const name = f.slice(0, -5);
    let spec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (every) spec = every(spec) ?? spec;
    if (change[name]) spec = change[name](spec) ?? spec;
    writeFileSync(join(dir, f), `${JSON.stringify(spec, null, 2)}\n`);
  }
  return dir;
}

/** A spec without meta.marks: the reading of a stage with no marks. */
export const unmark = (spec) => {
  if (spec?.meta) delete spec.meta.marks;
  return spec;
};

/** Renames stage `from` to `to` in a workflow: its actor, its invokes' src, its marks and its stage file's title. */
export function renameStage(dir, spec, from, to) {
  spec.meta.actors[to] = spec.meta.actors[from];
  delete spec.meta.actors[from];
  if (spec.meta.marks?.[from]) { spec.meta.marks[to] = spec.meta.marks[from]; delete spec.meta.marks[from]; }
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.src === from && ('id' in n || 'input' in n)) n.src = to;
    Object.values(n).forEach(walk);
  };
  walk(spec.states);
  const file = spec.meta.actors[to].prompt;
  if (file) {
    const p = join(dir, file);
    const text = readFileSync(p, 'utf8').replace(new RegExp(`^# ${from}$`, 'm'), `# ${to}`);
    const renamed = file.replace(/[^/]+\.md$/, `${to}.md`);
    writeFileSync(join(dir, renamed), text);
    spec.meta.actors[to].prompt = renamed;
  }
  return spec;
}

const isNoise = (k, v) => (k === 'at' ? typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) : ['id', 'hookSession', 'toolUseId', 'ms'].includes(k) && typeof v !== 'object');
/** Times, row ids, hook sessions and tool-use ids differ between runs; the rest must not. Paths are replaced too. */
export function strip(value, paths = {}) {
  let text = JSON.stringify(value ?? null, (k, v) => (isNoise(k, v) ? undefined : v));
  for (const [name, p] of Object.entries(paths)) if (p) text = text.split(p).join(`<${name}>`);
  text = text.replace(/-ret-0\.\d+/g, '-ret-<random>');
  return JSON.parse(text);
}
