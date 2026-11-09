// Expect: stage-bench/same-prompt, stage-bench/edit-safe
// The stage bench and pinned replay: the prompt bench --prompt-only prints equals render() for the same workflow version
// and input, for each quick-fix model stage, a trial's pinned blob and every brief case; and with one brief rule edited in
// workflows/, every committed journal still replays on the blob it pinned and renders its prompt from that pin.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadWorkflow } from '../../../packages/engine/src/index.js';
import { render, stagesOf } from '../../../packages/engine/src/stages.js';
import { restore } from '../../../packages/engine/src/host.js';
import { promptFile } from '../../../packages/engine/src/names.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');
const ADOPT_PIN = '8dc9451a45169814fabaca1c7e91772f0ebf4452deb90aa57e1604750f2d394b';
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** What `scripts/bench/run.mjs ... --prompt-only` prints: the prompt the bench would send. */
const benchPrompt = (args, env = {}) =>
  execFileSync(process.execPath, [join(REPO, 'scripts/bench/run.mjs'), '--prompt-only', ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 26
  });

/** A copy of the adopt journal's blobs, so loadWorkflow never writes into the committed journal. */
function adoptBlobs() {
  const root = mkdtempSync(join(tmpdir(), 'v-sb-pin-'));
  cpSync(join(ADOPT, 'blobs'), join(root, 'blobs'), { recursive: true });
  return root;
}

const current = loadWorkflow('quick-fix', { dir: join(REPO, 'workflows') });
const pinned = loadWorkflow(`quick-fix@${ADOPT_PIN}`, { root: adoptBlobs(), dir: join(REPO, 'workflows') });
const mine = (spec, actor, input, run) => render({ actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run });
const RUNS = { brief: '0.brief', build: '1.build', verify: '3.verify' };

test('quick-fix has exactly the three model stages the recorded inputs cover', () => {
  assert.deepEqual(stagesOf(current).sort(), Object.keys(RUNS).sort());
});

for (const [actor, name] of Object.entries(RUNS)) {
  const runFile = join(ADOPT, 'items/trial/runs', name, 'run.json');
  const rec = readJson(runFile);
  test(`${actor}: bench --prompt-only on the recorded input equals my render(), current workflow`, () => {
    const got = benchPrompt(['--stage', actor, '--input', runFile, '--run-id', rec.run]);
    assert.equal(got, mine(current, actor, rec.input, rec.run));
  });
  test(`${actor}: bench --prompt-only on the trial's pinned blob equals my render()`, () => {
    const got = benchPrompt(['--stage', actor, '--input', runFile, '--run-id', rec.run, '--workflow', join(ADOPT, 'blobs', ADOPT_PIN)]);
    const r = mine(pinned, actor, rec.input, rec.run);
    assert.equal(got, r);
  });
}

test('brief: bench --prompt-only for every case equals my render() of the task literal plus the case input', () => {
  const task = current.states.briefing.invoke.input.task;
  assert.equal(typeof task?.value, 'string');
  const dir = join(REPO, 'bench/brief/cases');
  for (const id of readdirSync(dir).filter((n) => existsSync(join(dir, n, 'case.json')))) {
    const c = readJson(join(dir, id, 'case.json'));
    const got = benchPrompt(['--stage', 'brief', '--case', id]);
    const run = /"run": "([^"]+)"/.exec(got)?.[1];
    assert.ok(run, `${id}: a run id in the return line`);
    const input = Object.fromEntries(Object.entries(current.states.briefing.invoke.input).map(([k, v]) => [k, v && typeof v === 'object' && 'value' in v ? v.value : (c.input[k] ?? null)]));
    assert.equal(got, mine(current, 'brief', input, run), id);
  }
});


