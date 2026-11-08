// Expect own-pr-reads-git: at #202's last commit with the head's suite file, BASE_SHA = #202's base and PR_BODY naming
// rules-said-once, the suite reads the file list from git and passes; one more commit adding a stray file makes it fail
// naming that file; PR_BODY naming another item makes it check from the tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD, PR202, PR202_BASE, SUITE, clone, commits, modeLine, runSuite, suiteAt } from './lib.mjs';

const ok = commits();
const STRAY = 'ssop-stray-outside-outputs.txt';

test("rules-said-once's PR, then a stray commit, then another item's body", { skip: !ok && 'pinned commits unreachable' }, async (t) => {
  const c = clone(t, PR202);
  c.put(SUITE, suiteAt(HEAD));
  const own = { BASE_SHA: PR202_BASE, PR_BODY: 'Fixes the scope.\n\nItem: rules-said-once\n' };

  await t.test('Item: rules-said-once reads git and passes', (s) => {
    const r = runSuite(c.dir, own);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.equal(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^PR mode: \d+ files/);
    assert.doesNotMatch(r.out, new RegExp(STRAY));
  });

  c.put(STRAY, 'outside the outputs\n');
  c.git('add', STRAY);
  c.git('commit', '-q', '-m', 'stray');

  await t.test('a stray commit fails naming the file', (s) => {
    const r = runSuite(c.dir, own);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.notEqual(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^PR mode/);
    const failure = r.out.split('\n').filter((l) => l.includes(STRAY) && !/PR mode/.test(l));
    s.diagnostic(`failure lines naming it: ${failure.length}; ${failure[0]?.trim().slice(0, 200)}`);
    assert.ok(failure.length > 0, r.out);
  });

  await t.test('Item: another-item checks from the tree and passes', (s) => {
    const r = runSuite(c.dir, { BASE_SHA: PR202_BASE, PR_BODY: 'Item: another-item' });
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.equal(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^tree mode/);
  });
});

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));
