// Expect contract-change-once: a doing item's contract may change once, by a plan-only replan with contract_changes 1
// and a ## Contract change section, before its verdict file exists; the plan check and the freeze gate hold the rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { gateRepo, headOf, itemText, node } from './lib.mjs';

const ID = 'vfy-doing';
const BRANCH = 'replan/vfy-doing-contract';
const SECTION = '\n## Contract change\n\nThe build tried one shape, compared it with another, and the contract moved to say so.\n';
const before = itemText(ID, { status: 'doing' });
const changedExpect = (fields = {}) => {
  const head = headOf(before);
  return itemText(ID, { status: 'doing', expect: [...head.expect, { id: 'added-line', check: 'The gate refuses a second change',
    how: 'run it', proof: 'verifier' }], ...fields });
};
const plan = (repo) => node([join(repo.dir, 'plan/check.mjs')]);
const replan = { labels: ['replan'] };

test('a replan with contract_changes 1 and a Contract change section passes the freeze gate and the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', replan);
  assert.equal(f.status, 0, f.out);
  const p = plan(repo);
  assert.equal(p.status, 0, p.out);
});

test('the same change without the replan label is refused by the freeze gate', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', { labels: [] });
  assert.equal(f.status, 1, f.out);
  assert.match(f.out, new RegExp(ID));
});

test('contract_changes 2 is refused by the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 2 }) + SECTION }, 'https://claude.ai/code/session_vc_replan');
  const p = plan(repo);
  assert.equal(p.status, 1, p.out);
  assert.match(p.out, new RegExp(`${ID}[^\\n]*contract_changes`));
});

test('contract_changes 1 with no Contract change section is refused by the plan check', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before });
  repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) }, 'https://claude.ai/code/session_vc_replan');
  const p = plan(repo);
  assert.equal(p.status, 1, p.out);
  assert.match(p.out, new RegExp(`${ID}[^\\n]*Contract change`));
});

for (const where of ['base', 'head']) {
  test(`a replan-labelled plan-only change to an item whose verdict file exists at the ${where} is refused by the freeze gate, naming the item and the file`, (t) => {
    const verdict = { [`verify/${ID}/verdict.json`]: '{}\n' };
    const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before, ...(where === 'base' ? verdict : {}) });
    repo.commit({ [`plan/items/${ID}.md`]: changedExpect({ contract_changes: 1 }) + SECTION, ...(where === 'head' ? verdict : {}) },
      'https://claude.ai/code/session_vc_replan');
    const f = repo.gate('freeze', replan);
    assert.equal(f.status, 1, f.out);
    assert.match(f.out, new RegExp(`${ID}[^\\n]*verify/${ID}/verdict\\.json`));
  });
}

test('a status and done_on change to an item with a verdict file passes the freeze gate', (t) => {
  const repo = gateRepo(t, BRANCH, { [`plan/items/${ID}.md`]: before, [`verify/${ID}/verdict.json`]: '{}\n' });
  repo.commit({ [`plan/items/${ID}.md`]: itemText(ID, { status: 'done', done_on: '2026-11-08' }) }, 'https://claude.ai/code/session_vc_replan');
  const f = repo.gate('freeze', replan);
  assert.equal(f.status, 0, f.out);
});
