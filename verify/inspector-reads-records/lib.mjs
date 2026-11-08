// Verifier's helpers for plan item inspector-reads-records, written from the item's Expect lines and the engine's
// exports; the builder's tests (packages/engine/test/explain.test.js, scripts/inspector/test/) are not read or used.
// IRR_REPO names the checkout under test (default: this repo), so the same code runs at the PR's head and at main.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.IRR_REPO ?? join(HERE, '..', '..'));
export const SCENARIOS = ['Q1', 'Q3', 'Q5', 'R1'];
export const TRIALS = ['adopt', 'blocked-retry', 'fail', 'blocked'].map((t) => `tournaments/2026-11-04-stage-contract/trials/${t}/journal`);

export const imp = (repo, p) => import(pathToFileURL(join(repo, p)).href);
export const tempDir = (tag) => mkdtempSync(join(tmpdir(), `irr-${tag}-`));

export const rowsOf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** Every item journal the checkout commits: [{ root, item, file }] for each <root>/items/<item>.jsonl git tracks. */
export function committedItems(repo = REPO) {
  const out = execFileSync('git', ['-C', repo, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return out.split('\0').filter((f) => /(^|\/)items\/[^/]+\.jsonl$/.test(f)).sort().map((f) => {
    const root = join(repo, dirname(dirname(f)));
    return { root, item: f.split('/').pop().replace(/\.jsonl$/, ''), file: join(repo, f), rel: f };
  });
}

/** Item journals with at least one engine.transition row (the ones the inspector can replay). */
export const withTransitions = (list) => list.filter((x) => rowsOf(x.file).some((r) => r.kind === 'engine.transition'));

// Every folder under dir (up to four levels) that holds items/*.jsonl.
export function rootsUnder(dir) {
  const out = [];
  const look = (d, depth) => {
    if (!existsSync(d) || !statSync(d).isDirectory()) return;
    const items = join(d, 'items');
    if (existsSync(items) && readdirSync(items).some((n) => n.endsWith('.jsonl'))) { out.push(d); return; }
    if (depth < 4) for (const n of readdirSync(d)) look(join(d, n), depth + 1);
  };
  look(dir, 0);
  return out.sort();
}

/**
 * Run tourney scenario <name> of the checkout with TMPDIR at a kept folder; [{ root, item, file, rel }] for every
 * item journal it leaves. The scenario test must pass.
 */
export function scenarioItems(name, repo = REPO) {
  const dir = tempDir(`scn-${name}`);
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  execFileSync(process.execPath, ['--test', '--test-reporter=dot', `packages/engine/test/tourney/${name}.test.js`], {
    cwd: repo, env: { ...env, TMPDIR: dir, TMP: dir, TEMP: dir }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000
  });
  return rootsUnder(dir).flatMap((root) => readdirSync(join(root, 'items')).filter((n) => n.endsWith('.jsonl')).sort()
    .map((n) => ({ root, item: n.replace(/\.jsonl$/, ''), file: join(root, 'items', n), rel: `${name}:${root.slice(dir.length + 1)}/items/${n}` })));
}

/** The state node at dotted path key of spec ("a.b" -> spec.states.a.states.b). */
export const nodeAt = (spec, key) => key.split('.').reduce((st, k) => st?.states?.[k], spec);

/** The active leaves of a snapshot value. */
export const leaves = (v, p = '') => (v == null ? [] : typeof v === 'string' ? [p ? `${p}.${v}` : v] : Object.entries(v).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k)));

/** xstate as Node resolves it for the checkout's engine (the same module instance its spec.js imports). */
export const xstateOf = (repo = REPO) => import(pathToFileURL(join(repo, 'node_modules/xstate/dist/xstate.cjs.mjs')).href);
