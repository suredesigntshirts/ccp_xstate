// C-red-ci-back-to-building (plan/cases/work-item.md): an item whose PR's CI goes red can't reach merging, and returns
// to building with the failing check as input. The red result is the real check_run.completed wake the platform
// delivered (fixtures/wakes/check-run-failed.txt), read by the host the way a hook hands it over. Ported to the stage
// contract: a red check counts only on the item's own PR (event.pr is the stamped pr.key) at its head, and the build
// bound is built/rebuilt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, inputsOfWake } from '../../src/index.js';
import { ISSUE, BRIEFS, done, path, pr, run, starts, verdict, workflow } from '../flow.js';

const wake = readFileSync(new URL('../fixtures/wakes/check-run-failed.txt', import.meta.url), 'utf8');
const RED = JSON.parse(wake.match(/\{"check"[^\n]*\}/)[0]); // check "test", conclusion failure
const red = (over = {}) => ({ type: 'github.check_run.completed', ...RED, ...over });
const HEAD = RED.head_sha;
const OTHER = 'c'.repeat(40);
// The item's PR is the one the real wake names, so its stamped key is the wake's pr.
const prOf = (at) => ({ pr: { ...pr(at).pr, key: RED.pr } });
const verifying = [done('brief', BRIEFS), done('build', prOf(HEAD))];

test('C-red-ci: a red check on the PR head while verifying sends the item back to building, the check named', () => {
  const after = run([...verifying, red()]);
  assert.equal(after.value, 'building');
  assert.equal(after.context.failure.check, 'test');
  assert.equal(after.context.failure.conclusion, 'failure');
  assert.equal(after.context.failure.sha, HEAD);
  assert.deepEqual(starts(run(verifying), red()), ['build']);
});

test('C-red-ci: a red check after a PASS, while waiting to merge, can no longer reach merging', () => {
  const passed = [...verifying, done('verify', verdict('PASS', HEAD))];
  assert.equal(run(passed).value, 'awaitingMerge');
  const states = path([...passed, red(), done('ask', { choice: 'approve', by: 'p' })]);
  assert.ok(!states.includes('merging'), states.join(' > '));
  assert.equal(states.at(-2), 'building');
});

test('C-red-ci: a green check, or a red one on another head, changes nothing', () => {
  assert.equal(run([...verifying, red({ conclusion: 'success' })]).value, 'verifying');
  assert.equal(run([...verifying, red({ head_sha: OTHER })]).value, 'verifying');
  assert.equal(run([...verifying, red({ pr: 'o/r#2' })]).value, 'verifying', 'nor a red one on another PR');
});

test('C-red-ci: with no build left, a red check sends the item to replanning instead', () => {
  const second = [...verifying, done('verify', verdict('FAIL', HEAD)), done('build', prOf(HEAD))];
  assert.deepEqual([run(second).context.built, run(second).context.rebuilt], [true, true]);
  const after = run([...second, red()]);
  assert.equal(after.value, 'replanning');
  assert.equal(after.context.failure.check, 'test');
});

test('C-red-ci: through the host, the real wake steps the item back and the new build gets the failing check', async () => {
  const root = mkdtempSync(join(tmpdir(), 'red-ci-'));
  const host = restore({ root, item: 'red-1', spec: workflow, session: 's', release: '0.2.0' });
  const started = [];
  const handlers = {
    run: {
      start: async (effect) => {
        started.push(effect);
        if (effect.actor === 'brief') return { ref: 'b', output: BRIEFS };
        if (effect.actor === 'build' && started.filter((e) => e.actor === 'build').length === 1) return { ref: 'p', output: prOf(HEAD) };
        return { ref: effect.id };
      }
    }
  };
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 's' } }], handlers);
  assert.equal(host.snapshot.value, 'verifying');
  const inputs = inputsOfWake(host, wake);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].source.system, 'github');
  const [result] = await offer(host, inputs, handlers);
  assert.equal(result.outcome, 'applied');
  assert.equal(host.snapshot.value, 'building');
  const rebuild = started.filter((e) => e.actor === 'build').at(-1);
  assert.equal(rebuild.input.failure.check, 'test');
  assert.equal(rebuild.input.failure.url, RED.details_url);
});
