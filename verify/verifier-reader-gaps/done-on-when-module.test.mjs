// Expect done-on-when-module: plan/README.md step 2 says done_on is set when the item names a module, and
// node plan/check.mjs, on a temp plan copy, passes a done item with no module and no done_on and refuses a done item
// naming a module without done_on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEM, joinItem, planCopy, read, splitItem } from './lib.mjs';

const readme = read('plan/README.md');
const step = (n) => readme.match(new RegExp(`^${n}\\. \\*\\*[\\s\\S]*?(?=\\n\\d\\. \\*\\*|\\n\\n)`, 'm'))[0]
  .replace(/\s+/g, ' ');

test('step 2 ties done_on to an item that names a module', (t) => {
  const s = step(2);
  t.diagnostic(s);
  assert.match(s, /first commit sets status `done`/);
  assert.match(s, /`done_on` to that day if the item names a `module`/);
});

test('the plan check passes a done item without module or done_on, and refuses one naming a module without done_on', (t) => {
  const p = planCopy(t);
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const { module, done_on, ...bare } = head;
  const write = (h) => writeFileSync(join(p.dir, 'plan/items', `vrg-done.md`), joinItem({ ...h, id: 'vrg-done' }, rest));

  write({ ...bare, status: 'done' });
  const plain = p.check();
  t.diagnostic(`no module, no done_on: ${plain.out.trim().split('\n').at(-1)}`);
  assert.equal(plain.status, 0, plain.out);

  write({ ...bare, status: 'done', module: 'docs/gates.md' });
  const refused = p.check();
  t.diagnostic(`module, no done_on: ${refused.out.trim()}`);
  assert.equal(refused.status, 1, refused.out);
  assert.match(refused.out, /vrg-done.*a done item that names a module needs done_on/);

  write({ ...bare, status: 'done', module: 'docs/gates.md', done_on: '2026-11-08' });
  const dated = p.check();
  assert.equal(dated.status, 0, dated.out);
});
