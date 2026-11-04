// Expect generic (plan/items/workflow-inspector.md): scripts/inspector/ names no state, actor or workflow; the graph is
// drawn from the workflow JSON for every file in workflows/ and lane A's workflows; model actors are found from run
// folders. The grep half runs anywhere; the exporter and page halves need the lane checkouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skipReason, buildPage, playwright, REPO, LANE_A, LANE_C } from './lib.mjs';

const skip = skipReason();
const wfDirs = [join(REPO, 'workflows'), join(LANE_A, 'workflows'), join(LANE_C, 'workflows')].filter(existsSync);
const wfFiles = wfDirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => join(d, f)));

/** Every state (dotted path) and transition count of an XState JSON, walked here independently of the exporter. */
function shape(spec) {
  const states = []; let transitions = 0; const names = new Set([spec.id]);
  const count = (l) => (l == null ? 0 : [l].flat().length);
  const walk = (s, path) => {
    for (const [n, c] of Object.entries(s.states ?? {})) {
      const id = [...path, n].join('.'); states.push(id); names.add(n);
      for (const l of Object.values(c.on ?? {})) transitions += count(l);
      for (const l of Object.values(c.after ?? {})) transitions += count(l);
      transitions += count(c.always) + count(c.onDone);
      for (const i of [c.invoke ?? []].flat()) { transitions += count(i.onDone) + count(i.onError); if (i.id) names.add(i.id); if (typeof i.src === 'string') names.add(i.src); }
      walk(c, [...path, n]);
    }
  };
  walk(spec, []);
  for (const l of Object.values(spec.on ?? {})) transitions += count(l);
  return { states, transitions, names };
}

// Code only: comments dropped, and for page.html only its <script>.
function codeOf(path) {
  let t = readFileSync(path, 'utf8');
  if (path.endsWith('.html')) t = (t.match(/<script>([\s\S]*?)<\/script>/g) ?? []).join('\n');
  return t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
}

test('generic: scripts/inspector/ code names no state, actor or workflow of any workflow file', () => {
  const names = new Set(); for (const f of wfFiles) for (const n of shape(JSON.parse(readFileSync(f, 'utf8'))).names) names.add(n);
  for (const f of wfFiles) names.add(f.split('/').pop().replace(/\.json$/, ''));
  assert.ok(names.size > 10, `only ${names.size} names gathered`);
  const dir = join(REPO, 'scripts/inspector');
  const files = readdirSync(dir).filter((f) => /\.(mjs|html)$/.test(f)).map((f) => join(dir, f));
  // Hits read one by one on 2026-11-04 and found not to name a workflow's state, actor or file:
  const READ = {
    'build.mjs: out (.out)': 'opt.out, the --out flag',
    'check-page.mjs: out (.out)': 'opt.out, the --out flag',
    'export.mjs: out (.out)': 'opt.out, the --out flag',
    'export.mjs: write (.write)': 'process.stdout.write',
    "export.mjs: done ('done')": 'the edge kind for invoke onDone and xstate.done.actor events (XState vocabulary)',
    "export.mjs: final ('final')": "XState's state type 'final'",
    'export.mjs: brief (, brief:)': "run.json's brief field (the engine's input.brief convention), dropped from the shown run values",
    "page.html: done ('done')": 'the edge kind for invoke onDone (XState vocabulary)',
    'page.html: final (.final)': "a run's final state value (r.final)",
    'page.html: building ("building")': 'an example inside help prose explaining JSON-encoded state strings'
  };
  const hits = [];
  for (const f of files) {
    const code = codeOf(f);
    for (const n of names) {
      const e = n.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
      // As a whole string literal, a property access or key, or a state path piece.
      const re = new RegExp(`(['"\`])${e}\\1|\\.${e}\\b(?!\\.(md|json|js))|[{,]\\s*${e}\\s*:|'#?[\\w-]*\\.${e}'`);
      const m = code.match(re);
      const h = `${f.split('/').pop()}: ${n} (${m?.[0]})`;
      if (m && !READ[h]) hits.push(h);
    }
  }
  console.log(`checked ${names.size} names in ${files.length} files`);
  assert.deepEqual(hits, []);
});

