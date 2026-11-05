// Expect same-prompt: for every model stage of the three workflows and a recorded or made-up input, render() on the
// workflow loaded from its files gives byte for byte the prompt it gave on the base commit's workflow JSON; and for
// every committed run folder whose journal pins a blob, render() on that blob still gives its committed brief.md.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { loadWorkflow } from '../../packages/engine/src/index.js';
import { REPO, STAGES, WORKFLOWS, baseWorkflows, inputFor, load, readJson, renderOn } from './lib.mjs';

const baseDir = baseWorkflows();
const headDir = join(REPO, 'workflows');

// Every committed run folder: { folder, root, item, run.json } (bench runs, the stage-contract trials).
const journals = execFileSync('git', ['-C', REPO, 'ls-files', '*/items/*.jsonl'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const pinOf = (abs) => readFileSync(abs, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .find((r) => r.kind === 'engine.transition' && r.payload?.seq === 0 && r.payload?.outcome === 'applied')?.payload?.workflow ?? null;
const runFolders = [];
for (const j of journals) {
  const abs = join(REPO, j);
  const root = dirname(dirname(abs));
  const item = j.split('/').at(-1).replace(/\.jsonl$/, '');
  const runs = join(root, 'items', item, 'runs');
  if (!existsSync(runs)) continue;
  for (const n of readdirSync(runs)) {
    const rj = join(runs, n, 'run.json');
    if (existsSync(rj) && existsSync(join(runs, n, 'brief.md'))) runFolders.push({ folder: join(runs, n), root, item, pin: pinOf(abs), rec: readJson(rj) });
  }
}

/** A made-up value for an input: distinct per name, nested, with characters JSON escapes. */
const madeUp = (k) => k === 'task' ? `Made-up task for ${k}: do "the thing" \\ then return.` : ({ note: `made-up ${k} "quoted" \\ back`, n: k.length, list: [k, null, true], nested: { url: `https://example.invalid/${k}` } });

for (const w of WORKFLOWS) {
  const base = load(w, baseDir);
  const head = load(w, headDir);
  for (const actor of STAGES[w]) {
    test(`${w} ${actor}: made-up input renders the same on base JSON and head files`, () => {
      const names = Object.keys(inputFor(base, actor));
      assert.deepEqual(Object.keys(inputFor(head, actor)), names, 'same wired inputs');
      const made = Object.fromEntries(names.map((k) => [k, madeUp(k)]));
      const run = `v-${w}-${actor}:0.${actor}`;
      const a = renderOn(base, actor, inputFor(base, actor, made), run);
      const b = renderOn(head, actor, inputFor(head, actor, made), run);
      assert.ok(a.length > 500, 'a real prompt');
      assert.equal(b, a);
      // and with every input but the task null (a first attempt: why, base, branch null)
      const onlyTask = { task: made.task };
      assert.equal(renderOn(head, actor, inputFor(head, actor, onlyTask), run), renderOn(base, actor, inputFor(base, actor, onlyTask), run), 'null inputs');
    });
    const recorded = runFolders.filter((r) => r.rec.actor === actor && String(r.pin ?? r.rec.workflow).startsWith(`${w}@`));
    if (recorded.length) test(`${w} ${actor}: ${recorded.length} recorded run inputs render the same on base JSON and head files`, () => {
      for (const r of recorded) {
        const a = renderOn(base, actor, inputFor(base, actor, r.rec.input), r.rec.run);
        const b = renderOn(head, actor, inputFor(head, actor, r.rec.input), r.rec.run);
        assert.equal(b, a, r.folder);
      }
    });
  }
}

test('every committed run folder whose journal pins a blob: render() on that blob gives its committed brief.md', () => {
  let n = 0;
  const pins = new Set();
  for (const r of runFolders) {
    if (!/@[0-9a-f]{64}$/.test(r.pin ?? '')) continue;
    const spec = loadWorkflow(r.pin, { root: r.root, dir: headDir });
    assert.equal(spec.id, r.pin);
    const got = renderOn(spec, r.rec.actor, r.rec.input, r.rec.run);
    assert.equal(got, readFileSync(join(r.folder, 'brief.md'), 'utf8'), r.folder);
    n++; pins.add(r.pin);
  }
  console.log(`rendered ${n} committed run folders from ${pins.size} pinned blobs`);
  assert.ok(n >= 30, `saw ${n}`);
});
