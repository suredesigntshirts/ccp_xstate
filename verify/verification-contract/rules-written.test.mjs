// Expect rules-written: plan/README.md, docs/gates.md, CLAUDE.md and docs/language.md state the new rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const read = (p) => readFileSync(join(REPO, p), 'utf8');
const section = (text, heading) => text.split(new RegExp(`^## ${heading}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
const flat = (s) => s.replace(/\s+/g, ' ');

test('plan/README.md How slop is kept out states the four rules', () => {
  const s = flat(section(read('plan/README.md'), 'How slop is kept out'));
  assert.ok(s, 'section exists');
  // the deny-list rule, by pointing at the decision
  assert.match(s, /refuses a ready or doing item whose check holds a sha or a phrase that pins main/);
  assert.match(s, /plan\/decisions\/2026-11-08-verification-swing\.md`?, decision 1/);
  // the test field and observations
  assert.match(s, /names in `test` the file that proves it; the verdict gate runs that file at the head/);
  assert.match(s, /`observations`, which never gates/);
  // one contract change with the verdict-file cutoff
  assert.match(s, /Once an item's verification starts, nothing changes its head or Verifier brief\. Before that, one replan may, with a `## Contract change` section/);
  assert.match(s, /refuses a second change and a change with no section/);
  assert.match(s, /once `verify\/<item>\/verdict\.json` exists at the PR's base or head/);
});

test('plan/README.md head-field table names contract_changes', () => {
  assert.match(read('plan/README.md'), /contract_changes/);
});

test('docs/gates.md shows test and observations in the verdict example and the cutoff in the freeze section', () => {
  const g = read('docs/gates.md');
  const example = section(g, 'The verdict').match(/```json\n([\s\S]*?)```/)[1];
  const v = JSON.parse(example);
  assert.ok(v.results.some((r) => typeof r.test === 'string' && r.test.startsWith(`verify/${v.item}/`)), 'a result names test');
  assert.ok(v.results.some((r) => r.test === undefined), 'a world-style result names none');
  assert.ok(Array.isArray(v.observations), 'observations is a list');
  const freeze = flat(section(g, 'The contract freeze'));
  assert.match(freeze, /Verification has started once `verify\/<item>\/verdict\.json` exists at the PR's base or head; from then on the gate refuses any head or brief change, label or not/);
  assert.match(freeze, /contract_changes/);
});

test('CLAUDE.md carries decision 4\'s cleanup principle and has fewer than 100 lines', () => {
  const c = read('CLAUDE.md');
  assert.ok(c.split('\n').filter((l, i, a) => i < a.length - 1 || l).length < 100);
  const f = flat(c);
  assert.ok(f.includes('**A cleanup changes structure, not behaviour.** Behaviour is what the glossary names and the regression set asserts. A test that asserts bytes, a listing or a retired path leaves with the code it pinned, named by the item.'));
  assert.ok(!f.includes('Tests that pass on `main` pass at its head'), 'the old text is gone');
});

test('docs/language.md defines regression set, observation and contract change, and says plan verifier', () => {
  const l = read('docs/language.md');
  for (const word of ['regression set', 'observation', 'contract change', 'plan verifier'])
    assert.match(l, new RegExp(`^\\| ${word} \\| `, 'm'), word);
  assert.match(flat(l), /Say \*plan verifier\* wherever the model stage could be meant/);
});
