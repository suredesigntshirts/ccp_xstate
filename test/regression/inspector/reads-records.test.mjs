// Expect: inspector-reads-records/explained, inspector-reads-records/true-to-record, inspector-reads-records/one-path, inspector-reads-records/no-guessing, inspector-reads-records/page, inspector-reads-records/explain-tests
// The inspector reads the engine's own records: every step of every committed and scenario journal is the engine's explain, model runs come from run folders, one change to the engine changes machine and page alike, a run without its stage record is refused by name, and the page renders every source.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const SCENARIOS = ['Q1', 'Q3', 'Q5', 'R1'];
const TRIALS = ['adopt', 'blocked-retry', 'fail', 'blocked'].map((t) => `tournaments/2026-11-04-stage-contract/trials/${t}/journal`);

const imp = (repo, p) => import(pathToFileURL(join(repo, p)).href);
const tempDir = (tag) => mkdtempSync(join(tmpdir(), `irr-${tag}-`));

const rowsOf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** Every item journal the checkout commits: [{ root, item, file }] for each <root>/items/<item>.jsonl git tracks. */
function committedItems(repo = REPO) {
  const out = execFileSync('git', ['-C', repo, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return out.split('\0').filter((f) => /(^|\/)items\/[^/]+\.jsonl$/.test(f)).sort().map((f) => {
    const root = join(repo, dirname(dirname(f)));
    return { root, item: f.split('/').pop().replace(/\.jsonl$/, ''), file: join(repo, f), rel: f };
  });
}

/** Item journals with at least one engine.transition row (the ones the inspector can replay). */
const withTransitions = (list) => list.filter((x) => rowsOf(x.file).some((r) => r.kind === 'engine.transition'));

// Every folder under dir (up to four levels) that holds items/*.jsonl.
function rootsUnder(dir) {
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
function scenarioItems(name, repo = REPO) {
  const dir = tempDir(`scn-${name}`);
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  execFileSync(process.execPath, ['--test', '--test-reporter=dot', `packages/engine/test/tourney/${name}.test.js`], {
    cwd: repo, env: { ...env, TMPDIR: dir, TMP: dir, TEMP: dir }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000
  });
  return rootsUnder(dir).flatMap((root) => readdirSync(join(root, 'items')).filter((n) => n.endsWith('.jsonl')).sort()
    .map((n) => ({ root, item: n.replace(/\.jsonl$/, ''), file: join(root, 'items', n), rel: `${name}:${root.slice(dir.length + 1)}/items/${n}` })));
}

/** The state node at dotted path key of spec ("a.b" -> spec.states.a.states.b). */
const nodeAt = (spec, key) => key.split('.').reduce((st, k) => st?.states?.[k], spec);

/** The active leaves of a snapshot value. */
const leaves = (v, p = '') => (v == null ? [] : typeof v === 'string' ? [p ? `${p}.${v}` : v] : Object.entries(v).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k)));

/** xstate as Node resolves it for the checkout's engine (the same module instance its spec.js imports). */
const xstateOf = (repo = REPO) => import(pathToFileURL(join(repo, 'node_modules/xstate/dist/xstate.cjs.mjs')).href);

const UPWARD = "const upward = (key) => key.split('.').map((_, i, parts) => parts.slice(0, parts.length - i).join('.'));";
const FAILING = 'const failing = failingOf(spec, t.def, target, scope);';
const MUTATIONS = {
  intact: (src) => src,
  'ancestors first': (src) => src.replace(UPWARD, UPWARD.replace(/;$/, '.reverse();')),
  'needs skipped': (src) => src.replace(FAILING, 'const failing = failingOf(spec, t.def, null, scope);')
};

function runIn(name) {
  const dir = join(tempDir('wt'), 'repo');
  execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '--detach', dir, 'HEAD'], { stdio: 'ignore' });
  try {
    symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
    const file = join(dir, 'packages/engine/src/explain.js');
    const src = readFileSync(file, 'utf8');
    const mutated = MUTATIONS[name](src);
    if (name !== 'intact') assert.notEqual(mutated, src, `mutation ${name} applied`);
    writeFileSync(file, mutated);
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'packages/engine/test/explain.test.js'], { cwd: dir, env, encoding: 'utf8', timeout: 600000 });
    const out = r.stdout ?? '';
    return {
      code: r.status,
      pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? NaN),
      fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? NaN),
      red: out.split('\n').filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''))
    };
  } finally {
    execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', dir], { stdio: 'ignore' });
  }
}

