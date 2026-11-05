// Expect stamped-accepted: through the real hook script and the real return-tool server over stdio, a build result with
// a PR ref is accepted by the hook, stored stamped (key, branch, checkout), and the server answers the same arguments
// `accepted: `. On main (762e2c1) the same steps answer `not accepted`: evidence/main-scenarios.json is scenarios.mjs
// run on a checkout of main (CI's checkout is depth 1). With VERIFY_MAIN=<checkout of main> it is also run live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO, PR_URL, stampedScenario, textOf } from './lib.mjs';

test('stamped-accepted: the hook accepts a PR-ref build result and the server answers accepted', async () => {
  const s = await stampedScenario(REPO);
  assert.equal(s.hookAnswer, null, 'the hook let the return through (no deny)');
  const pr = s.stored.result.pr;
  assert.equal(pr.key, 'o/r#1');
  assert.equal(pr.branch, 'fix-1');
  assert.equal(pr.checkout, `git fetch origin pull/1/head && git checkout --detach ${s.head}`);
  assert.equal(pr.green, true);
  assert.notDeepEqual(s.stored.result, s.result, 'what is stored is the stamped result, not what was sent');
  assert.equal(s.answer.isError, undefined);
  assert.match(textOf(s.answer), /^accepted: run it-1:1\.build's result is stored \([0-9a-f]{12}\)\. You are done\.$/);
  assert.ok(textOf(s.answer).includes(s.stored.hash.slice(0, 12)));
  const rows = s.p.rows().filter((r) => r.payload?.run === 'it-1:1.build' && /refusal|result\.stored/.test(r.kind));
  assert.deepEqual(rows.map((r) => r.kind), ['result.stored']);
});

test('stamped-accepted: on main the same steps answer not accepted (committed evidence)', () => {
  const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8'));
  assert.equal(main.hook.accepted, null, 'main\'s hook accepted the same return');
  assert.equal(main.results.build.result.pr.key, 'o/r#1');
  assert.match(main.server.accepted, /^not accepted: no harness check passed this result for run it-1:1\.build/);
  assert.match(main.server.verifyAccepted, /^not accepted: /);
});

test('stamped-accepted: on main, live, when VERIFY_MAIN names a checkout of main', { skip: !process.env.VERIFY_MAIN }, async () => {
  const s = await stampedScenario(process.env.VERIFY_MAIN);
  assert.equal(s.hookAnswer, null);
  assert.equal(s.stored.sent, undefined, 'main writes no sent');
  assert.equal(s.answer.isError, true);
  assert.match(textOf(s.answer), /^not accepted: /);
});
