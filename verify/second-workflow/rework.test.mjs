// rework: a PR labelled replan that names no item counts against the item whose one plan/items/ file it changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prFacts } from '../../packages/journal/bin/derive.js';
import { restStub } from './lib.mjs';

const derive = new URL('../../packages/journal/bin/derive.js', import.meta.url).pathname;
const rework = (facts) => {
  const file = join(mkdtempSync(join(tmpdir(), 'verify-rework-')), 'facts.json');
  writeFileSync(file, JSON.stringify(facts));
  const out = JSON.parse(execFileSync(process.execPath, [derive, 'rework', '--facts', file], { encoding: 'utf8' }));
  return Object.fromEntries(out.prs.map((p) => [p.pr, p]));
};
const BUILD = { body: 'Builds the thing.\n\nItem: second-workflow\n', labels: ['build'], head: 'build/second-workflow', commits: ['a'], files: ['packages/x.js'] };
const facts = async (prs) => {
  const get = restStub(prs);
  return Promise.all(Object.keys(prs).map((n) => prFacts('o/r', Number(n), { get })));
};

test('a readying replan on a topic branch, with no Item: line, shows in the build PR replans', async () => {
  const f = await facts({
    1: { body: 'Ready the item.', labels: ['replan'], head: 'replan/ready-the-second-kind', commits: ['a'], files: ['plan/items/second-workflow.md', 'plan/decisions/2026-11-11-x.md', 'docs/language.md'] },
    2: BUILD
  });
  assert.equal(f[0].item, 'second-workflow');
  const view = rework(f);
  assert.equal(view[2].replans, 1);
  assert.equal(view[1].item, 'second-workflow');
});

test("the Item: line still wins over the changed file, and two replans count two", async () => {
  const f = await facts({
    1: { body: 'Item: other-item\n', labels: ['replan'], head: 'replan/x', commits: ['a'], files: ['plan/items/second-workflow.md'] },
    3: { body: 'no line', labels: ['replan'], head: 'replan/y', commits: ['a'], files: ['plan/items/second-workflow.md'] },
    4: { body: 'no line', labels: ['replan'], head: 'replan/z', commits: ['a'], files: ['plan/items/second-workflow.md', 'plan/stages/s5.md'] },
    2: BUILD
  });
  const view = rework(f);
  assert.equal(view[1].item, 'other-item');
  assert.equal(view[2].replans, 2);
});

test('a replan changing two item files, or none, is not given an item by its files', async () => {
  const f = await facts({
    1: { body: 'split', labels: ['replan'], head: 'replan/split-things', commits: ['a'], files: ['plan/items/second-workflow.md', 'plan/items/third.md'] },
    5: { body: 'ledger', labels: ['replan'], head: 'replan/ledger', commits: ['a'], files: ['plan/ledger/platform.md'] },
    2: BUILD
  });
  const view = rework(f);
  assert.equal(view[1].item, 'split-things');
  assert.equal(view[5].item, 'ledger');
  assert.equal(view[2].replans, 0);
});

test('a PR not labelled replan is not attributed by its item file, and a file outside plan/items/ does not count', async () => {
  const f = await facts({
    1: { body: 'status', labels: ['build'], head: 'status/flip', commits: ['a'], files: ['plan/items/second-workflow.md'] },
    6: { body: 'deep', labels: ['replan'], head: 'replan/deep', commits: ['a'], files: ['plan/items/sub/second-workflow.md'] },
    2: BUILD
  });
  const view = rework(f);
  assert.equal(view[1].item, 'flip');
  assert.equal(view[6].item, 'deep');
  assert.equal(view[2].replans, 0);
});

test('old PR facts (an item already read from the branch) are counted as before', () => {
  const run = (pr, sha) => ({ sha, parents: 1, at: '2026-11-11T09:00:00Z', checkRuns: [{ id: pr, name: 'test', status: 'completed', conclusion: 'success', startedAt: '2026-11-11T09:01:00Z', completedAt: '2026-11-11T09:02:00Z' }] });
  const view = rework([
    { repo: 'o/r', number: 1, item: 'second-workflow', labels: ['replan'], commits: [run(1, 'a'.repeat(40))] },
    { repo: 'o/r', number: 2, item: 'second-workflow', labels: ['build'], commits: [run(2, 'b'.repeat(40))] }
  ]);
  assert.equal(view[2].replans, 1);
});
