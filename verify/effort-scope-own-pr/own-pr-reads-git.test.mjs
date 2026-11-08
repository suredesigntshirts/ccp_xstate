// Expect own-pr-reads-git: at #212's last commit with the head's suite file, BASE_SHA = #212's base and PR_BODY naming
// plan-reader-effort, the suite reads the file list from git and passes; one more commit adding a stray file makes it
// fail naming that file; PR_BODY naming another item makes it report tree mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD, PR212, PR212_BASE, SUITE, clone, commits, modeLine, runSuite, suiteAt } from './lib.mjs';

const ok = commits();
const STRAY = 'esop-stray-outside-outputs.txt';

test("plan-reader-effort's PR, then a stray commit, then another item's body", { skip: !ok && 'pinned commits unreachable' }, async (t) => {
  const c = clone(t, PR212);
  c.put(SUITE, suiteAt(HEAD));
  c.git('commit', '-q', '-am', "the head's suite file");
  const own = { BASE_SHA: PR212_BASE, PR_BODY: 'Adds reader effort.\n\nItem: plan-reader-effort\n' };

  await t.test('Item: plan-reader-effort reads git and passes', (s) => {
    const r = runSuite(c.dir, own);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.equal(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^PR mode: \d+ files/);
    assert.doesNotMatch(r.out, new RegExp(STRAY));
  });

  c.stray(STRAY);

  await t.test('a stray commit fails naming the file', (s) => {
    const r = runSuite(c.dir, own);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.notEqual(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^PR mode/);
    const failure = r.out.split('\n').filter((l) => l.includes(STRAY) && !/PR mode/.test(l));
    s.diagnostic(`failure lines naming it: ${failure.length}; ${failure[0]?.trim().slice(0, 200)}`);
    assert.ok(failure.length > 0, r.out);
  });

  await t.test('Item: another-item reports tree mode and passes', (s) => {
    const r = runSuite(c.dir, { BASE_SHA: PR212_BASE, PR_BODY: 'Item: another-item' });
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.equal(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^tree mode/);
  });
});

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));
