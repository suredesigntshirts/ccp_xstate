// Expect edit-safe (the replay half): with one rule of meta.actors.brief changed, every committed journal still
// replays, on the workflow blob it pinned. The npm-test half is run by hand on a scratch clone (see verdict.json).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadWorkflow } from '../../packages/engine/src/index.js';
import { restore } from '../../packages/engine/src/host.js';
import { render } from '../../packages/engine/src/stages.js';
import { REPO } from './lib.mjs';

/** workflows/ copied to a temp folder with brief rule 2 changed by text replacement (a one-line diff). */
function editedWorkflows() {
  const dir = mkdtempSync(join(tmpdir(), 'v-sb-wf-'));
  for (const f of readdirSync(join(REPO, 'workflows'))) cpSync(join(REPO, 'workflows', f), join(dir, f));
  const p = join(dir, 'quick-fix.json');
  const t = readFileSync(p, 'utf8');
  const old = JSON.stringify(JSON.parse(t).meta.actors.brief.rules[2]);
  assert.equal(t.split(old).length, 2, 'rule 2 text is unique in the file');
  writeFileSync(p, t.replace(old, JSON.stringify(JSON.parse(old) + ' Keep each brief under 400 words.')));
  assert.notEqual(readFileSync(p, 'utf8'), t);
  return dir;
}

const roots = [...new Set(execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf8' }).split('\n')
  .filter((f) => /\/items\/[^/]+\.jsonl$/.test(f)).map((f) => f.replace(/\/items\/[^/]+\.jsonl$/, '')))].sort();

test('every committed journal replays on its pinned blob with a brief rule edited', () => {
  const dir = editedWorkflows();
  const edited = loadWorkflow('quick-fix', { dir });
  assert.ok(roots.length >= 28, `found ${roots.length} journal roots`);
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
      // The pin is what decides the prompt: a brief run's committed brief.md is render() on the pinned blob, and the
      // edited spec renders it differently (so the edit is real and replay did not silently read the edited file).
      const bdir = join(root, 'items', item, 'runs');
      const briefRun = existsSync(bdir) ? readdirSync(bdir).find((n) => n.endsWith('.brief')) : null;
      if (briefRun) {
        const rj = JSON.parse(readFileSync(join(bdir, briefRun, 'run.json'), 'utf8'));
        const args = (s) => ({ actor: 'brief', schema: s.meta.actors.brief, input: rj.input, defs: s.meta.schemas ?? {}, run: rj.run });
        assert.equal(render(args(spec)), readFileSync(join(bdir, briefRun, 'brief.md'), 'utf8'), `${r}/${item} brief.md`);
        assert.notEqual(render(args(edited)), render(args(spec)), `${r}/${item}: edited rule changes the prompt`);
        onCurrentPin++;
      }
    }
  }
  console.log(`replayed ${items} items, ${transitions} applied transitions, ${roots.length} roots; ${onCurrentPin} brief runs re-rendered from their pin; unpinned, not replayable before the edit either: ${unpinned.join(', ') || 'none'}`);
  assert.ok(items >= 27 && onCurrentPin >= 1);
  assert.deepEqual(unpinned, ['verify/engine-host/one-owner-evidence/own-1']);
});
