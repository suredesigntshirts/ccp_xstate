// Expect line no-guessing of plan item inspector-reads-records: the inspector's own code (scripts/inspector/, its
// tests aside) reads no engine source as text, keeps none of the deleted functions or provenance kinds, does not
// tell a model run by its prompt file, draws its map from chart(), and refuses, by name, a journal whose model run
// has no stage record and an engine checkout without explain.js; build.mjs skips both by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO, imp, tempDir } from './lib.mjs';

const DIR = join(REPO, 'scripts/inspector');
const files = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  if (statSync(p).isDirectory()) return n === 'test' ? [] : files(p);
  return /\.(mjs|js|html)$/.test(n) ? [p] : [];
});
const code = files(DIR).map((f) => ({ f: relative(REPO, f), text: readFileSync(f, 'utf8') }));
const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

const DELETED = ['matchEdge', 'candidatesOf', 'listenersOf', 'applyActions', 'findInvoke', 'stringPieces', 'piecesOf', 'labelGap',
  'runValuesOf', 'segmentsOf', 'jsonChunks', 'sourceOf', 'withHelpers', 'hostFieldsOf', 'stampOf', 'schemaDifference'];

test('none of the deleted functions is left in the inspector code', () => {
  for (const name of DELETED) {
    for (const { f, text } of code) assert.ok(!new RegExp(`\\b${name}\\b`).test(text), `${f} has ${name}`);
  }
  // graphOf is still a name: it must be only the engine's chart(), through graphFrom, not a walker of its own.
  const exp = code.find((c) => c.f.endsWith('export.mjs')).text;
  const body = (name) => { const at = exp.search(new RegExp(`function ${name}\\b`)); assert.ok(at >= 0, `${name} is defined`); return exp.slice(at, exp.indexOf('\n}\n', at)); };
  assert.match(body('graphOf'), /graphFrom\(eng, spec\)/);
  assert.doesNotMatch(body('graphOf'), /\.states|\.on\b|\.after\b|onDone/);
  assert.match(body('graphFrom'), /eng\.chart\(spec\)/);
  assert.doesNotMatch(body('graphFrom'), /Object\.(entries|keys|values)\([^)]*\.states|\bst\.on\b|\bst\.after\b|onDone|onError|walk\(/, 'graphFrom walks no states of its own');
});

test('no engine source is read as text, no guessed provenance kinds, no model test on a prompt file', () => {
  for (const { f, text } of code) {
    text.split('\n').forEach((line, i) => {
      if (/readFileSync|readText\(|readJson\(/.test(line)) {
        assert.doesNotMatch(line, /engine\/src|actors\.js|stages\.js|spec\.js|trace\.js|prompts\.js|\.js['"`]/, `${f}:${i + 1} reads source: ${line.trim()}`);
      }
    });
    assert.doesNotMatch(text, /kind\s*(===|:)\s*'(passthrough|template|template\+workflow)'/, `${f}: a guessed provenance kind`);
    assert.doesNotMatch(text, /'template\+workflow'|templateSource|templateNote/, `${f}: template provenance`);
    assert.doesNotMatch(text, /brief\.md/, `${f}: names brief.md`);
  }
  const exp = code.find((c) => c.f.endsWith('export.mjs')).text;
  // The model flag is the stage record; the prompt file appears only in the cutoff refusal and as the file shown.
  assert.match(exp, /model: stageRaw != null/);
  for (const line of exp.split('\n').filter((l) => /promptFile/.test(l))) assert.doesNotMatch(line, /model/, `prompt file used as a model test: ${line.trim()}`);
});

test('a run with stage.json and no prompt file is still a model run; the map is chart()', async () => {
  const { exportRun } = await imp(REPO, 'scripts/inspector/export.mjs');
  const { chart } = await imp(REPO, 'packages/engine/src/stages.js');
  const root = tempDir('noprompt');
  cpSync(ADOPT, root, { recursive: true });
  const runs = join(root, 'items/trial/runs');
  const name = readdirSync(runs).find((n) => n.endsWith('.build'));
  const prompt = readdirSync(join(runs, name)).find((n) => /^(prompt|brief)\.md$/.test(n));
  rmSync(join(runs, name, prompt));
  const b = await exportRun({ engine: REPO, journal: root, item: 'trial' });
  const a = b.steps.flatMap((s) => s.actors).find((x) => String(x.effect).endsWith(name.replace(/^\d+\./, (m) => m)));
  assert.ok(a && a.model, `${name} without ${prompt} is still a model run`);
  const { transitions, nodes } = chart(b.workflow.spec);
  assert.deepEqual(b.graph.edges.map((e) => [e.id, e.from, e.to]), transitions.map((t) => [t.at, t.state, t.after]));
  assert.deepEqual(b.graph.nodes.map((n) => n.id), [...nodes.keys()]);
});

test('a journal with a model run lacking stage.json, and an engine without explain.js, are refused by name, and build skips them', async () => {
  const { exportRun } = await imp(REPO, 'scripts/inspector/export.mjs');
  const root = tempDir('nostage');
  cpSync(ADOPT, root, { recursive: true });
  const runs = join(root, 'items/trial/runs');
  const name = readdirSync(runs).find((n) => n.endsWith('.verify'));
  rmSync(join(runs, name, 'stage.json'));
  await assert.rejects(exportRun({ engine: REPO, journal: root, item: 'trial' }), (e) => /stage record \(stage\.json\)/.test(e.message) && e.message.includes(name), 'refused naming the run and stage.json');

  const eng = tempDir('noexplain');
  for (const p of ['package.json', 'packages', 'workflows']) cpSync(join(REPO, p), join(eng, p), { recursive: true, filter: (s) => !s.includes('node_modules') });
  symlinkSync(join(REPO, 'node_modules'), join(eng, 'node_modules'));
  rmSync(join(eng, 'packages/engine/src/explain.js'));
  await assert.rejects(exportRun({ engine: eng, journal: ADOPT, item: 'trial' }), /cannot explain its transitions \(no packages\/engine\/src\/explain\.js\)/);

  const { build } = await imp(REPO, 'scripts/inspector/build.mjs');
  const config = join(tempDir('conf'), 'sources.json');
  writeFileSync(config, JSON.stringify({ sources: [
    { origin: 'v', kind: 'real', engine: REPO, journal: root, label: 'no stage record' },
    { origin: 'v', kind: 'real', engine: eng, journal: ADOPT, label: 'no explain' },
    { origin: 'v', kind: 'real', engine: REPO, journal: ADOPT, label: 'adopt intact' }
  ] }));
  const out = tempDir('out');
  const r = await build({ config, out, captureDir: tempDir('cap') });
  console.log('build', JSON.stringify(r));
  assert.equal(r.runs, 1, 'only the intact source is built');
  assert.ok(r.skipped.some((s) => s.startsWith('no stage record: ') && /stage\.json/.test(s)), 'skipped by name: no stage record');
  assert.ok(r.skipped.some((s) => s.startsWith('no explain: ') && /explain\.js/.test(s)), 'skipped by name: no explain');
  assert.ok(existsSync(join(out, 'index.html')));
});
