// C-builder-cannot-change-own-workflow (plan/cases/work-item.md): given an item in progress, when its builder changes
// the item's workflow selection or the workflow file it runs, then the item keeps running the workflow and hash
// recorded when it was filed. Met by the stage-contract engine (lane A, 4.3: the pin): the item's first row names
// `quick-fix@<sha256>`, the bytes are stored under the root, and the host restores from them. It was a gap given to
// fix-workflow-pinned (gaps.json); the verifier's characterisation test of the gap is replaced by this one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkflow, workflowOf, restore } from '../../src/index.js';
import { A, B, BRIEFS, agents, fresh, offer, pr, start, transitions, verdict, world } from './world.js';

const REPO_QF = new URL('../../../../workflows/quick-fix.json', import.meta.url);

test('C-builder-cannot-change-own-workflow: the filed workflow and hash are journalled, and an edited file changes nothing the item runs', async () => {
  const root = fresh();
  const dir = join(root, 'workflows');
  mkdirSync(dir);
  const bytes = readFileSync(REPO_QF);
  writeFileSync(join(dir, 'quick-fix.json'), bytes);
  const filed = loadWorkflow('quick-fix', { root, dir });
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(filed.id, `quick-fix@${hash}`);

  const host = restore({ root, item: 'it-1', spec: filed, session: 'owner', release: '0.2.0' });
  const a = agents({ brief: BRIEFS, build: [pr(A), pr(B), pr(B)], verify: [verdict('FAIL', A)] });
  await offer(host, [start()], world({ actors: a.byActor }));
  assert.equal(host.snapshot.value, 'verifying', 'one FAIL, rebuilt, verifying again');
  const first = transitions(root).find((r) => r.payload.seq === 0);
  assert.equal(first.payload.workflow, filed.id, 'the filing row names the workflow and its hash');
  assert.equal(readFileSync(join(root, 'blobs', hash), 'utf8'), bytes.toString('utf8'), 'and its bytes are kept');

  // The builder edits the file: unlimited builds.
  const looser = JSON.parse(bytes);
  looser.meta.guards.buildsLeft = [];
  writeFileSync(join(dir, 'quick-fix.json'), JSON.stringify(looser));
  assert.notEqual(loadWorkflow('quick-fix', { dir }).id, filed.id);

  // The host restores the item on the filed workflow, whatever the file says now.
  const spec = workflowOf(root, 'it-1');
  assert.equal(spec.id, filed.id);
  assert.deepEqual(spec.meta.guards.buildsLeft, JSON.parse(bytes).meta.guards.buildsLeft);
  // bin/host.js and deliver() (the hooks) restore every item through workflowOf, so this is the spec the item runs.

  // And it runs the filed rules: a second FAIL replans; no third build.
  const again = restore({ root, item: 'it-1', spec, session: 'owner', release: '0.2.0' });
  const run = [...again.runs.values()].find((r) => r.actor === 'verify');
  await offer(again, [{ event: { type: `xstate.done.actor.${run.invoke}`, output: verdict('FAIL', B) }, run: run.id, source: { system: 'harness', ref: 'v2' } }], world({ actors: a.byActor }));
  assert.equal(again.snapshot.value, 'replanning');
  assert.equal(a.started.filter((e) => e.actor === 'build').length, 2);
});