test('generic: the exporter draws every state and way out of every workflow file, with no run', { skip: wfFiles.length < 7 ? 'lane checkouts absent' : false, timeout: 120000 }, () => {
  const rows = [];
  for (const f of wfFiles) {
    const spec = JSON.parse(readFileSync(f, 'utf8'));
    const want = shape(spec);
    // A journal of one row: the item starts in the workflow's initial state. Nothing else is known to the exporter.
    const root = mkdtempSync(join(tmpdir(), 'wi-generic-'));
    mkdirSync(join(root, 'items'));
    const name = f.split('/').pop().replace(/\.json$/, '');
    writeFileSync(join(root, 'items/x.jsonl'), JSON.stringify({ v: 1, id: 'x#0', at: '2026-11-04T00:00:00.000Z', kind: 'engine.transition', item: 'x', state: JSON.stringify(spec.initial), payload: { transition: 'x#0', seq: 0, outcome: 'applied', reason: null, workflow: name, event: { type: 'xstate.init', input: {} }, run: null, from: null, hash: '000000000000' } }) + '\n');
    const engine = f.split('/workflows/')[0];
    const b = JSON.parse(execFileSync(process.execPath, [join(REPO, 'scripts/inspector/export.mjs'), '--engine', engine, '--journal', root, '--workflow', f, '--item', 'x'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
    const g = b.graph;
    assert.deepEqual(g.nodes.map((n) => n.id).sort(), [...want.states].sort(), `${f}: states`);
    assert.equal(g.edges.length, want.transitions, `${f}: ways out`);
    const lost = g.edges.filter((e) => e.rawTarget != null && e.to == null);
    assert.deepEqual(lost, [], `${f}: targets that did not resolve`);
    rows.push(`${f}: ${want.states.length} states, ${want.transitions} ways out`);
  }
  console.log(rows.join('\n'));
});

test('generic: the page maps every workflow file and finds model actors from run folders', { skip, timeout: 300000 }, async () => {
  const { url } = buildPage();
  const { chromium } = playwright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url);
    const shelf = await page.evaluate(() => window.INSPECTOR_DATA.shelf.map((w) => ({ id: w.id, file: w.file })));
    for (const f of wfFiles) {
      const w = shelf.find((x) => x.file === f);
      assert.ok(w, `${f} is not on the page's workflow list`);
      await page.goto(url + '#wf=' + encodeURIComponent(w.id)); await page.reload();
      const drawn = await page.$$eval('#graph [data-state]', (gs) => gs.map((g) => g.dataset.state));
      assert.deepEqual([...new Set(drawn)].sort(), shape(JSON.parse(readFileSync(f, 'utf8'))).states.sort(), `${f}: map states`);
    }
    // Model actors: exactly the started actors whose run folder has brief.md.
    const runs = await page.evaluate(() => window.INSPECTOR_DATA.runs.map((r) => r.id));
    let models = 0, hosts = 0; const folders = new Set();
    for (const id of runs) {
      await page.goto(url + '#run=' + encodeURIComponent(id)); await page.reload();
      const actors = await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; });
        return Array.from(document.querySelectorAll('#steps .actor')).map((a) => ({ model: /model agent/.test(a.querySelector('header').textContent), folder: Array.from(a.querySelectorAll('p.small')).find((p) => /Run folder:/.test(p.textContent))?.querySelector('code')?.textContent ?? null })); });
      for (const a of actors) {
        if (a.model) { models++; folders.add(a.folder); assert.ok(a.folder && existsSync(join(a.folder, 'brief.md')), `${id}: model actor without brief.md at ${a.folder}`); } else hosts++;
      }
    }
    // And the converse: every run folder with brief.md in these journals is shown as a model actor.
    const roots = new Set([...folders].map((f) => f.split('/items/')[0]));
    for (const r of roots) for (const it of readdirSync(join(r, 'items'))) {
      const rd = join(r, 'items', it, 'runs'); if (!existsSync(rd)) continue;
      for (const d of readdirSync(rd)) if (existsSync(join(rd, d, 'brief.md'))) assert.ok(folders.has(join(rd, d)), `${join(rd, d)} has brief.md but no model actor on the page`);
    }
    assert.ok(models >= 9, `only ${models} model actors`);
    console.log(`${runs.length} runs: ${models} model actors (each with brief.md), ${hosts} host actors`);
  } finally { await browser.close(); }
});