/** workflows/ copied to a temp folder with brief rule 2 changed by text replacement (a one-line diff). */
function editedWorkflows() {
  const dir = mkdtempSync(join(tmpdir(), 'v-sb-wf-'));
  // The rule's words live in the brief's stage file: the one-line diff is made there.
  cpSync(join(REPO, 'workflows'), dir, { recursive: true });
  const p = join(dir, 'quick-fix/brief.md');
  const t = readFileSync(p, 'utf8');
  const old = `- ${loadWorkflow('quick-fix').meta.actors.brief.rules[2]}\n`;
  assert.equal(t.split(old).length, 2, 'rule 2 text is unique in the file');
  writeFileSync(p, t.replace(old, `${old.trimEnd()} Keep each brief under 400 words.\n`));
  assert.notEqual(readFileSync(p, 'utf8'), t);
  return dir;
}

const roots = [...new Set(execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf8' }).split('\n')
  .filter((f) => /\/items\/[^/]+\.jsonl$/.test(f)).map((f) => f.replace(/\/items\/[^/]+\.jsonl$/, '')))].sort();

test('every committed journal replays on its pinned blob with a brief rule edited', () => {
  const dir = editedWorkflows();
  const edited = loadWorkflow('quick-fix', { dir });
  assert.ok(roots.length >= 3, `found ${roots.length} journal roots`);
  let items = 0, transitions = 0, onCurrentPin = 0;
  const unpinned = [];
  for (const r of roots) {
    const root = mkdtempSync(join(tmpdir(), 'v-sb-j-'));
    cpSync(join(REPO, r), root, { recursive: true });
    for (const f of readdirSync(join(root, 'items')).filter((f) => f.endsWith('.jsonl'))) {
      const item = f.slice(0, -'.jsonl'.length);
      const rows = readFileSync(join(root, 'items', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      const first = rows.find((x) => x.kind === 'engine.transition' && x.payload.outcome === 'applied' && x.payload.seq === 0);
      if (!first) continue;
      const pin = first.payload.workflow;
      if (!pin.includes('@')) {
        // From before pins existed (release 0.1.0): it names no bytes, and it does not replay on today's unedited
        // workflow either, so the edit cannot be what breaks it. Recorded, not replayed.
        assert.throws(() => restore({ root, item, spec: loadWorkflow(pin), session: 'v', release: '0' }), /the workflow changed/);
        unpinned.push(`${r}/${item}`);
        continue;
      }
      assert.notEqual(pin, edited.id, `${r}/${item} is not pinned to the edited bytes`);
      const spec = loadWorkflow(pin, { root, dir });
      const host = restore({ root, item, spec, session: 'v', release: '0' });
      const applied = rows.filter((x) => x.kind === 'engine.transition' && x.payload.outcome === 'applied').length;
      assert.ok(applied >= 1 && host.snapshot, `${r}/${item} restored`);
      items++; transitions += applied;
      // The pin is what decides the prompt: a brief run's committed prompt is render() on the pinned blob, and the
      // edited spec renders it differently (so the edit is real and replay did not silently read the edited file).
      const bdir = join(root, 'items', item, 'runs');
      const briefRun = existsSync(bdir) ? readdirSync(bdir).find((n) => n.endsWith('.brief')) : null;
      if (briefRun) {
        const rj = JSON.parse(readFileSync(join(bdir, briefRun, 'run.json'), 'utf8'));
        const args = (s) => ({ actor: 'brief', schema: s.meta.actors.brief, input: rj.input, defs: s.meta.schemas ?? {}, run: rj.run });
        assert.equal(render(args(spec)), readFileSync(promptFile(root, rj.run), 'utf8'), `${r}/${item} prompt`);
        assert.notEqual(render(args(edited)), render(args(spec)), `${r}/${item}: edited rule changes the prompt`);
        onCurrentPin++;
      }
    }
  }
  console.log(`replayed ${items} items, ${transitions} applied transitions, ${roots.length} roots; ${onCurrentPin} brief runs re-rendered from their pin; unpinned, not replayable before the edit either: ${unpinned.join(', ') || 'none'}`);
  assert.ok(items >= 3 && onCurrentPin >= 1);
});
