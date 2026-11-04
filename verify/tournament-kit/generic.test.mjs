// Verifier tests for plan item tournament-kit, Expect `generic`: the kit names no tournament, lane, workflow or
// engine path, and a toy tournament on another subject (design and judge stages only) builds args and runs through
// runner.workflow.js with stub agents to a result. The stub host here is the verifier's own, not dry-run.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const KIT = path.join(ROOT, 'scripts/tournament');
const TOY = path.join(HERE, 'toy/2026-11-04-readme-structure');

function kitFiles(dir = KIT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? kitFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

function forbiddenNames() {
  // `workflows/` is checked separately below, since .github/workflows/ (the CI template's own home) is allowed.
  const names = new Set(['packages/', 'spec.js', 'host.js', 'engine', 'xstate', 'tourney/2026']);
  const tdir = path.join(ROOT, 'tournaments');
  for (const id of fs.readdirSync(tdir)) {
    const cfg = path.join(tdir, id, 'config.json');
    if (!fs.existsSync(cfg)) continue;
    names.add(id);
    const c = JSON.parse(fs.readFileSync(cfg, 'utf8'));
    for (const l of c.lanes) names.add(l.id);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'workflows'))) names.add(f.replace(/\.json$/, ''));
  for (const w of ['research', 'feature']) names.add(w);
  return [...names];
}

test('scripts/tournament names no tournament, lane, workflow or engine path', () => {
  const hits = [];
  const names = forbiddenNames();
  for (const f of kitFiles()) {
    const text = fs.readFileSync(f, 'utf8').toLowerCase();
    for (const n of names) if (text.includes(n.toLowerCase())) hits.push(`${path.relative(ROOT, f)}: ${n}`);
  }
  assert.deepEqual(hits, []);
  for (const f of kitFiles()) {
    const text = fs.readFileSync(f, 'utf8');
    // no dated tournament id anywhere in the kit
    assert.doesNotMatch(text, /\b20\d\d-\d\d-\d\d-[a-z]/, f);
    // no harness workflow path (workflows/<x>), only GitHub's .github/workflows/
    assert.doesNotMatch(text, /(?<!\.github\/)\bworkflows\//, f);
  }
});

test('runner.workflow.js hard-codes no stage id, role name or scoring', () => {
  const src = fs.readFileSync(path.join(KIT, 'runner.workflow.js'), 'utf8');
  for (const word of ['design', 'build', 'judge', 'final', 'delete', 'designer', 'executor', 'final-judge'])
    assert.doesNotMatch(src, new RegExp(`['"\`]${word}['"\`]`), `runner names '${word}'`);
  assert.doesNotMatch(src, /import\s|require\(|readFile/, 'runner must take everything from args');
});

function buildToyArgs() {
  const r = spawnSync(process.execPath, [path.join(KIT, 'args.mjs'), TOY], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('args.mjs builds valid args from the toy folder', () => {
  const a = buildToyArgs();
  assert.equal(a.id, '2026-11-04-readme-structure');
  assert.match(a.question, /README/);
  assert.match(a.pack, /newcomer/);
  assert.deepEqual(a.stages.map((s) => [s.id, s.role, s.over]), [['sketch', 'designer', 'each'], ['verdict', 'judge', 'all']]);
  assert.deepEqual(Object.keys(a.roles).sort(), ['designer', 'judge']);
  assert.ok(a.roles.designer.prompt.length > 0 && a.roles.judge.prompt.length > 0);
  assert.equal(a.lanes.length, 3);
});

/** The verifier's own stub of the Workflow tool's hooks. */
async function runRunner(args, answer) {
  const src = fs.readFileSync(path.join(KIT, 'runner.workflow.js'), 'utf8').replace(/^export const meta =/m, 'const meta =');
  const calls = [];
  const phases = [];
  const hooks = {
    args,
    agent: async (prompt, opts = {}) => {
      calls.push({ prompt, ...opts });
      return answer(prompt, opts);
    },
    pipeline: async (items, ...steps) =>
      Promise.all(items.map(async (item, i) => {
        let v = item;
        for (const s of steps) v = await s(v, item, i);
        return v;
      })),
    parallel: async (thunks) => Promise.all(thunks.map((t) => t())),
    phase: (p) => phases.push(p),
    log: () => {},
    budget: { total: null, spent: () => 0, remaining: () => Infinity }
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const result = await new AsyncFunction(...Object.keys(hooks), src)(...Object.values(hooks));
  return { result, calls, phases };
}

test('the toy tournament runs through the runner with stub agents to a result', async () => {
  const args = buildToyArgs();
  const { result, calls, phases } = await runRunner(args, async (prompt, opts) => {
    if (opts.label.startsWith('sketch:')) {
      const lane = opts.label.slice('sketch:'.length);
      return { designFile: `/tmp/${lane}.md`, summary: `outline by ${lane}` };
    }
    return { scores: [], ranking: ['Q', 'T', 'R'], bestIdeas: [{ lane: 'Q', idea: 'sections as questions' }] };
  });
  assert.deepEqual(calls.map((c) => c.label).sort(), ['sketch:Q-question-led', 'sketch:R-reference-first', 'sketch:T-tutorial-first', 'verdict'].sort());
  assert.deepEqual(phases, ['Sketch', 'Verdict']);
  const sketchT = calls.find((c) => c.label === 'sketch:T-tutorial-first');
  assert.match(sketchT.prompt, /How should a project README be structured/);
  assert.match(sketchT.prompt, /Tutorial-first/);
  assert.match(sketchT.prompt, /per hundred README lines/, 'scoring rule comes from args');
  assert.ok(sketchT.schema, 'designer schema passed');
  const verdict = calls.find((c) => c.label === 'verdict');
  assert.match(verdict.prompt, /outline by R-reference-first/, 'judge sees the lanes outputs');
  assert.doesNotMatch(verdict.prompt, /\{\{/);
  assert.equal(result.id, '2026-11-04-readme-structure');
  assert.deepEqual(result.result.ranking, ['Q', 'T', 'R']);
  assert.equal(result.lanes['T-tutorial-first'].sketch.summary, 'outline by T-tutorial-first');
});
