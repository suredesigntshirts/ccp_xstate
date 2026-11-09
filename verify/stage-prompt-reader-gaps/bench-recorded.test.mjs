// Expect bench-recorded: each committed run set holds 27 scored runs (9 cases, 3 each); the baseline set ran the
// base's brief prompt and the variant set ran bench/brief/variants/reader-gaps; and compare.mjs over the two sets
// reproduces bench/brief/reports/compare-reader-gaps.md. The bench itself is not rerun. A run's brief prompt is
// rendered again from the workflow it claims, with its own run id, and must equal the prompt.md it ran on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node, read, render } from './lib.mjs';

const RUNS = 'bench/brief/runs';
const SETS = { baseline: `${RUNS}/baseline-2026-11-09`, variant: `${RUNS}/variant-reader-gaps` };
const VARIANT = 'bench/brief/variants/reader-gaps/quick-fix.json';
const json = (p) => JSON.parse(read(p));
const runsOf = (set) => readdirSync(join(REPO, set)).filter((d) => /\.\d+$/.test(d)).sort();
const promptOf = (set, run) => {
  const items = join(REPO, set, run, 'items');
  const item = readdirSync(items).find((d) => !d.endsWith('.jsonl'));
  return { file: join(items, item, 'runs', '0.brief', 'prompt.md'), id: `${item}:0.brief` };
};
const version = (args) => {
  const r = node(['--input-type=module', '-e',
    `import { workflowVersion } from ${JSON.stringify(join(REPO, 'scripts/bench/lib.mjs'))}; ` +
    `console.log((await workflowVersion(${JSON.stringify(args)})).sha256)`]);
  assert.equal(r.status, 0, r.out);
  return r.stdout.trim();
};

for (const [name, set] of Object.entries(SETS)) {
  test(`${name}: 27 scored runs, 3 on each of the 9 cases, all on the set's workflow version`, (t) => {
    const s = json(`${set}/set.json`);
    const runs = runsOf(set);
    t.diagnostic(`${runs.length} runs, ${s.cases.length} cases, workflow ${s.workflow.sha256.slice(0, 12)} (${s.workflow.source})`);
    assert.equal(runs.length, 27);
    assert.deepEqual(runs, [...s.runs].sort());
    assert.deepEqual(s.cases, readdirSync(join(REPO, 'bench/brief/cases')).sort());
    for (const c of s.cases) assert.equal(runs.filter((r) => r.startsWith(`${c}.`)).length, 3, c);
    for (const r of runs) {
      assert.ok(existsSync(join(REPO, set, r, 'score.json')), `${r} scored`);
      assert.equal(json(`${set}/${r}/bench.json`).workflow.sha256, s.workflow.sha256, `${r} workflow`);
    }
  });
}

test('the variant set names bench/brief/variants/reader-gaps and its brief prompts render from it', (t) => {
  const s = json(`${SETS.variant}/set.json`);
  const v = version({ workflow: join(REPO, VARIANT) });
  t.diagnostic(`variant file version ${v.slice(0, 12)}, set ${s.workflow.sha256.slice(0, 12)}`);
  assert.equal(v, s.workflow.sha256);
  for (const run of runsOf(SETS.variant).filter((r) => r.endsWith('.1'))) {
    const { file, id } = promptOf(SETS.variant, run);
    assert.equal(render('brief', ['--case', run.replace(/\.1$/, ''), '--run-id', id, '--workflow', join(REPO, VARIANT)]).prompt,
      readFileSync(file, 'utf8'), run);
  }
});

test("the baseline set ran the base's brief prompt: each case's prompt renders from the head's brief, which is the base's", (t) => {
  const s = json(`${SETS.baseline}/set.json`);
  assert.equal(s.workflow.source, 'workflows/quick-fix.json and workflows/quick-fix/');
  for (const run of runsOf(SETS.baseline).filter((r) => r.endsWith('.1'))) {
    const { file, id } = promptOf(SETS.baseline, run);
    assert.equal(render('brief', ['--case', run.replace(/\.1$/, ''), '--run-id', id]).prompt, readFileSync(file, 'utf8'), run);
  }
  t.diagnostic(`9 cases' prompts equal; set workflow ${s.workflow.sha256.slice(0, 12)}`);
  const base = [process.env.BASE_SHA, 'origin/main'].filter(Boolean)
    .find((r) => spawnSync('git', ['-C', REPO, 'rev-parse', '--verify', '--quiet', `${r}^{commit}`]).status === 0);
  if (!base) { t.diagnostic('no base reachable: workflow version at the base not recomputed'); return; }
  const v = version({ rev: base });
  t.diagnostic(`quick-fix version at ${base}: ${v.slice(0, 12)}`);
  assert.equal(v, s.workflow.sha256);
});

test('compare.mjs over the two sets reproduces the committed report', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sprg-compare-'));
  try {
    const out = join(dir, 'report.md');
    const r = node([join(REPO, 'scripts/bench/compare.mjs'), '--stage', 'brief', '--a', SETS.baseline, '--b', SETS.variant, '--out', out]);
    assert.equal(r.status, 0, r.out);
    const got = readFileSync(out, 'utf8');
    const want = read('bench/brief/reports/compare-reader-gaps.md');
    const table = (s) => s.match(/^## Per criterion, all cases\n[\s\S]*?(?=^## |(?![\s\S]))/m)?.[0];
    t.diagnostic(table(got)?.split('\n').filter((l) => /\*\*worse\*\*|better/.test(l)).length + ' criteria changed');
    assert.ok(table(want));
    assert.equal(table(got), table(want));
    assert.equal(got, want);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
