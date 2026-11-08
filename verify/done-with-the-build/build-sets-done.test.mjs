// Expect build-sets-done: a build branch whose first commit sets its ready item done (with done_on) and adds a file
// outside plan/ passes the freeze gate; the verdict gate refuses it only for the missing verdict; once a commit from
// another session adds a complete verdict, the verdict gate passes, and plan/check.mjs passes on that tree.
// The ready item is made from this item's own head under a new id, with one world-proven Expect line so the verdict
// needs no test file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { joinItem, read, splitItem, tempRepo, node } from './lib.mjs';

const ID = 'dwtb-probe';
const FILE = `plan/items/${ID}.md`;

function readyItem() {
  const { head, rest } = splitItem(read('plan/items/done-with-the-build.md'));
  const { contract_changes, done_on, reader_effort, ...h } = head;
  const brief = rest.slice(rest.indexOf('## Verifier brief'));
  return {
    head: { ...h, id: ID, status: 'ready',
      expect: [{ id: 'probe-world', check: 'The probe file exists at the head', how: 'Read it', proof: 'world' }] },
    rest: `\n## What this is\n\nA probe item for the verifier of done-with-the-build.\n\n${brief}`,
  };
}

test('a build PR whose first commit sets its item done merges on a verdict from another session', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'packages', 'package.json'] });
  const { head, rest } = readyItem();
  const main = r.commit({ [FILE]: joinItem(head, rest) }, 'replan: ready the probe');
  const atMain = node(['plan/check.mjs'], { cwd: r.dir });
  assert.equal(atMain.status, 0, atMain.out);

  r.git('checkout', '-q', '-b', 'build/dwtb-probe');
  const body = `Item: ${ID}\n`;
  const first = r.commit({ [FILE]: joinItem({ ...head, status: 'done', done_on: '2026-11-08' }, rest) },
    `${ID}: done, set in the build PR's first commit\n\nClaude-Session: https://claude.ai/code/session_builder`);
  const built = r.commit({ 'src/probe.txt': 'probe\n' }, `build: ${ID}\n\nClaude-Session: https://claude.ai/code/session_builder`);
  assert.deepEqual(r.git('diff-tree', '--no-commit-id', '--name-only', '-r', first).split('\n'), [FILE]);

  const freeze = r.gate('freeze', { body, from: main });
  assert.equal(freeze.status, 0, freeze.out);
  const before = r.gate('verdict', { body, from: main });
  assert.equal(before.status, 1, before.out);
  const reasons = before.out.split('\n').filter((l) => /^\s{2}\S/.test(l));
  assert.deepEqual(reasons.map((l) => l.trim()), [`no verify/${ID}/verdict.json at the head sha`]);

  const verdict = { item: ID, verified_sha: built,
    verifier: { session: 'https://claude.ai/code/session_verifier', model: 'm' },
    results: [{ id: 'probe-world', status: 'MET', command: 'cat src/probe.txt', excerpt: 'probe' }] };
  r.commit({ [`verify/${ID}/verdict.json`]: JSON.stringify(verdict, null, 2) + '\n' },
    `verify: ${ID}\n\nClaude-Session: https://claude.ai/code/session_verifier`);
  const after = r.gate('verdict', { body, from: main });
  assert.equal(after.status, 0, after.out);
  const freezeAfter = r.gate('freeze', { body, from: main });
  assert.equal(freezeAfter.status, 0, freezeAfter.out);
  const check = node(['plan/check.mjs'], { cwd: r.dir });
  assert.equal(check.status, 0, check.out);
  t.diagnostic(`freeze: ${freeze.out.trim()} | before verdict: ${reasons.map((l) => l.trim()).join('; ')} | after: ${after.out.trim()} | check: ${check.out.trim().split('\n').pop()}`);
});
