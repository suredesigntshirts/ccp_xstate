// Expects "variants" and "kept": each variant set pinned one stage file that is the baseline's plus one change;
// every set's scores and every compare are recomputed with --no-judge; the combined file is rebuilt from the kept
// changes (words-test, proof-at-head) and equals the branch's workflows/quick-fix/brief.md and the combined set's pin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, RUNS, SETS, VARIANTS, pinnedBriefs, readJson, rescore, totals } from './lib.mjs';

// The decision's "After the build" table: runs met of 27, in the order of ROWS.
const ROWS = ['one-check-per-line', 'no-restated-rules', 'builder-criteria', 'words-only', 'runs-as-written', 'catches-traps', 'avoids-must-not', 'methods-private'];
const TABLE = {
  baseline: [27, 27, 18, 10, 19, 20, 18, 11],
  'variant-dry-run': [27, 26, 20, 8, 22, 23, 17, 7],
  'variant-proof-at-head': [27, 27, 12, 10, 20, 22, 17, 12],
  'variant-words-test': [27, 27, 19, 19, 22, 20, 24, 11],
  'variant-criteria-not-methods': [23, 26, 27, 12, 16, 18, 15, 11],
  'variant-dry-run-copy': [26, 26, 20, 8, 23, 21, 16, 10],
  'variant-combined': [27, 27, 12, 20, 23, 20, 24, 11]
};

const rescored = {};
for (const set of SETS) {
  test(`${set}: rescored with --no-judge matches the decision's table`, () => {
    rescored[set] = rescore(set);
    const t = totals(rescored[set]);
    assert.equal(t.returned, 27);
    assert.equal(t['changes-nothing'], 27);
    assert.deepEqual(ROWS.map((r) => t[r]), TABLE[set]);
  });
}

for (const v of VARIANTS) {
  test(`compare-${v}.md recomputes from the rescored sets`, () => {
    const out = join(mkdtempSync(join(tmpdir(), 'v-rbs-cmp-')), 'c.md');
    execFileSync(process.execPath, [join(REPO, 'scripts/bench/compare.mjs'), '--stage', 'brief', '--a', join(RUNS, 'baseline'), '--b', join(RUNS, `variant-${v}`), '--out', out], { cwd: REPO, stdio: 'ignore' });
    const body = (f) => readFileSync(f, 'utf8').split('\n').filter((l) => !l.startsWith('Generated')).join('\n');
    assert.equal(body(out), body(join(REPO, 'bench/brief/reports', `compare-${v}.md`)));
  });
}

const base = pinnedBriefs('baseline');
test('baseline: all 27 runs pinned one brief stage file, the one on main', () => {
  assert.equal(base.length, 1);
  assert.equal(base[0].runs.length, 27);
  const mainFile = readJson(join(REPO, 'verify/refine-brief-stage/evidence/main-fixtures.json')).briefMd;
  for (const rule of base[0].actor.rules) assert.ok(mainFile.includes(rule), `baseline rule not in main's brief.md: ${rule.slice(0, 60)}`);
});

const one = (set) => { const p = pinnedBriefs(set); assert.equal(p.length, 1, `${set} pinned ${p.length} versions`); return p[0].actor; };
const rest = (a) => JSON.stringify({ ...a, rules: undefined });

for (const v of ['dry-run', 'proof-at-head', 'words-test', 'criteria-not-methods', 'dry-run-copy']) {
  test(`variant-${v}: exactly one change to the baseline stage file`, () => {
    const a = one(`variant-${v}`);
    const b = base[0].actor;
    assert.equal(rest(a), rest(b), 'only the rules may differ');
    const added = a.rules.filter((r) => !b.rules.includes(r));
    const removed = b.rules.filter((r) => !a.rules.includes(r));
    assert.equal(added.length, 1);
    assert.ok(removed.length <= 1 && (removed.length === 0 || b.rules.indexOf(removed[0]) === a.rules.indexOf(added[0])), 'one rule added or one rewritten in place');
  });
}

test('kept: combined = baseline + words-test rewrite + proof-at-head rule, = the branch file and the combined pin', () => {
  const b = base[0].actor.rules;
  const w = one('variant-words-test').rules;
  const p = one('variant-proof-at-head').rules;
  const rebuilt = b.map((r, i) => (w[i] !== r ? w[i] : r));
  const at = p.findIndex((r) => !b.includes(r));
  rebuilt.splice(at, 0, p[at]);
  assert.deepEqual(one('variant-combined').rules, rebuilt);
  const branch = readFileSync(join(REPO, 'workflows/quick-fix/brief.md'), 'utf8');
  const rulesPart = branch.split('## Rules')[1].split('\n## ')[0];
  assert.deepEqual(rulesPart.trim().split('\n').map((l) => l.replace(/^- /, '')), rebuilt);
  assert.equal(readFileSync(join(REPO, 'bench/brief/variants/combined/quick-fix/brief.md'), 'utf8'), branch);
  assert.equal(readJson(join(RUNS, 'variant-combined/set.json')).workflow.sha256.length, 64);
});

test('blind reads committed with their keys, and both packets regenerate from the sets', () => {
  for (const [dir, seed] of [['blind-combined', 1], ['blind-combined-seed2', 2]]) {
    const ref = join(REPO, 'bench/brief/reports', dir);
    for (const f of ['packet.md', 'key.json', 'read.md']) assert.ok(readFileSync(join(ref, f), 'utf8').length > 0, `${dir}/${f}`);
    const out = mkdtempSync(join(tmpdir(), 'v-rbs-blind-'));
    execFileSync(process.execPath, [join(REPO, 'scripts/bench/compare.mjs'), '--stage', 'brief', '--a', join(RUNS, 'baseline'), '--b', join(RUNS, 'variant-combined'), '--out', join(out, 'c.md'), '--blind', join(out, 'b'), '--seed', String(seed)], { cwd: REPO, stdio: 'ignore' });
    assert.equal(readFileSync(join(out, 'b/packet.md'), 'utf8'), readFileSync(join(ref, 'packet.md'), 'utf8'));
    assert.deepEqual(readJson(join(out, 'b/key.json')), readJson(join(ref, 'key.json')));
  }
});