test('explain-tests: the builder\'s explain tests pass intact and go red under each mutation', () => {
  const results = Object.fromEntries(Object.keys(MUTATIONS).map((m) => [m, runIn(m)]));
  console.log('explain-tests', JSON.stringify(results));
  assert.equal(results.intact.code, 0, 'intact passes');
  assert.equal(results.intact.fail, 0);
  for (const m of ['ancestors first', 'needs skipped']) {
    assert.notEqual(results[m].code, 0, `${m}: red`);
    assert.ok(results[m].fail > 0, `${m}: a test fails`);
  }
});

const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

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

const NEEDS = 'target?.meta?.needs ?? []';

function scratchCopy() {
  const dir = tempDir('mutant');
  for (const p of ['package.json', 'packages', 'plugins', 'workflows', 'scripts']) {
    cpSync(join(REPO, p), join(dir, p), { recursive: true, filter: (src) => !src.includes('node_modules') });
  }
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

const filesUnder = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? filesUnder(join(d, n)) : [join(d, n)]));
const digest = (d) => Object.fromEntries(filesUnder(d).map((f) => [relative(d, f), createHash('sha256').update(readFileSync(f)).digest('hex')]));

// Offer the cut item's next event on engine checkout `repo`, then export it there.
async function offerAndExport(repo, cut, row) {
  const root = tempDir('offer');
  cpSync(cut, root, { recursive: true });
  const index = await imp(repo, 'packages/engine/src/index.js');
  const { exportRun } = await imp(repo, 'scripts/inspector/export.mjs');
  const spec = index.workflowOf(root, 'q3');
  const host = index.restore({ root, item: 'q3', spec, session: row.session, release: row.release });
  const out = index.applyEvent(host, { event: row.payload.event, source: row.source, run: row.payload.run, at: row.at });
  index.persist(host, [out.row]);
  const bundle = await exportRun({ engine: repo, journal: root, item: 'q3' });
  return { outcome: out.outcome, state: host.snapshot.value, step: bundle.steps.at(-1) };
}

