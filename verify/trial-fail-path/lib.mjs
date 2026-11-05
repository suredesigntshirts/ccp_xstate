// Verifier's own checks for plan item trial-fail-path. Written from the item, plan/decisions/2026-11-05-trial-fail-path.md
// and the committed trial files; the reports are read only to compare their claims with what these functions find.
//
// Each function reads one trial folder (tournaments/2026-11-04-stage-contract/trials/<name>/) and returns plain facts:
// the item replayed through the real engine's restore() (which re-runs every applied transition on the pinned
// quick-fix and throws if a recorded hash differs), the runs and their accepted results, the prompts the agents got,
// the refusals, and the fake GitHub's end state.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { restore } from '../../packages/engine/src/host.js';
import { loadWorkflow } from '../../packages/engine/src/index.js';
import { assemble } from '../../packages/engine/src/stages.js';

export const REPO = new URL('../../', import.meta.url).pathname;
export const TRIALS = join(REPO, 'tournaments/2026-11-04-stage-contract/trials');
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export function load(name, { replay = true } = {}) {
  const dir = join(TRIALS, name);
  const root = join(dir, 'journal');
  const rows = lines(join(root, 'items', 'trial.jsonl'));
  // loadWorkflow stores the workflow blob in root when it is missing, so it is only called on journals that pin it.
  const spec = replay ? loadWorkflow('quick-fix', { root }) : null;
  const host = replay ? restore({ root, item: 'trial', spec, session: 'verifier', release: 'verifier' }) : null;
  const applied = rows.filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied').sort((a, b) => a.payload.seq - b.payload.seq);
  const runsDir = join(root, 'items', 'trial', 'runs');
  const runs = Object.fromEntries(readdirSync(runsDir).sort((a, b) => parseInt(a) - parseInt(b)).map((n) => {
    const d = join(runsDir, n);
    const f = (x) => (existsSync(join(d, x)) ? readFileSync(join(d, x), 'utf8') : null);
    return [n, { dir: d, brief: f('brief.md'), context: f('context.md'), stage: f('stage.json') && JSON.parse(f('stage.json')), result: f('result.json') && JSON.parse(f('result.json')) }];
  }));
  const pendingDir = join(dir, 'run', 'pending');
  const pending = Object.fromEntries(readdirSync(pendingDir).filter((f) => f.endsWith('.prompt.md')).map((f) => [f.replace(/^trial_/, '').replace(/\.prompt\.md$/, ''), readFileSync(join(pendingDir, f), 'utf8')]));
  const answersDir = join(dir, 'run', 'answers');
  const answers = Object.fromEntries(readdirSync(answersDir).map((f) => [f, readFileSync(join(answersDir, f), 'utf8')]));
  return {
    dir, root, rows, spec, host, applied, runs, pending, answers,
    workflowHash: sha256(readFileSync(join(REPO, 'workflows/quick-fix.json'))),
    states: applied.map((r) => JSON.parse(r.state)),
    log: lines(join(dir, 'run', 'driver-log.jsonl')),
    shim: lines(join(dir, 'run', 'shim-calls.jsonl')),
    gh: json(join(dir, 'run', 'gh-state.json')),
    report: readFileSync(join(dir, 'report.md'), 'utf8')
  };
}

/** The value a run's stage.json says it was given for input `name`. */
export const inputOf = (run, name) => run.stage.inputs.find((i) => i.name === name);

/** Every line of a pending prompt that is not in brief.md + context.md, in order, by a line diff (LCS). */
export function extraLines(prompt, brief, context) {
  const a = `${brief}\n${context}`.split('\n');
  const b = prompt.split('\n');
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const extra = []; const missing = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) missing.push({ line: i + 1, text: a[i++] }); else extra.push({ line: j + 1, text: b[j++] });
  }
  while (i < a.length) missing.push({ line: i + 1, text: a[i++] });
  while (j < b.length) extra.push({ line: j + 1, text: b[j++] });
  return { extra, missing };
}

/** Refusal rows by rule, from the journal and from the driver log's accept rows. */
export function refusals(t) {
  const byRule = (list) => list.reduce((m, r) => ({ ...m, [r]: (m[r] ?? 0) + 1 }), {});
  const journal = t.rows.filter((r) => r.kind === 'refusal').map((r) => r.payload?.rule ?? '?');
  const driver = t.log.filter((r) => r.kind === 'accept' && r.got?.refused).map((r) => r.got.refused.rule);
  const unparsable = t.log.filter((r) => r.kind === 'answer.unparsable').length;
  const accepts = t.log.filter((r) => r.kind === 'accept').length;
  return { journal: byRule(journal), driver: byRule(driver), unparsable, accepts };
}

/** The report's "Rule | Count" table as { rule: count }. */
export function reportRuleTable(report) {
  const out = {};
  const at = report.indexOf('| Rule | Count |');
  for (const line of report.slice(at).split('\n').slice(2)) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(\d+)\s*\|$/);
    if (!m) break;
    for (const rule of m[1].split(',').map((s) => s.trim())) out[rule] = Number(m[2]);
  }
  return out;
}

/** stage.json reassembled: does assemble(prompt.parts) equal brief.md, and prompt.hash its sha256? */
export function stageRecord(t) {
  return Object.entries(t.runs).filter(([, r]) => r.brief !== null).map(([n, r]) => ({
    run: n,
    hasStage: !!r.stage,
    assembled: !!r.stage && assemble(r.stage.prompt.parts) === r.brief,
    hash: !!r.stage && r.stage.prompt.hash === sha256(r.brief),
    context: !!r.stage && r.stage.context?.text === r.context
  }));
}

export const deepEqual = isDeepStrictEqual;
