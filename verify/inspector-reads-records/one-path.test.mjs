// Expect line one-path of plan item inspector-reads-records. A scratch copy of the checkout has spec.js stop checking
// the needs of a transition's target; nothing under scripts/inspector/ is touched. The tourney Q3 item is cut before
// the first build's result (building's way to verifying needs ciGreen, which fails, so the item goes to checking), and
// that result is offered with the host's restore and applyEvent, then exported, on the checkout and on the scratch copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { REPO, imp, rowsOf, scenarioItems, tempDir } from './lib.mjs';

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