test('one-path: dropping needs in spec.js changes the machine and the bundle alike, scripts/inspector untouched', async () => {
  const q3 = scenarioItems('Q3').find((x) => x.item === 'q3');
  assert.ok(q3, 'Q3 leaves item q3');
  const rows = rowsOf(q3.file);
  const at = rows.findIndex((r) => r.kind === 'engine.transition' && r.payload.seq === 2);
  const row = rows[at];
  assert.equal(row.payload.event.type, 'xstate.done.actor.build');
  assert.equal(JSON.parse(row.state), 'checking', 'on the checkout Q3 goes to checking at seq 2');
  const cut = tempDir('cut');
  cpSync(q3.root, cut, { recursive: true });
  writeFileSync(join(cut, 'items', 'q3.jsonl'), rows.slice(0, at).map((r) => JSON.stringify(r) + '\n').join(''));

  const mutant = scratchCopy();
  const before = digest(join(mutant, 'scripts/inspector'));
  assert.deepEqual(before, digest(join(REPO, 'scripts/inspector')), 'the scratch copy has the same inspector');
  const specFile = join(mutant, 'packages/engine/src/spec.js');
  const src = readFileSync(specFile, 'utf8');
  assert.equal(src.split(NEEDS).length - 1, 1, 'spec.js reads a target\'s needs in one place');
  writeFileSync(specFile, src.replace(`, ...(${NEEDS})`, ''));
  assert.notEqual(readFileSync(specFile, 'utf8'), src, 'the mutation applied');

  const intact = await offerAndExport(REPO, cut, row);
  const broken = await offerAndExport(mutant, cut, row);
  assert.deepEqual(digest(join(mutant, 'scripts/inspector')), before, 'nothing under scripts/inspector changed');

  console.log('intact', JSON.stringify({ outcome: intact.outcome, state: intact.state, tried: intact.step.candidates.map((c) => [c.id, c.to, c.failing, c.taken]) }));
  console.log('broken', JSON.stringify({ outcome: broken.outcome, state: broken.state, tried: broken.step.candidates.map((c) => [c.id, c.to, c.failing, c.taken]) }));
  assert.equal(intact.outcome, 'applied');
  assert.equal(broken.outcome, 'applied');
  assert.equal(intact.state, 'checking');
  assert.equal(broken.state, 'verifying', 'without needs the machine verifies a PR whose CI is not green');
  const toVerifying = (s) => s.step.candidates.find((c) => c.to === 'verifying');
  assert.deepEqual(toVerifying(intact).failing, ['ciGreen']);
  assert.equal(toVerifying(intact).taken, false);
  assert.ok(intact.step.candidates.some((c) => c.to === 'checking' && c.taken), 'intact: the way to checking is taken');
  assert.deepEqual(toVerifying(broken).failing, []);
  assert.equal(toVerifying(broken).taken, true);
  assert.equal(broken.step.candidates.length, 1, 'broken: explain stops at the way to verifying');
  assert.notDeepEqual(broken.step.candidates, intact.step.candidates, 'the bundle\'s tried list changed');
  assert.equal(intact.step.edge.to, 'checking');
  assert.equal(broken.step.edge.to, 'verifying');
});

const PW = ['/opt/node-tools/node_modules/playwright/index.mjs', '/opt/node22/lib/node_modules/playwright/index.mjs'].find(existsSync) ?? null;
const CHROME = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const { build } = await imp(REPO, 'scripts/inspector/build.mjs');
const out = tempDir('page');
const conf = JSON.parse(readFileSync(join(REPO, 'scripts/inspector/sources.json'), 'utf8'));
const built = await build({ config: join(REPO, 'scripts/inspector/sources.json'), out, captureDir: tempDir('cap') });

test('page: every source of sources.json is built, none skipped', () => {
  console.log('built', JSON.stringify({ runs: built.runs, skipped: built.skipped, sources: conf.sources.length }));
  assert.deepEqual(built.skipped, []);
  const data = JSON.parse(readFileSync(join(out, 'data.js'), 'utf8').replace(/^window\.INSPECTOR_DATA = /, '').replace(/;\n$/, ''));
  for (const s of conf.sources) assert.ok(data.runs.some((r) => r.label.startsWith(s.label)), `source ${s.label} has a run`);
  for (const r of data.runs) for (const s of r.steps) for (const a of s.actors) if (a.model) assert.equal(typeof a.layers.l2.text, 'string', `${r.id} ${a.effect}: prompt text`);
});

