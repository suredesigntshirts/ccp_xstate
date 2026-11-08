// Expect: engine-effects/red-ci
// A red check run on the PR head, from GitHub's saved REST answer and from the wake the platform delivered, goes through
// the wake parser into a host item in verifying and sends it back to building; a green check or another head does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, inputsOfWake, loadWorkflow, itemFile } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';

const rest = JSON.parse(readFileSync(new URL('../fixtures/red-ci/check-runs.json', import.meta.url), 'utf8'));
const HEAD = 'cd2adfb894be738dc3071dac9ac660b42f2caa0e';
const run = rest.check_runs[0];
const fixture = readFileSync(new URL('../../../packages/engine/test/fixtures/wakes/check-run-failed.txt', import.meta.url), 'utf8');

// The fixture's shape, with its JSON replaced by REST's facts.
const wakeFor = (facts) => fixture.replace(/\{"check":.*\}/, JSON.stringify(facts));
const facts = (r, pr = 'suredesigntshirts/ccp_xstate_scratch#18') =>
  ({ check: r.name, check_run_id: r.id, conclusion: r.conclusion, details_url: r.details_url, head_sha: r.head_sha, pr });

// The PR is a ref { url, at } as the host stamps it at accept
// (key, and green: CI was green at accept, so the item verifies). The build bound is built/rebuilt.
const PR = { url: 'https://github.com/suredesigntshirts/ccp_xstate_scratch/pull/18', at: HEAD, key: 'suredesigntshirts/ccp_xstate_scratch#18', green: true };
async function itemInVerifying() {
  const root = mkdtempSync(join(tmpdir(), 'ee-redci-'));
  const builds = [];
  const actors = {
    brief: { start: async () => ({ output: { builder: 'b.md', verifier: 'v.md' } }) },
    build: { start: async (e) => { builds.push(e.input); return builds.length === 1 ? { output: { pr: PR } } : { ref: 'build-2-running' }; } },
    verify: { start: async () => ({ ref: 'verifier-running' }) } // the verifier is still working: no verdict yet
  };
  const handlers = { run: { handles: (e) => e.actor in actors, start: (e) => actors[e.actor].start(e), find: () => undefined } };
  const host = restore({ root, item: 'redci-18', spec: loadWorkflow('quick-fix'), session: 'verifier-engine-effects', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: { url: 'https://github.com/o/r/issues/1', expect: ['x'] } } }, source: { system: 'claude-code', ref: 'v' } }], handlers);
  return { host, handlers, builds, root };
}

test('red-ci: a red check on the PR head sends a verifying item back to building, naming the check, and the new build gets it', async () => {
  const { host, handlers, builds, root } = await itemInVerifying();
  assert.equal(host.snapshot.value, 'verifying');
  assert.equal(host.snapshot.context.pr.at, HEAD);
  assert.equal(builds.length, 1);

  const inputs = inputsOfWake(host, wakeFor(facts(run)));
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].event.type, 'github.check_run.completed');
  const [result] = await offer(host, inputs, handlers);

  assert.equal(result.outcome, 'applied');
  assert.equal(host.snapshot.value, 'building');
  assert.equal(host.snapshot.context.failure.check, 'test');
  assert.equal(host.snapshot.context.failure.conclusion, 'failure');
  assert.equal(host.snapshot.context.failure.sha, HEAD);
  assert.equal(host.snapshot.context.failure.url, run.details_url);
  assert.deepEqual([host.snapshot.context.built, host.snapshot.context.rebuilt], [true, null], 'one build used, one left');
  // The second build started, with the failing check in its input.
  assert.equal(builds.length, 2);
  assert.equal(builds[1].failure.check, 'test');
  assert.equal(builds[1].failure.url, run.details_url);
  // It never reached merging, and the journal row says which wake source did it.
  const rows = readFile(itemFile(root, 'redci-18')).rows.filter((r) => r.kind === 'engine.transition');
  assert.ok(!rows.some((r) => String(r.state).includes('merging')));
  assert.ok(rows.some((r) => r.source.system === 'github' && r.payload.event.type === 'github.check_run.completed'));
});

test('red-ci: a red check on another head, or a green one, does not send it back', async () => {
  const { host, handlers, builds } = await itemInVerifying();
  const other = facts({ ...run, head_sha: 'e'.repeat(40) });
  const green = facts({ ...run, conclusion: 'success' });
  for (const f of [other, green]) {
    const results = await offer(host, inputsOfWake(host, wakeFor(f)), handlers);
    assert.notEqual(host.snapshot.value, 'building', JSON.stringify(results.map((r) => r.outcome)));
  }
  assert.equal(host.snapshot.value, 'verifying');
  assert.equal(builds.length, 1);
});

test('red-ci: the wake the platform delivered for PR 18 carries the same facts as REST, and does the same', async () => {
  const delivered = readFileSync(new URL('../fixtures/red-ci/delivered-wake.txt', import.meta.url), 'utf8');
  const sent = JSON.parse(delivered.match(/\{"check".*\}/)[0]);
  assert.deepEqual(sent, facts(run));
  const { host, handlers, builds } = await itemInVerifying();
  await offer(host, inputsOfWake(host, delivered), handlers);
  assert.equal(host.snapshot.value, 'building');
  assert.equal(host.snapshot.context.failure.check, 'test');
  assert.equal(builds[1].failure.check, 'test');
});
