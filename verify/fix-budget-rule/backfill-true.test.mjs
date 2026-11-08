// backfill-true: every done fix- item names module and done_on; done_on is the date of the commit that first set
// its status to done; module is one of its outputs (or the decision file's named exception); run-lifecycle-store
// names packages/engine/src/actors.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, headOf, git } from './lib.mjs';

// plan/decisions/2026-11-08-fix-budget-rule.md, Backfill: the two items whose module is not an output.
const EXCEPTIONS = { 'fix-waiting-wake': 'workflows/quick-fix.json', 'fix-workflow-pinned': 'packages/engine/src/host.js' };

const heads = readdirSync(join(REPO, 'plan/items')).filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => ({ file: `plan/items/${f}`, head: headOf(readFileSync(join(REPO, 'plan/items', f), 'utf8')) }));
// A shallow checkout (CI fetches one commit) cuts history at its boundary commits: a first-done commit found at a
// boundary may not be the real first, so the date check needs history that reaches past it.
const shallowFile = join(REPO, git('rev-parse', '--git-path', 'shallow').trim());
const boundary = new Set(existsSync(shallowFile) ? readFileSync(shallowFile, 'utf8').split('\n').filter(Boolean) : []);
const firstDone = (file) => {
  const [hash, date] = git('log', '--date=format-local:%F', '--format=%H %cd', '-S"status": "done"', '--', file).trim().split('\n').at(-1).split(' ');
  return { hash, date, cut: boundary.has(hash) };
};
const rlsFirst = firstDone('plan/items/run-lifecycle-store.md');
const skip = rlsFirst.cut && 'shallow checkout: history does not reach the commits that set status done';
const doneFixes = heads.filter((h) => h.head.id.startsWith('fix-') && h.head.status === 'done');

test('there are done fix items to check', () => {
  assert.ok(doneFixes.length >= 10, `${doneFixes.length}`);
  console.log('done fix items:', doneFixes.length);
});

test('every done fix item: module and done_on set, done_on = first done commit date, module is an output', { skip }, () => {
  const rows = [];
  for (const { file, head } of doneFixes) {
    assert.ok(head.module, `${head.id} module`);
    assert.ok(head.done_on, `${head.id} done_on`);
    const { date: first, cut } = firstDone(file);
    assert.ok(!cut, `${head.id}: first done commit is a shallow boundary; fetch more history`);
    assert.equal(head.done_on, first, `${head.id}: done_on ${head.done_on}, first done commit ${first}`);
    // A ref may list several paths and add words ("x.mjs finish"): take its path-shaped tokens.
    const refs = (head.outputs ?? []).flatMap((o) => o.ref.split(/[\s,]+/)).filter((r) => r.includes("/"));
    const ok = refs.includes(head.module) || EXCEPTIONS[head.id] === head.module;
    assert.ok(ok, `${head.id}: module ${head.module} not in outputs ${JSON.stringify(refs)}`);
    rows.push(`${head.id} ${head.done_on} ${head.module}${EXCEPTIONS[head.id] ? ' (exception)' : ''}`);
  }
  console.log(rows.join('\n'));
});

test('run-lifecycle-store names packages/engine/src/actors.js and carries done_on', { skip }, () => {
  const rls = heads.find((h) => h.head.id === 'run-lifecycle-store').head;
  assert.equal(rls.module, 'packages/engine/src/actors.js');
  assert.equal(rls.status, 'done');
  assert.equal(rls.done_on, rlsFirst.date);
  console.log('run-lifecycle-store', rls.done_on, rls.module);
});

test('no other done item names a module without done_on', () => {
  for (const { head } of heads) if (head.status === 'done' && head.module) assert.ok(head.done_on, head.id);
});