test('page: every run, step, way out and model prompt renders at 1280 and 390 px with no error', { skip: PW ? false : 'Playwright is not installed' }, async () => {
  const { chromium } = await import(pathToFileURL(PW).href);
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const problems = [];
  const seen = { steps: 0, waysOut: 0, prompts: 0 };
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width}px console: ${m.text()}`); });
      page.on('pageerror', (e) => problems.push(`${width}px page error: ${e.message}`));
      await page.goto(pathToFileURL(join(out, 'index.html')).href);
      const runs = await page.evaluate(() => window.INSPECTOR_DATA.runs.map((r) => ({
        id: r.id,
        steps: r.steps.map((s) => ({ ways: s.candidates.map((c) => c.stays ? c.from : c.to), prompts: s.actors.filter((a) => a.model).map((a) => a.layers.l2.text) }))
      })));
      for (const r of runs) {
        for (const [i, s] of r.steps.entries()) {
          await page.evaluate(([id, i]) => { location.hash = `run=${id}&step=${i}`; dispatchEvent(new PopStateEvent('popstate')); }, [r.id, i]);
          const text = await page.evaluate((i) => {
            const el = document.getElementById(`step-${i}`);
            if (!el) return null;
            el.querySelectorAll('details').forEach((d) => { d.open = true; });
            return el.innerText;
          }, i);
          if (text == null) { problems.push(`${width}px ${r.id} step ${i}: not rendered`); continue; }
          seen.steps++;
          for (const w of s.ways) {
            const name = w.split('.').pop();
            if (!text.includes(name)) problems.push(`${width}px ${r.id} step ${i}: way out to ${w} not shown`);
            seen.waysOut++;
          }
          for (const p of s.prompts) {
            const line = p.split('\n').map((l) => l.trim()).find((l) => l.length > 20 && !/^[#`{\["]/.test(l)) ?? p.trim().slice(0, 40);
            const probe = line.slice(0, 40);
            if (!text.replace(/\s+/g, ' ').includes(probe.replace(/\s+/g, ' '))) problems.push(`${width}px ${r.id} step ${i}: prompt not shown (${probe})`);
            seen.prompts++;
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('page', JSON.stringify(seen), problems.slice(0, 20));
  assert.deepEqual(problems, []);
  assert.ok(seen.waysOut > 0 && seen.prompts > 0);
});

test('page: check-page.mjs passes on the build', { skip: PW ? false : 'Playwright is not installed' }, () => {
  const said = execFileSync(process.execPath, [join(REPO, 'scripts/inspector/check-page.mjs'), '--out', out, '--playwright', PW, ...(CHROME ? ['--chrome', CHROME] : [])], { encoding: 'utf8', timeout: 900000 });
  console.log(said.trim());
  assert.match(said, /page check: no console errors/);
});

const engine = await imp(REPO, 'packages/engine/src/index.js');
const names = await imp(REPO, 'packages/engine/src/names.js');
const { exportRun } = await imp(REPO, 'scripts/inspector/export.mjs');
const xstate = await xstateOf(REPO);

const committed = committedItems();
const replayable = withTransitions(committed);
const scenario = SCENARIOS.flatMap((n) => scenarioItems(n));
const all = [...replayable, ...scenario];

const bundles = new Map();
const bundleOf = async (x) => {
  if (!bundles.has(x.rel)) bundles.set(x.rel, await exportRun({ engine: REPO, journal: x.root, item: x.item }));
  return bundles.get(x.rel);
};

// The spec the item ran: the pinned bytes when its journal pins them (checked against the pin), else the bundle's.
const specOf = (x, bundle) => {
  const first = rowsOf(x.file).find((r) => r.kind === 'engine.transition' && r.payload?.seq === 0);
  const pin = String(first?.payload?.workflow ?? '').match(/^(.+)@([0-9a-f]{64})$/);
  if (pin && existsSync(join(x.root, 'blobs', pin[2]))) {
    const bytes = readFileSync(join(x.root, 'blobs', pin[2]));
    assert.equal(names.sha256(bytes), pin[2], `${x.rel}: blob hashes to its pin`);
    assert.equal(bundle.workflow.sha256, pin[2], `${x.rel}: the bundle replays the pinned bytes`);
    return { ...JSON.parse(bytes), id: first.payload.workflow };
  }
  return bundle.workflow.spec;
};

const tally = { items: 0, applied: 0, ignored: 0, triedChecked: 0, notTaken: 0, scenarioItems: scenario.length };

test('committed journals and scenario journals are found', () => {
  assert.ok(replayable.length >= 200, `committed replayable items: ${replayable.length}`);
  for (const t of TRIALS) assert.ok(replayable.some((x) => x.root === join(REPO, t)), `trial ${t} is among them`);
  for (const n of SCENARIOS) assert.ok(scenario.some((x) => x.rel.startsWith(`${n}:`)), `scenario ${n} left a journal`);
});

test('explained: every step is the engine\'s explain, XState agrees, and every tried way out fails as failingOf says', async () => {
  for (const x of all) {
    const bundle = await bundleOf(x);
    const spec = specOf(x, bundle);
    const machine = engine.machineOf(spec);
    const transitions = rowsOf(x.file).filter((r) => r.kind === 'engine.transition');
    assert.equal(bundle.steps.length, transitions.length, `${x.rel}: one step per transition row`);
    let snap = null;
    tally.items++;
    transitions.forEach((row, i) => {
      const p = row.payload;
      const step = bundle.steps[i];
      const where = `${x.rel} row ${i} (seq ${p.seq}, ${p.event?.type})`;
      assert.equal(step.seq, p.seq, where);
      if (p.event?.type === 'xstate.init') {
        if (p.outcome === 'applied') [snap] = xstate.initialTransition(machine, p.event.input);
        return;
      }
      if (!snap) return;
      const ex = engine.explain(spec, snap, p.event);
      const scope = { context: snap.context, event: p.event };
      // The bundle's ways out are explain's tried list, entry for entry.
      assert.deepEqual(step.candidates.map((c) => [c.id, c.from, c.to, c.taken, c.failing]), ex.tried.map((t) => [t.at, t.state, t.after, t.taken, t.failing]), `${where}: candidates are explain's tried`);
      // Each tried transition: its failing tests are failingOf's on the context before the step; only the last can be taken.
      ex.tried.forEach((t, j) => {
        const def = pointer(spec, t.at);
        const target = nodeAt(spec, t.after);
        const failing = engine.failingOf(spec, def, target, scope);
        assert.deepEqual(t.failing, failing, `${where}: ${t.at} failing`);
        assert.deepEqual(step.candidates[j].failing, failing, `${where}: bundle ${t.at} failing`);
        assert.equal(t.taken, failing.length === 0, `${where}: ${t.at} taken exactly when nothing fails`);
        if (j < ex.tried.length - 1) assert.ok(failing.length > 0, `${where}: only the last tried can be taken`);
        tally.triedChecked++;
        if (!t.taken) tally.notTaken++;
      });
      const [next] = xstate.transition(machine, snap, p.event);
      if (p.outcome === 'applied') {
        tally.applied++;
        assert.ok(ex.taken, `${where}: explain names a taken transition`);
        assert.equal(step.edge?.id, ex.taken, `${where}: the bundle's taken way out is explain's`);
        const t = ex.tried.at(-1);
        const lands = leaves(next.value);
        assert.ok(lands.some((l) => l === t.after || l.startsWith(`${t.after}.`)), `${where}: XState lands in ${lands} under ${t.after}`);
        assert.equal(engine.hashOf(next), p.hash, `${where}: XState's next snapshot hashes to the journal's`);
        snap = next;
      } else {
        tally.ignored++;
        // An event the engine did not apply: the bundle lists explain's tried, and none is taken, whenever explain
        // says the machine itself would not move (the host can turn away an event the machine would take).
        assert.equal(step.edge, null, `${where}: no taken edge for an event not applied`);
        if (!ex.taken) assert.ok(step.candidates.every((c) => !c.taken), `${where}: none taken`);
        else tally.hostTurnedAway = (tally.hostTurnedAway ?? 0) + 1;
      }
    });
  }
  console.log('explained', JSON.stringify(tally));
});

// The transition a JSON pointer names in the workflow file.
function pointer(spec, at) {
  return at.split('/').slice(1).map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~')).reduce((v, k) => v?.[k], spec);
}

test('true-to-record: model runs, prompt segments, context and hostWritten come from the run folders', async () => {
  const PIECE = { frame: 'template', workflow: 'workflow', input: 'input' };
  const counts = { bundles: 0, folders: 0, model: 0, notModel: 0, pieces: 0, contexts: 0, stamped: 0 };
  for (const x of all) {
    const bundle = await bundleOf(x);
    counts.bundles++;
    const runsDir = names.runsDir(x.root, x.item);
    const folders = existsSync(runsDir) ? readdirSync(runsDir) : [];
    const runActors = bundle.steps.flatMap((s) => s.actors.filter((a) => a.type === 'run'));
    // A run folder with stage.json is shown as a model run, and one without is not.
    for (const f of folders) {
      counts.folders++;
      const name = f;
      const a = runActors.find((r) => names.safe(String(r.effect).split(':').pop()) === name);
      const recorded = existsSync(join(runsDir, f, 'stage.json'));
      if (!a) { assert.ok(!recorded, `${x.rel}: run folder ${f} has stage.json but no run in the bundle`); continue; }
      assert.equal(a.model, recorded, `${x.rel}: ${f} model flag is stage.json present`);
    }
    for (const a of runActors) {
      if (!a.model) { counts.notModel++; continue; }
      counts.model++;
      const runName = String(a.effect).split(':').pop();
      const dir = join(runsDir, names.safe(runName));
      const stage = JSON.parse(readFileSync(join(dir, 'stage.json'), 'utf8'));
      const promptPath = names.promptFile(x.root, names.runId(x.item, runName));
      const prompt = readFileSync(promptPath, 'utf8');
      const L = a.layers;
      const where = `${x.rel} ${runName}`;
      assert.equal(L.l2.segments.map((s) => s.text).join(''), prompt, `${where}: segments joined are the prompt file byte for byte`);
      const pieces = Object.entries(stage.prompt.parts).flatMap(([part, list]) => list.filter((p) => p.text).map((p) => ({ part, ...p })));
      const gap = "the harness frame's part headings and line breaks, between the pieces the stage record names";
      const shown = L.l2.segments.filter((s) => s.note !== gap);
      assert.equal(shown.length, pieces.length, `${where}: one segment per stage.json piece`);
      shown.forEach((s, i) => {
        const p = pieces[i];
        assert.equal(s.text, p.text, `${where}: segment ${i} is piece ${p.part}[${i}]`);
        assert.ok(s.note.startsWith(`${p.part} part: `), `${where}: segment ${i} names part ${p.part}: ${s.note}`);
        const kind = p.source.frame != null ? 'frame' : p.source.workflow != null ? 'workflow' : p.source.input != null ? 'input' : 'unknown';
        assert.equal(s.from, PIECE[kind] ?? 'unknown', `${where}: segment ${i} from its source kind`);
        const key = kind === 'frame' ? p.source.frame : kind === 'workflow' ? (p.source.file ? `${p.source.file}:${p.source.line}` : 'workflow JSON') : `input ${p.source.input}`;
        assert.ok(s.note.includes(key), `${where}: segment ${i} label names its source ${key}: ${s.note}`);
        counts.pieces++;
      });
      const ctxFile = join(dir, 'context.md');
      if (existsSync(ctxFile)) {
        const text = readFileSync(ctxFile, 'utf8');
        assert.equal(L.l3.segments.map((s) => s.text).join(''), text, `${where}: context segments are context.md`);
        assert.equal(stage.context?.text, text, `${where}: context.md is the record's context piece`);
        assert.equal(L.l3.segments.length, 1, `${where}: one context segment, the record's`);
        counts.contexts++;
      }
      assert.deepEqual(L.l6.hostWritten.map((h) => h.path), stage.stamped ?? [], `${where}: hostWritten is stage.json stamped`);
      counts.stamped += (stage.stamped ?? []).length;
    }
  }
  console.log('true-to-record', JSON.stringify(counts));
  assert.ok(counts.model > 0);
});
