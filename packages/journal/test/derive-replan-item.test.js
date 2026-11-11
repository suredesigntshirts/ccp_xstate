// A replan PR with no `Item:` line is attributed to the one item file it changes, and the rework view counts it as a
// replan of that item's build PR. prFacts reads stubbed REST responses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prFacts } from '../bin/derive.js';
import { ciRows, rework } from '../src/derive/rework.js';

const REPO = 'o/r';
const envelope = { session: 'test', release: '0.0.0' };

// The REST bodies for one PR with one commit and one completed check run.
function rest(number, { body = '', head, labels = [], files, runId }) {
  const sha = `${number}`.padEnd(40, '0');
  const t = '2026-11-11T00:00:00Z';
  return {
    [`/repos/${REPO}/pulls/${number}`]: { head: { ref: head }, merged_at: null, body, labels: labels.map((name) => ({ name })) },
    [`/repos/${REPO}/pulls/${number}/commits?per_page=100&page=1`]: [{ sha, parents: [{}], commit: { committer: { date: t }, message: 'm' } }],
    [`/repos/${REPO}/pulls/${number}/files?per_page=100&page=1`]: files.map((filename) => ({ filename, changes: 1 })),
    [`/repos/${REPO}/commits/${sha}/check-runs?per_page=100`]: { check_runs: [{ id: runId, name: 'test', status: 'completed', conclusion: 'success', started_at: t, completed_at: t }] },
  };
}
const facts = (number, spec) => {
  const raw = rest(number, spec);
  return prFacts(REPO, number, { get: async (p) => { if (!(p in raw)) throw new Error(`not stubbed: ${p}`); return raw[p]; } });
};

test('a replan PR with no Item: line takes the one item file it changes', async () => {
  const f = await facts(7, { head: 'replan/some-topic', labels: ['replan'], files: ['plan/items/some-id.md', 'plan/README.md'], runId: 701 });
  assert.equal(f.item, 'some-id');
});

test('a replan PR changing two item files falls back to its branch', async () => {
  const f = await facts(8, { head: 'replan/some-topic', labels: ['replan'], files: ['plan/items/some-id.md', 'plan/items/other-id.md'], runId: 801 });
  assert.equal(f.item, 'some-topic');
});

test('a replan PR changing no item file falls back to its branch', async () => {
  const f = await facts(9, { head: 'replan/some-topic', labels: ['replan'], files: ['plan/README.md'], runId: 901 });
  assert.equal(f.item, 'some-topic');
});

test('an Item: line wins over the changed item file', async () => {
  const f = await facts(10, { body: 'Why.\n\nItem: named-id\n', head: 'replan/some-topic', labels: ['replan'], files: ['plan/items/some-id.md'], runId: 1001 });
  assert.equal(f.item, 'named-id');
});

test('a PR not labelled replan keeps its branch, whatever item file it changes', async () => {
  const f = await facts(11, { head: 'fix/some-topic', files: ['plan/items/some-id.md'], runId: 1101 });
  assert.equal(f.item, 'some-topic');
});

test('the rework view counts the attributed replan on the item\'s build PR', async () => {
  const replan = await facts(7, { head: 'replan/some-topic', labels: ['replan'], files: ['plan/items/some-id.md', 'plan/README.md'], runId: 701 });
  const build = await facts(12, { body: 'Item: some-id\n', head: 'build/some-id', files: ['packages/x.js'], runId: 1201 });
  const view = rework([...ciRows(replan, envelope), ...ciRows(build, envelope)]);
  assert.equal(view.prs.find((p) => p.pr === 12).replans, 1);
  assert.equal(view.prs.find((p) => p.pr === 7).replans, 0);
});
