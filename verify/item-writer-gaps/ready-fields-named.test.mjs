// Expect ready-fields-named: on a temp copy of the head's plan/, a ready item missing a field the schema's
// readyRequired names is refused naming that field, and plan/README.md's How an item is written says so, naming
// readyRequired; plan/README.md's Changing the plan says depends_on never points at a later stage, and the plan check
// refuses an item that depends on one in a later stage. Rule texts are read by the words that carry each rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flat, planCopy, read, readyItem, section, splitItem } from './lib.mjs';

const readme = read('plan/README.md');
const schema = JSON.parse(read('plan/item.schema.json'));
const stages = (id) => read(`plan/items/${id}.md`).match(/"stage": "([^"]+)"/)[1];

test('How an item is written says the plan check refuses an open readyRequired field and names it', (t) => {
  const s = flat(section(readme, 'How an item is written'));
  const sentence = s.split(/(?<=\.) /).find((x) => /readyRequired/.test(x)) ?? '';
  t.diagnostic(sentence);
  assert.match(sentence, /`readyRequired`/);
  assert.match(sentence, /check\.mjs/);
  assert.match(sentence, /refuses/);
  assert.match(sentence, /`ready`/);
  assert.match(sentence, /names the field/);
});

test('each readyRequired field, left empty or out of a ready item, is refused by name', (t) => {
  const p = planCopy(t);
  t.diagnostic(`readyRequired: ${schema.readyRequired.join(', ')}`);
  assert.ok(schema.readyRequired.length >= 8, schema.readyRequired.join(', '));
  const base = readyItem('iwg-open');
  p.add(base.head, base.rest);
  const ok = p.check();
  assert.equal(ok.status, 0, ok.out);
  for (const field of schema.readyRequired) {
    for (const [how, head] of [['empty', { ...base.head, [field]: Array.isArray(base.head[field]) ? [] : (typeof base.head[field] === 'string' ? '' : {}) }],
      ['absent', Object.fromEntries(Object.entries(base.head).filter(([k]) => k !== field))]]) {
      p.add(head, base.rest);
      const r = p.check();
      const line = r.out.split('\n').find((l) => l.includes('iwg-open') && l.includes(field)) ?? '';
      if (how === 'absent') t.diagnostic(`${field} ${how}: exit ${r.status}, ${line}`);
      assert.equal(r.status, 1, `${field} ${how}: ${r.out}`);
      assert.match(line, new RegExp(`\\b${field}\\b`), `${field} ${how}: ${r.out}`);
    }
  }
});

test('Changing the plan says depends_on never points at a later stage', (t) => {
  const s = flat(section(readme, 'Changing the plan'));
  const line = s.split(/ - (?=\*\*)/).find((x) => /`depends_on`/.test(x) && /later stage/.test(x)) ?? '';
  t.diagnostic(line);
  assert.match(line, /`depends_on`/);
  assert.match(line, /later stage/);
  assert.match(line, /\b(none|never|not|no)\b/);
});

test('the plan check refuses a dependency in a later stage and passes one in the same stage', (t) => {
  const later = 'decide-v1-retirement';
  const own = splitItem(read('plan/items/item-writer-gaps.md')).head.stage;
  assert.notEqual(stages(later), own);
  const p = planCopy(t);
  const { head, rest } = readyItem('iwg-dep');
  p.add({ ...head, depends_on: ['verifier-reader-gaps'] }, rest);
  const same = p.check();
  t.diagnostic(`depends on verifier-reader-gaps (${stages('verifier-reader-gaps')}): exit ${same.status}`);
  assert.equal(same.status, 0, same.out);
  p.add({ ...head, depends_on: [later] }, rest);
  const r = p.check();
  const line = r.out.split('\n').find((l) => l.includes('iwg-dep')) ?? '';
  t.diagnostic(`depends on ${later} (${stages(later)}): exit ${r.status}, ${line}`);
  assert.equal(r.status, 1, r.out);
  assert.match(line, new RegExp(`${later}.*later stage`));
});
