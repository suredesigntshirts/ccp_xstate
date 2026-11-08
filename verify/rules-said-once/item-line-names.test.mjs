// Expect item-line-names: the verdict gate names a PR's item by the body's Item line alone. Each case runs
// node scripts/gates/pr-gate.mjs verdict in a temp git repo copied from the checkout, with PR_BRANCH, PR_BODY and
// PR_LABELS set as verdict.yml sets them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRepo, splitItem } from './lib.mjs';

const DRAFT = 'test-fixture-edges';   // an existing draft item at the head
const OTHER = 'fix-budget-rule';      // another existing item, used only as a misleading branch name
const proseEdit = (r) => ({ [`plan/items/${DRAFT}.md`]: `${r.file(`plan/items/${DRAFT}.md`)}\nA line of prose.\n` });

test('a plan-only PR on replan/<existing id> with no Item line passes the verdict gate', (t) => {
  const r = gateRepo(t);
  r.branch(`replan/${DRAFT}`);
  r.commit(proseEdit(r), 'replan: prose\n\nClaude-Session: s-replan');
  const out = r.gate('verdict', { branch: `replan/${DRAFT}`, body: 'Makes it clearer.', labels: ['replan'] });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /verdict gate passed$/m);
  assert.doesNotMatch(out.out, /\(item /);
});

test('a PR on build/<existing id> that changes a file outside plan/ with no Item line is refused for the missing line', (t) => {
  const r = gateRepo(t);
  r.branch(`build/${DRAFT}`);
  r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  const out = r.gate('verdict', { branch: `build/${DRAFT}`, body: 'Builds it.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /names no item \(add an "Item: <id>" line to its body\)/);
  assert.doesNotMatch(out.out, new RegExp(`item ${DRAFT}`));
});

test('Item: <id> in the body judges the PR against that item, whatever the branch is called', (t) => {
  const r = gateRepo(t);
  // A toy item whose one Expect line is world-proven, so a hand-written verdict can be complete.
  const { head, rest } = splitItem(r.file(`plan/items/${DRAFT}.md`));
  const toy = { ...head, id: 'rso-toy', status: 'done',
    expect: [{ id: 'shown', check: 'A line is shown', how: 'Read it', proof: 'world' }] };
  r.commit({ 'plan/items/rso-toy.md': `\`\`\`json\n${JSON.stringify(toy, null, 2)}\n\`\`\`\n${rest}` }, 'base: toy item');
  const base2 = r.git('rev-parse', 'HEAD');
  r.git('checkout', '-q', '-B', `build/${OTHER}`, base2);
  const built = r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  r.commit({ 'verify/rso-toy/verdict.json': JSON.stringify({ item: 'rso-toy', verified_sha: built,
    verifier: { session: 's-verify', model: 'm' },
    results: [{ id: 'shown', status: 'MET', command: 'read it', excerpt: 'a line' }] }) },
  'verify: rso-toy\n\nClaude-Session: s-verify');
  const gate = (body, branch) => r.gate('verdict', { branch, body });
  const toyOnOther = gate('Builds it.\n\nItem: rso-toy\n', `build/${OTHER}`);
  t.diagnostic(`Item: rso-toy on build/${OTHER}: ${toyOnOther.out.trim()}`);
  assert.equal(toyOnOther.status, 0, toyOnOther.out);
  assert.match(toyOnOther.out, /verdict gate passed \(item rso-toy\)/);

  const toyOnClaude = gate('Item: rso-toy', 'claude/some-thread');
  assert.equal(toyOnClaude.status, 0, toyOnClaude.out);

  const draftOnOther = gate(`Item: ${DRAFT}`, 'build/rso-toy');
  t.diagnostic(`Item: ${DRAFT} on build/rso-toy: ${draftOnOther.out.trim()}`);
  assert.equal(draftOnOther.status, 1, draftOnOther.out);
  assert.match(draftOnOther.out, new RegExp(`verdict gate failed \\(item ${DRAFT}\\)`));
  assert.match(draftOnOther.out, new RegExp(`no verify/${DRAFT}/verdict\\.json at the head sha`));
  assert.doesNotMatch(draftOnOther.out, /branch names/);
});

test('an Item line naming an id plan/items/ lacks is refused', (t) => {
  const r = gateRepo(t);
  r.branch('build/rso-x');
  r.commit({ 'docs/rso.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  for (const branch of ['build/rso-x', `build/${DRAFT}`, `replan/${DRAFT}`]) {
    const out = r.gate('verdict', { branch, body: 'Item: no-such-item' });
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /the body names item no-such-item, which plan\/items\/ doesn't have/);
  }
  // Plan-only, labelled replan: still refused, because the body names an item that is not there.
  r.branch(`replan/${DRAFT}`);
  r.commit(proseEdit(r), 'replan: prose\n\nClaude-Session: s-replan');
  const out = r.gate('verdict', { branch: `replan/${DRAFT}`, body: 'Item: no-such-item', labels: ['replan'] });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
});
