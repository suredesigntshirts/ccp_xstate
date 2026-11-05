// Helpers for the refine-brief-stage verifier's tests. Written by the verifier session, not the builder's.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const RUNS = join(REPO, 'bench/brief/runs');
export const SETS = ['baseline', 'variant-dry-run', 'variant-proof-at-head', 'variant-words-test', 'variant-criteria-not-methods', 'variant-dry-run-copy', 'variant-combined'];
export const VARIANTS = ['dry-run', 'proof-at-head', 'words-test', 'criteria-not-methods', 'dry-run-copy', 'combined'];
export const OLD_CASES = ['planted-after-merge', 'planted-half-met', 'planted-missing-line', 'planted-prescribed-fix', 'real-adopt-clamp', 'real-jsonl-lint', 'real-jsonl-lint-multi'];
export const NEW_CASES = ['intake-shared-parser', 'intake-suggested-fix'];
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** The run folders of a set (each has bench.json). */
export const runsOf = (dir) => readdirSync(dir).filter((r) => existsSync(join(dir, r, 'bench.json'))).sort();

/** Copy a committed run set to a temp folder and rescore it there with --no-judge (kept verdicts only, no model). */
export function rescore(set) {
  const dir = join(mkdtempSync(join(tmpdir(), 'v-rbs-')), set);
  cpSync(join(RUNS, set), dir, { recursive: true });
  execFileSync(process.execPath, [join(REPO, 'scripts/bench/score.mjs'), '--stage', 'brief', '--runs', dir, '--no-judge'], { cwd: REPO, stdio: 'ignore' });
  return dir;
}

/** Runs met per criterion in a scored set. */
export function totals(dir) {
  const t = {};
  for (const r of runsOf(dir)) for (const [k, v] of Object.entries(readJson(join(dir, r, 'score.json')).criteria)) t[k] = (t[k] ?? 0) + (v.met === true ? 1 : 0);
  return t;
}

/** The brief actor of the quick-fix workflow each run of a set pinned, as one JSON string per distinct version. */
export function pinnedBriefs(set) {
  const dir = join(RUNS, set);
  const seen = new Map();
  for (const r of runsOf(dir)) {
    const sha = readJson(join(dir, r, 'bench.json')).workflow.sha256;
    const actor = readJson(join(dir, r, 'blobs', sha)).meta.actors.brief;
    const k = JSON.stringify(actor);
    seen.set(k, [...(seen.get(k) ?? []), r]);
  }
  return [...seen].map(([k, runs]) => ({ actor: JSON.parse(k), runs }));
}
